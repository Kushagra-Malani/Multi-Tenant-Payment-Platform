import { Logger, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { Tenant, TenantSchema } from './tenant.schema';
import { TenantService } from './tenant.service';
import { TenantContextService } from './tenant-context.service';
import { TenantMiddleware } from './tenant.middleware';
import { TenantController } from './tenant.controller';

const logger = new Logger('TenantModule');

/**
 * Tenant module — provides tenant resolution infrastructure to the entire application.
 *
 * Responsibilities:
 * - Registers the Tenant Mongoose model
 * - Provides the REDIS_CLIENT factory (shared ioredis instance with TLS for Upstash)
 * - Exports TenantService, TenantContextService, and TenantMiddleware so they
 *   can be consumed by AppModule and downstream feature modules
 *
 * TENANT ISOLATION: This module is the foundation of the multi-tenant architecture.
 * TenantContextService is REQUEST-scoped, ensuring each request gets its own tenant context.
 */
@Module({
  imports: [
    MongooseModule.forFeature([{ name: Tenant.name, schema: TenantSchema }]),
  ],
  controllers: [TenantController],
  providers: [
    // Redis client factory — single shared connection with TLS support (Upstash)
    {
      provide: 'REDIS_CLIENT',
      useFactory: (configService: ConfigService): Redis => {
        const rawUrl = configService.get<string>(
          'REDIS_URL',
          'redis://localhost:6379',
        );

        // Parse the Redis URL to extract host, port, and password
        const redisUrl = new URL(rawUrl);

        const client = new Redis({
          host: redisUrl.hostname,
          port: Number(redisUrl.port) || 6379,
          password: redisUrl.password || undefined,
          tls: redisUrl.hostname !== 'localhost'
            ? { rejectUnauthorized: false }
            : undefined,
        });

        // Connection event listeners
        client.on('connect', () => {
          logger.log('✅ Redis connected successfully');
        });

        client.on('error', (err: Error) => {
          logger.error(`❌ Redis connection error: ${err.message}`);
        });

        return client;
      },
      inject: [ConfigService],
    },
    TenantService,
    TenantContextService,
    TenantMiddleware,
  ],
  exports: [TenantService, TenantContextService, TenantMiddleware, 'REDIS_CLIENT'],
})
export class TenantModule {}
