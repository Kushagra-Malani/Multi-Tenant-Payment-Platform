import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type WalletDocument = HydratedDocument<Wallet>;

@Schema({ timestamps: true })
export class Wallet {
  @Prop({ type: String, required: true, trim: true })
  userId!: string;

  /** TENANT ISOLATION: required on every document, always injected by BaseTenantRepository. */
  @Prop({ type: String, required: true })
  tenantId!: string;

  @Prop({ type: String, required: true })
  ownerName!: string;

  @Prop({ type: Number, required: true, default: 0, min: 0 })
  balance!: number;

  @Prop({ type: String, required: true, default: 'INR' })
  currency!: string;

  @Prop({ type: Boolean, default: true })
  isActive!: boolean;

  @Prop({ type: Date, default: null })
  deletedAt!: Date | null;
}

export const WalletSchema = SchemaFactory.createForClass(Wallet);

// TENANT ISOLATION: compound index enforces unique userId per tenant
WalletSchema.index({ tenantId: 1, userId: 1 }, { unique: true });
