import { CanActivate, ExecutionContext, HttpException, HttpStatus, Inject, Injectable, Scope } from '@nestjs/common';
import Redis from 'ioredis';
import { TenantContextService } from '../../tenant/tenant-context.service';
import { UsageTrackingService } from '../../usage/usage-tracking.service';
import { Response } from 'express';

const SLIDING_WINDOW_LUA_SCRIPT = `
  local current = redis.call('INCR', KEYS[1])
  if current == 1 then
    redis.call('EXPIRE', KEYS[1], ARGV[1])
  end
  return current
`;

@Injectable({ scope: Scope.REQUEST })
export class RateLimitGuard implements CanActivate {
  constructor(
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    private readonly tenantContext: TenantContextService,
    private readonly usageTracking: UsageTrackingService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const tenant = this.tenantContext.get();
    const limit = tenant.apiRateLimit;

    const now = Date.now();
    const windowMs = 60_000; // 1 minute
    const windowKey = `ratelimit:${tenant.id}:${Math.floor(now / windowMs)}`;

    const count = await this.redis.eval(
      SLIDING_WINDOW_LUA_SCRIPT,
      1,
      windowKey,
      61, // 61 seconds TTL
    ) as number;

    const response = context.switchToHttp().getResponse<Response>();
    response.header('X-RateLimit-Limit', limit.toString());
    response.header('X-RateLimit-Remaining', Math.max(0, limit - count).toString());
    response.header('X-RateLimit-Reset', Math.ceil(((Math.floor(now / windowMs) + 1) * windowMs) / 1000).toString());

    if (count > limit) {
      throw new HttpException('Too Many Requests', HttpStatus.TOO_MANY_REQUESTS);
    }

    // Fire and forget
    this.usageTracking.trackApiCall(tenant.id).catch(() => {});

    return true;
  }
}
