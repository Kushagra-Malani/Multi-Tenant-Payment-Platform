import { Logger, MiddlewareConsumer, Module, NestModule, Scope } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TenantModule } from './tenant/tenant.module';
import { TenantMiddleware } from './tenant/tenant.middleware';
import { UsageModule } from './usage/usage.module';
import { RateLimitGuard } from './common/guards/rate-limit.guard';
import { PaymentModule } from './payments/payment.module';

const logger = new Logger('AppModule');

/**
 * Root application module for the multi-tenant payment platform.
 *
 * - ConfigModule is loaded globally so all modules can inject ConfigService.
 * - MongooseModule connects to MongoDB using MONGODB_URI from environment.
 * - TenantModule provides tenant resolution, caching, and context services.
 * - TenantMiddleware is registered globally on all routes so every request
 *   is resolved to a tenant before reaching any controller.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const uri = configService.get<string>(
          'MONGODB_URI',
          'mongodb://localhost:27017/payment-platform',
        );

        return {
          uri,
          // Connection event listeners via Mongoose connection factory
          onConnectionCreate: (connection) => {
            connection.on('connected', () => {
              logger.log('✅ MongoDB connected successfully');
            });
            connection.on('error', (err: Error) => {
              logger.error(`❌ MongoDB connection error: ${err.message}`);
            });
          },
        };
      },
    }),
    TenantModule,
    UsageModule,
    PaymentModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: RateLimitGuard,
      scope: Scope.REQUEST,
    },
  ],
})
export class AppModule implements NestModule {
  /**
   * TENANT ISOLATION: Register TenantMiddleware globally on ALL routes.
   * Every request must be resolved to a tenant before any controller logic runs.
   */
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(TenantMiddleware).forRoutes('*');
  }
}

