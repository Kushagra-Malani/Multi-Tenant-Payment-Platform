import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Payment, PaymentSchema } from './payment.schema';
import { PaymentRepository } from './payment.repository';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { TenantModule } from '../tenant/tenant.module';
import { UsageModule } from '../usage/usage.module';

/**
 * Payments module — provides the Payment schema and tenant-scoped repository.
 *
 * Imports TenantModule to get access to TenantContextService, which is required
 * by PaymentRepository (via BaseTenantRepository) for automatic tenant scoping.
 */
@Module({
  imports: [
    MongooseModule.forFeature([{ name: Payment.name, schema: PaymentSchema }]),
    TenantModule,
    UsageModule,
  ],
  controllers: [PaymentController],
  providers: [PaymentRepository, PaymentService],
  exports: [PaymentRepository, PaymentService],
})
export class PaymentModule {}

