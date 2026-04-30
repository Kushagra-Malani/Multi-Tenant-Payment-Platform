import { Module } from '@nestjs/common';
import { UsageTrackingService } from './usage-tracking.service';
import { TenantModule } from '../tenant/tenant.module';

@Module({
  imports: [TenantModule], // To access REDIS_CLIENT
  providers: [UsageTrackingService],
  exports: [UsageTrackingService],
})
export class UsageModule {}
