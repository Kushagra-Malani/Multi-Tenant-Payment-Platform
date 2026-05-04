import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BaseTenantRepository } from '../common/repositories/base-tenant.repository';
import { TenantContextService } from '../tenant/tenant-context.service';
import { User, UserDocument } from './user.schema';

@Injectable()
export class UsersRepository extends BaseTenantRepository<UserDocument> {
  constructor(
    @InjectModel(User.name) model: Model<User>,
    tenantContext: TenantContextService,
  ) {
    super(model, tenantContext);
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.findOne({ email });
  }
}
