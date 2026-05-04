import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Role } from '../users/user.schema';

@Controller('tenants')
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Post()
  @Roles(Role.SUPER_ADMIN)
  create(@Body() createTenantDto: any) {
    // In a real app, we would use a DTO
    return this.tenantService.create(createTenantDto);
  }

  @Get()
  @Roles(Role.SUPER_ADMIN)
  findAll() {
    return this.tenantService.findAll();
  }

  @Get('public')
  @Public()
  async findPublic() {
    const tenants = await this.tenantService.findAll();
    // Exclude the platform tenant from the public list
    return tenants.filter(t => t.slug !== 'platform' && t.isActive).map(t => ({
      slug: t.slug,
      name: t.name,
      tier: t.tier,
      apiRateLimit: t.apiRateLimit,
      maxTransactions: t.maxTransactionsPerMonth,
    }));
  }
}
