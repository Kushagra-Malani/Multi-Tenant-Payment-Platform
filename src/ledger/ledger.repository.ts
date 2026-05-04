import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, ClientSession } from 'mongoose';
import { BaseTenantRepository } from '../common/repositories/base-tenant.repository';
import { TenantContextService } from '../tenant/tenant-context.service';
import { Ledger, LedgerDocument } from './ledger.schema';

@Injectable()
export class LedgerRepository extends BaseTenantRepository<LedgerDocument> {
  constructor(
    @InjectModel(Ledger.name) model: Model<LedgerDocument>,
    tenantContext: TenantContextService,
  ) {
    super(model, tenantContext);
  }

  async findByUserId(userId: string, session?: ClientSession): Promise<LedgerDocument[]> {
    return this.find(
      { $or: [{ fromUserId: userId }, { toUserId: userId }] },
      { sort: { createdAt: -1 } },
      session,
    );
  }
}
