import {
  Injectable,
  Inject,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { ChangeStream } from 'mongodb';
import Redis from 'ioredis';
import { Tenant, TenantDocument } from './tenant.schema';

/**
 * Tenant Cache Invalidation Service
 *
 * Uses MongoDB Change Streams to listen for real-time changes on the tenants
 * collection. When a tenant document is updated, replaced, or deleted — even
 * via direct MongoDB edits (Compass, mongosh) — this service automatically
 * clears the corresponding Redis cache keys so the next API request fetches
 * fresh data from the database.
 *
 * Requirements:
 * - MongoDB must be running as a replica set (Atlas provides this by default).
 * - Includes automatic reconnection with exponential backoff if the stream drops.
 *
 * TENANT ISOLATION: This service ensures that cached tenant data never becomes
 * stale, which is critical for accurate rate-limit enforcement and tenant resolution.
 */
@Injectable()
export class TenantCacheInvalidationService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(TenantCacheInvalidationService.name);
  private changeStream: ChangeStream | null = null;
  private reconnectAttempts = 0;
  private readonly maxReconnectDelay = 30000; // 30 seconds max

  constructor(
    @InjectModel(Tenant.name)
    private readonly tenantModel: Model<Tenant>,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  /**
   * Start the Change Stream when the NestJS application boots up.
   */
  onModuleInit(): void {
    this.startChangeStream();
  }

  /**
   * Gracefully close the Change Stream when the application shuts down.
   */
  async onModuleDestroy(): Promise<void> {
    if (this.changeStream) {
      await this.changeStream.close();
      this.logger.log('Change Stream closed gracefully');
    }
  }

  /**
   * Opens a Change Stream on the tenants collection and listens for
   * update, replace, and delete events.
   *
   * Uses `fullDocument: 'updateLookup'` so that update events include
   * the full document (needed to extract the slug for cache key deletion).
   */
  private startChangeStream(): void {
    try {
      this.changeStream = this.tenantModel.watch(
        [
          {
            $match: {
              operationType: { $in: ['update', 'replace', 'delete'] },
            },
          },
        ],
        { fullDocument: 'updateLookup' },
      );

      this.changeStream.on('change', (change) => {
        this.handleChange(change);
      });

      this.changeStream.on('error', (error) => {
        this.logger.error('Change Stream error:', error);
        this.scheduleReconnect();
      });

      this.changeStream.on('close', () => {
        this.logger.warn('Change Stream closed unexpectedly');
        this.scheduleReconnect();
      });

      this.reconnectAttempts = 0;
      this.logger.log(
        '✅ MongoDB Change Stream started on tenants collection',
      );
    } catch (error) {
      this.logger.error('Failed to start Change Stream:', error);
      this.scheduleReconnect();
    }
  }

  /**
   * Handles a single change event by deleting all related Redis cache keys.
   */
  private async handleChange(change: Record<string, any>): Promise<void> {
    const documentId = change.documentKey?._id?.toString();

    if (change.operationType === 'delete') {
      // For deletes, we only have the document ID — clear by ID
      this.logger.log(
        `Tenant deleted (ID: ${documentId}) — invalidating cache`,
      );
      await this.invalidateCacheById(documentId);
      return;
    }

    // For update/replace, the full document is available
    const fullDocument = change.fullDocument as TenantDocument | null;

    if (!fullDocument) {
      // Fallback: if fullDocument is missing, clear by ID only
      this.logger.warn(
        `Change event without fullDocument (ID: ${documentId}) — invalidating by ID only`,
      );
      await this.invalidateCacheById(documentId);
      return;
    }

    this.logger.log(
      `Tenant "${fullDocument.slug}" changed (${change.operationType}) — invalidating cache`,
    );

    await this.invalidateAllCacheKeys(fullDocument, documentId);
  }

  /**
   * Deletes all possible Redis cache keys for a given tenant document.
   */
  private async invalidateAllCacheKeys(
    tenant: TenantDocument,
    documentId: string,
  ): Promise<void> {
    const keysToDelete: string[] = [
      `tenant:${tenant.slug}`,
      `tenant:id:${documentId}`,
    ];

    if (tenant.customDomain) {
      keysToDelete.push(`tenant:domain:${tenant.customDomain}`);
    }

    try {
      const result = await this.redis.del(...keysToDelete);
      this.logger.debug(
        `Deleted ${result} Redis key(s): [${keysToDelete.join(', ')}]`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to invalidate Redis cache for tenant "${tenant.slug}":`,
        error,
      );
    }
  }

  /**
   * Fallback: deletes cache by document ID only (used when fullDocument is unavailable).
   */
  private async invalidateCacheById(documentId: string): Promise<void> {
    try {
      const result = await this.redis.del(`tenant:id:${documentId}`);
      this.logger.debug(
        `Deleted ${result} Redis key(s) by ID: tenant:id:${documentId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to invalidate Redis cache for ID ${documentId}:`,
        error,
      );
    }
  }

  /**
   * Schedules a reconnection attempt with exponential backoff.
   * Starts at 1 second and doubles each attempt, capping at 30 seconds.
   */
  private scheduleReconnect(): void {
    const delay = Math.min(
      1000 * Math.pow(2, this.reconnectAttempts),
      this.maxReconnectDelay,
    );
    this.reconnectAttempts++;

    this.logger.warn(
      `Reconnecting Change Stream in ${delay / 1000}s (attempt ${this.reconnectAttempts})...`,
    );

    setTimeout(() => {
      this.startChangeStream();
    }, delay);
  }
}
