import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { RateLimitGuard } from './rate-limit.guard';
import { TenantContextService } from '../../tenant/tenant-context.service';
import { UsageTrackingService } from '../../usage/usage-tracking.service';
import { TenantDocument, TenantTier } from '../../tenant/tenant.schema';

describe('RateLimitGuard', () => {
  let guard: RateLimitGuard;
  let redisClient: any;
  let tenantContext: any;
  let usageTracking: any;

  beforeEach(() => {
    redisClient = {
      eval: vi.fn(),
    };

    tenantContext = {
      get: vi.fn(),
    };

    usageTracking = {
      trackApiCall: vi.fn().mockResolvedValue(undefined),
    };

    guard = new RateLimitGuard(redisClient as any, tenantContext as any, usageTracking as any);
  });

  function createMockContext(headers: Record<string, string> = {}): ExecutionContext {
    return {
      switchToHttp: () => ({
        getResponse: () => ({
          header: vi.fn((key: string, value: string) => {
            headers[key] = value;
          }),
        }),
      }),
    } as any;
  }

  it('allows request when count is under the limit', async () => {
    const tenant = { id: 'tenant-1', apiRateLimit: 60 } as TenantDocument;
    tenantContext.get.mockReturnValue(tenant);
    redisClient.eval.mockResolvedValue(10);

    const headers: Record<string, string> = {};
    const context = createMockContext(headers);

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(headers['X-RateLimit-Limit']).toBe('60');
    expect(headers['X-RateLimit-Remaining']).toBe('50');
    expect(headers['X-RateLimit-Reset']).toBeDefined();
    expect(usageTracking.trackApiCall).toHaveBeenCalledWith('tenant-1');
  });

  it('throws 429 when count equals limit + 1', async () => {
    const tenant = { id: 'tenant-1', apiRateLimit: 60 } as TenantDocument;
    tenantContext.get.mockReturnValue(tenant);
    redisClient.eval.mockResolvedValue(61);

    const headers: Record<string, string> = {};
    const context = createMockContext(headers);

    await expect(guard.canActivate(context)).rejects.toThrow(
      new HttpException('Too Many Requests', HttpStatus.TOO_MANY_REQUESTS),
    );

    expect(headers['X-RateLimit-Limit']).toBe('60');
    expect(headers['X-RateLimit-Remaining']).toBe('0');
    expect(usageTracking.trackApiCall).not.toHaveBeenCalled();
  });

  it('uses tenant tier limit not a hardcoded value', async () => {
    const tenant = { id: 'tenant-1', apiRateLimit: 300 } as TenantDocument;
    tenantContext.get.mockReturnValue(tenant);
    redisClient.eval.mockResolvedValue(100);

    const headers: Record<string, string> = {};
    const context = createMockContext(headers);

    await guard.canActivate(context);

    expect(headers['X-RateLimit-Limit']).toBe('300');
    expect(headers['X-RateLimit-Remaining']).toBe('200');
  });
});
