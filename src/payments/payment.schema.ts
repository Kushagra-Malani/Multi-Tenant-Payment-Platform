import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

/**
 * Payment status lifecycle.
 */
export enum PaymentStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

/**
 * Payment document — represents a single financial transaction scoped to a tenant.
 *
 * TENANT ISOLATION: The `tenantId` field is required on every document and is
 * always set by BaseTenantRepository — never by the caller directly.
 */
@Schema({ timestamps: true })
export class Payment {
  /** TENANT ISOLATION: required on every document, always injected by BaseTenantRepository. */
  @Prop({ type: String, required: true, index: true })
  tenantId!: string;

  /** The destination wallet ID (Customer) receiving the payment. */
  @Prop({ type: String, required: true })
  walletId!: string;

  /** Transaction amount in minor units (e.g. cents). */
  @Prop({ type: Number, required: true })
  amount!: number;

  /** ISO 4217 currency code (e.g. "USD", "INR"). */
  @Prop({ type: String, required: true })
  currency!: string;

  /** Current status of the payment. */
  @Prop({ type: String, required: true, enum: PaymentStatus, default: PaymentStatus.PENDING })
  status!: PaymentStatus;

  /** Soft-delete timestamp — null means the record is live. */
  @Prop({ type: Date, default: null })
  deletedAt!: Date | null;
}

export type PaymentDocument = HydratedDocument<Payment>;

export const PaymentSchema = SchemaFactory.createForClass(Payment);

// TENANT ISOLATION: compound indexes with tenantId as the leading key
PaymentSchema.index({ tenantId: 1, _id: 1 });
PaymentSchema.index({ tenantId: 1, status: 1 });
