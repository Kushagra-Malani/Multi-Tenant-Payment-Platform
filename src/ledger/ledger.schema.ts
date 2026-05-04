import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type LedgerDocument = HydratedDocument<Ledger>;

export enum LedgerType {
  TRANSFER = 'TRANSFER',
  DEPOSIT = 'DEPOSIT',
  WITHDRAWAL = 'WITHDRAWAL',
}

export enum LedgerStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  REVERSED = 'REVERSED',
}

@Schema({ timestamps: true })
export class Ledger {
  @Prop({ type: String, required: true })
  tenantId!: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Wallet', required: false })
  fromWalletId?: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Wallet', required: false })
  toWalletId?: Types.ObjectId;

  @Prop({ type: String, required: true })
  fromUserId!: string;

  @Prop({ type: String, required: true })
  toUserId!: string;

  @Prop({ type: Number, required: true, min: 0.01 })
  amount!: number;

  @Prop({ type: String, required: true })
  currency!: string;

  @Prop({ type: String, enum: LedgerType, required: true })
  type!: LedgerType;

  @Prop({ type: String, enum: LedgerStatus, default: LedgerStatus.PENDING })
  status!: LedgerStatus;

  @Prop({ type: String })
  description?: string;

  @Prop({ type: String })
  platformRef?: string;

  @Prop({ type: MongooseSchema.Types.Mixed })
  metadata?: Record<string, any>;
}

export const LedgerSchema = SchemaFactory.createForClass(Ledger);

// TENANT ISOLATION: compound indexes with tenantId as the leading key
LedgerSchema.index({ tenantId: 1, createdAt: -1 });
LedgerSchema.index({ tenantId: 1, fromUserId: 1 });
LedgerSchema.index({ tenantId: 1, toUserId: 1 });
