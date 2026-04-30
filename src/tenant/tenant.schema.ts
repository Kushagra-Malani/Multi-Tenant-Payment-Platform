import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

/**
 * Supported subscription tiers for tenants in the multi-tenant platform.
 * Each tier maps to specific rate limits, user counts, and transaction quotas.
 */
export enum TenantTier {
  STARTER = 'starter',
  PROFESSIONAL = 'professional',
  ENTERPRISE = 'enterprise',
}

/**
 * Tenant document — represents a single financial institution on the platform.
 *
 * Every request is resolved to a Tenant before any business logic runs.
 * The `slug` field is used as the subdomain identifier (e.g. bank1.financeops.com)
 * and as the Redis cache key (`tenant:{slug}`).
 *
 * TENANT ISOLATION: This schema is the root of all tenant-scoped operations.
 */
@Schema({ timestamps: true })
export class Tenant {
  /** Unique, lowercase, URL-safe identifier used in subdomains. */
  @Prop({ type: String, required: true, unique: true, lowercase: true, trim: true })
  slug!: string;

  /** Human-readable display name of the tenant / institution. */
  @Prop({ type: String, required: true, trim: true })
  name!: string;

  /** Subscription tier controlling rate limits and quotas. */
  @Prop({ type: String, required: true, enum: TenantTier, default: TenantTier.STARTER })
  tier!: TenantTier;

  /** Optional custom domain (e.g. payments.hdfc.com). */
  @Prop({ type: String, sparse: true, unique: true })
  customDomain?: string;

  /**
   * Maximum API requests per minute — derived from tier.
   * Starter: 60 | Professional: 300 | Enterprise: 1000
   */
  @Prop({ type: Number, required: true, default: 60 })
  apiRateLimit!: number;

  /**
   * Maximum number of users allowed under this tenant.
   * Starter: 10 | Professional: 100 | Enterprise: Infinity (stored as 0 = unlimited)
   */
  @Prop({ type: Number, required: true, default: 10 })
  maxUsers!: number;

  /**
   * Maximum transactions per calendar month.
   * Starter: 1,000 | Professional: 50,000 | Enterprise: Infinity (stored as 0 = unlimited)
   */
  @Prop({ type: Number, required: true, default: 1000 })
  maxTransactionsPerMonth!: number;

  /** Whether this tenant is currently active. Inactive tenants are rejected at the middleware. */
  @Prop({ type: Boolean, required: true, default: true })
  isActive!: boolean;

  /** Soft-delete timestamp — null means the record is live. */
  @Prop({ type: Date, default: null })
  deletedAt!: Date | null;
}

export type TenantDocument = HydratedDocument<Tenant>;

export const TenantSchema = SchemaFactory.createForClass(Tenant);

// isActive index — not already covered by @Prop decorators
// (slug and customDomain indexes are created automatically via unique/sparse in @Prop)
TenantSchema.index({ isActive: 1 });
