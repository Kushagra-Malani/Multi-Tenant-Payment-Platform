---
name: rate-limiting
description: >
  Use this skill when implementing or modifying rate limiting, usage tracking, API quota
  enforcement, Redis counters, monthly billing summaries, or the RateLimitGuard.
  Triggers on: RateLimitGuard, UsageTrackingService, Redis sliding window, X-RateLimit headers,
  429 responses, monthly usage counters, billing.
---

# Rate Limiting & Usage Tracking Skill

## Files to Create

### 1. `src/common/guards/rate-limit.guard.ts`
A NestJS guard applied to all controllers. Runs after the tenant is resolved.

**Algorithm: Sliding Window** (chosen over fixed window to prevent burst abuse at boundaries)

```typescript
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly redis: Redis,
    private readonly tenantContext: TenantContextService,
    private readonly usageTracking: UsageTrackingService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const tenant = this.tenantContext.get();
    const limit = tenant.apiRateLimit;  // 60 / 300 / 1000

    const now = Date.now();
    const windowMs = 60_000; // 1 minute
    const windowKey = `ratelimit:${tenant.id}:${Math.floor(now / windowMs)}`;

    // Atomic Lua script: INCR + set TTL if new key + return count
    // This is atomic — no race condition possible
    const count = await this.redis.eval(
      SLIDING_WINDOW_LUA_SCRIPT,
      1,
      windowKey,
      String(Math.ceil(windowMs / 1000) + 1), // TTL slightly longer than window
    ) as number;

    const response = context.switchToHttp().getResponse();
    response.header('X-RateLimit-Limit', limit);
    response.header('X-RateLimit-Remaining', Math.max(0, limit - count));
    response.header('X-RateLimit-Reset', Math.ceil((Math.floor(now / windowMs) + 1) * windowMs / 1000));

    if (count > limit) {
      throw new HttpException('Too Many Requests', HttpStatus.TOO_MANY_REQUESTS);
    }

    // Fire and forget — do not await, do not block the request
    this.usageTracking.trackApiCall(tenant.id).catch(() => {});

    return true;
  }
}

// Lua script: atomic increment + expire
// Returns the new count after incrementing
const SLIDING_WINDOW_LUA_SCRIPT = `
  local current = redis.call('INCR', KEYS[1])
  if current == 1 then
    redis.call('EXPIRE', KEYS[1], ARGV[1])
  end
  return current
`;
```

Wire globally in `app.module.ts`:
```typescript
APP_GUARD provider with RateLimitGuard
```

### 2. `src/usage/usage-tracking.service.ts`
Tracks monthly API calls and transactions per tenant.

```typescript
@Injectable()
export class UsageTrackingService {
  constructor(private readonly redis: Redis) {}

  // Called by RateLimitGuard on every allowed request
  async trackApiCall(tenantId: string): Promise<void> {
    const key = this.apiKey(tenantId);
    await this.redis.incr(key);
    // Set expiry to end of next month (so data survives billing cycle)
    await this.redis.expireat(key, this.endOfNextMonth());
  }

  // Called by payment service when a transaction is created
  async trackTransaction(tenantId: string): Promise<void> {
    const key = this.txnKey(tenantId);
    const count = await this.redis.incr(key);
    await this.redis.expireat(key, this.endOfNextMonth());
    return count;
  }

  // Check if tenant has hit their transaction limit
  async hasExceededTransactionLimit(tenant: TenantDocument): Promise<boolean> {
    if (tenant.maxTransactionsPerMonth === Infinity) return false;
    const count = await this.getTransactionCount(tenant.id);
    return count >= tenant.maxTransactionsPerMonth;
  }

  // Used by billing module at month end
  async getUsageSummary(tenantId: string, yearMonth: string): Promise<UsageSummary> {
    const [apiCalls, transactions] = await this.redis.mget(
      `usage:${tenantId}:${yearMonth}:api`,
      `usage:${tenantId}:${yearMonth}:txn`,
    );
    return {
      tenantId,
      yearMonth,
      apiCalls: parseInt(apiCalls ?? '0', 10),
      transactions: parseInt(transactions ?? '0', 10),
    };
  }

  async getApiCallCount(tenantId: string): Promise<number> {
    const val = await this.redis.get(this.apiKey(tenantId));
    return parseInt(val ?? '0', 10);
  }

  async getTransactionCount(tenantId: string): Promise<number> {
    const val = await this.redis.get(this.txnKey(tenantId));
    return parseInt(val ?? '0', 10);
  }

  private apiKey(tenantId: string): string {
    return `usage:${tenantId}:${this.currentYearMonth()}:api`;
  }

  private txnKey(tenantId: string): string {
    return `usage:${tenantId}:${this.currentYearMonth()}:txn`;
  }

  private currentYearMonth(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  private endOfNextMonth(): number {
    const d = new Date();
    d.setMonth(d.getMonth() + 2, 0); // last day of next month
    d.setHours(23, 59, 59, 0);
    return Math.floor(d.getTime() / 1000);
  }
}
```

## Redis Key Reference
| Key Pattern | Purpose | TTL |
|---|---|---|
| `ratelimit:{tenantId}:{window}` | Per-minute rate limit counter | ~61 seconds |
| `usage:{tenantId}:{YYYY-MM}:api` | Monthly API call count | End of next month |
| `usage:{tenantId}:{YYYY-MM}:txn` | Monthly transaction count | End of next month |

## Why Sliding Window Over Fixed Window?
Fixed window resets at a hard boundary (e.g. :00 seconds). A bad actor can send
60 requests at :59 and 60 more at :00 — 120 calls in 2 seconds while technically
under the limit. Sliding window prevents this by tracking the current rolling
60-second period regardless of clock boundaries.

## Why Lua Script Over MULTI/EXEC?
Redis MULTI/EXEC is optimistic — it can fail and require retry logic.
A Lua script runs atomically on the Redis server: the INCR and EXPIRE
happen as a single unit. No two requests can race and both get `count = 1`.

## Month Boundary Handling
The `currentYearMonth()` helper ensures the key always reflects the current calendar
month. At midnight on the 1st, the key naturally changes (e.g. `2024-12` → `2025-01`)
so the counter starts fresh. The old key expires at end of next month, keeping billing
data available for 1 extra month after the period closes.

## Tier Limits Quick Reference
```typescript
export const TIER_CONFIG = {
  starter:      { apiRateLimit: 60,   maxUsers: 10,        maxTransactions: 1_000 },
  professional: { apiRateLimit: 300,  maxUsers: 100,       maxTransactions: 50_000 },
  enterprise:   { apiRateLimit: 1000, maxUsers: Infinity,  maxTransactions: Infinity },
};
```

## Tests to Write
- Guard allows request when count is under limit
- Guard returns 429 when count equals limit + 1
- Guard sets correct X-RateLimit-* headers
- Guard uses the tenant's tier limit (not a hardcoded value)
- trackApiCall() increments the correct Redis key
- trackTransaction() increments the correct Redis key
- getUsageSummary() returns zero counts for a new tenant
- hasExceededTransactionLimit() returns false for enterprise tier
- Month boundary: keys from previous month are not counted in current month
