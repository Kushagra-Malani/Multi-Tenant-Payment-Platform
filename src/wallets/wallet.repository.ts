import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, ClientSession } from 'mongoose';
import { BaseTenantRepository } from '../common/repositories/base-tenant.repository';
import { TenantContextService } from '../tenant/tenant-context.service';
import { Wallet, WalletDocument } from './wallet.schema';

@Injectable()
export class WalletRepository extends BaseTenantRepository<WalletDocument> {
  constructor(
    @InjectModel(Wallet.name) model: Model<WalletDocument>,
    tenantContext: TenantContextService,
  ) {
    super(model, tenantContext);
  }

  async findByUserId(userId: string, session?: ClientSession): Promise<WalletDocument | null> {
    return this.findOne({ userId }, session);
  }

  async findAllByTenant(session?: ClientSession): Promise<WalletDocument[]> {
    return this.find({}, undefined, session);
  }
}
