import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BaseTenantRepository } from '../common/repositories/base-tenant.repository';
import { TenantContextService } from '../tenant/tenant-context.service';
import { Payment, PaymentDocument, PaymentStatus } from './payment.schema';

/**
 * Tenant-scoped repository for Payment documents.
 *
 * Extends BaseTenantRepository so every read/write is automatically filtered
 * by the current tenant's ID. Domain-specific query methods inherit isolation
 * for free by calling `this.find()` / `this.findOne()` from the base class.
 *
 * TENANT ISOLATION: Never use the Mongoose Model directly — always go through
 * the inherited methods.
 */
@Injectable()
export class PaymentRepository extends BaseTenantRepository<PaymentDocument> {
  constructor(
    @InjectModel(Payment.name) model: Model<Payment>,
    tenantContext: TenantContextService,
  ) {
    super(model, tenantContext);
  }

  /**
   * Find all payments with a specific status, scoped to the current tenant.
   * Delegates to `this.find()` which injects tenantId automatically.
   */
  async findByStatus(status: PaymentStatus): Promise<PaymentDocument[]> {
    return this.find({ status });
  }

  /**
   * Find the most recent payments for the current tenant.
   * Delegates to `this.find()` with sort and limit options — tenantId is
   * injected automatically by the base class.
   */
  async findRecent(limit: number): Promise<PaymentDocument[]> {
    return this.find({}, { sort: { createdAt: -1 }, limit });
  }
}
