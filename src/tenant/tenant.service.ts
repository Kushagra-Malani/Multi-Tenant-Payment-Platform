import { Injectable, Inject, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';
import Redis from 'ioredis';
import { Tenant, TenantDocument } from './tenant.schema';

/**
 * Service handling tenant lookups with Redis caching.
 *
 * Every tenant lookup first checks Redis, falling back to MongoDB on cache miss.
 * Cached entries use the key format `tenant:{slug}` with a configurable TTL
 * (default 300 seconds / 5 minutes).
 *
 * TENANT ISOLATION: This service is the single source of truth for resolving
 * tenant identifiers to full Tenant documents. All resolution paths funnel through here.
 */
@Injectable()
export class TenantService {
  private readonly logger = new Logger(TenantService.name);
  private readonly cacheTtl: number;

  constructor(
    @InjectModel(Tenant.name) private readonly tenantModel: Model<Tenant>,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    private readonly configService: ConfigService,
  ) {
    this.cacheTtl = this.configService.get<number>(
      'TENANT_CACHE_TTL_SECONDS',
      300,
    );
  }

  /**
   * Look up a tenant by its slug (subdomain identifier).
   * Uses Redis key: `tenant:{slug}` with TTL from TENANT_CACHE_TTL_SECONDS.
   */
  async findBySlug(slug: string): Promise<TenantDocument | null> {
    const cacheKey = `tenant:${slug}`;
    return this.findWithCache(cacheKey, { slug, deletedAt: null });
  }

  /**
   * Look up a tenant by its custom domain (e.g. payments.hdfc.com).
   * Uses Redis key: `tenant:domain:{domain}` with the same TTL.
   */
  async findByCustomDomain(domain: string): Promise<TenantDocument | null> {
    const cacheKey = `tenant:domain:${domain}`;
    return this.findWithCache(cacheKey, { customDomain: domain, deletedAt: null });
  }

  /**
   * Internal helper — checks Redis first, falls back to MongoDB.
   *
   * Flow:
   * 1. GET from Redis
   * 2. If cache hit → parse JSON → hydrate Mongoose document → return
   * 3. If cache miss → query MongoDB → SET in Redis with EX → return
   */
  private async findWithCache(
    cacheKey: string,
    query: Record<string, unknown>,
  ): Promise<TenantDocument | null> {
    try {
      // Step 1: Check Redis cache
      const cached = await this.redis.get(cacheKey);

      if (cached) {
        this.logger.debug(`Cache HIT: ${cacheKey}`);
        const parsed = JSON.parse(cached) as Record<string, unknown>;
        // Hydrate back into a Mongoose document so downstream code can use .toObject() etc.
        return new this.tenantModel(parsed) as TenantDocument;
      }
    } catch (error) {
      // Redis failure is non-fatal — fall through to MongoDB
      this.logger.warn(`Redis GET failed for ${cacheKey}`, error);
    }

    // Step 2: Query MongoDB
    this.logger.debug(`Cache MISS: ${cacheKey} — querying MongoDB`);
    const tenant = await this.tenantModel.findOne(query).exec();

    if (!tenant) {
      return null;
    }

    // Step 3: Write back to Redis cache
    try {
      await this.redis.set(
        cacheKey,
        JSON.stringify(tenant.toObject()),
        'EX',
        this.cacheTtl,
      );
      this.logger.debug(`Cached: ${cacheKey} (TTL ${this.cacheTtl}s)`);
    } catch (error) {
      this.logger.warn(`Redis SET failed for ${cacheKey}`, error);
    }

    return tenant;
  }
}
