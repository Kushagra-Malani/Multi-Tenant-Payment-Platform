import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { TenantContextService } from '../../tenant/tenant-context.service';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import { Role } from '../../users/user.schema';

@Injectable()
export class TenantMatchGuard implements CanActivate {
  constructor(
    private readonly tenantContextService: TenantContextService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    
    if (!user || !user.tenantId) {
      throw new ForbiddenException('User tenant information is missing');
    }

    // SUPER_ADMIN can bypass tenant matching restrictions
    if (user.role === Role.SUPER_ADMIN) {
      return true;
    }

    const currentTenant = this.tenantContextService.getOrNull();
    if (!currentTenant) {
      throw new ForbiddenException('No tenant context established');
    }

    if (user.tenantId !== currentTenant.id) {
      // Security Layer: User from one tenant attempted to access another tenant's subdomain/context
      throw new ForbiddenException('Cross-tenant access denied');
    }

    return true;
  }
}
