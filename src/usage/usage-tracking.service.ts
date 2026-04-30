import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { TenantDocument, TenantTier } from '../tenant/tenant.schema';

export interface UsageSummary {
  tenantId: string;
  yearMonth: string;
  apiCalls: number;
  transactions: number;
}

@Injectable()
export class UsageTrackingService {
  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}

  /**
   * Increment the API call count for the current month.
   */
  async trackApiCall(tenantId: string): Promise<void> {
    const key = this.apiKey(tenantId);
    await this.redis.incr(key);
    await this.redis.expireat(key, this.endOfNextMonth());
  }

  /**
   * Increment the transaction count for the current month and return the new count.
   */
  async trackTransaction(tenantId: string): Promise<number> {
    const key = this.txnKey(tenantId);
    const count = await this.redis.incr(key);
    await this.redis.expireat(key, this.endOfNextMonth());
    return count;
  }

  /**
   * Check if a tenant has exceeded their monthly transaction limit.
   */
  async hasExceededTransactionLimit(tenant: TenantDocument): Promise<boolean> {
    if (tenant.tier === TenantTier.ENTERPRISE || tenant.maxTransactionsPerMonth === 0 || tenant.maxTransactionsPerMonth === Infinity) {
      return false;
    }
    const count = await this.getTransactionCount(tenant.id);
    return count >= tenant.maxTransactionsPerMonth;
  }

  /**
   * Get API call and transaction counts for a specific month.
   */
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
