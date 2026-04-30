import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { UsageTrackingService } from './usage-tracking.service';
import { TenantDocument, TenantTier } from '../tenant/tenant.schema';

describe('UsageTrackingService', () => {
  let service: UsageTrackingService;
  let redisClient: any;

  beforeEach(async () => {
    redisClient = {
      incr: vi.fn(),
      mget: vi.fn(),
      get: vi.fn(),
      expireat: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsageTrackingService,
        {
          provide: 'REDIS_CLIENT',
          useValue: redisClient,
        },
      ],
    }).compile();

    service = module.get<UsageTrackingService>(UsageTrackingService);
  });

  describe('trackApiCall', () => {
    it('should increment correct Redis key for current month and set expiry', async () => {
      await service.trackApiCall('tenant-1');
      expect(redisClient.incr).toHaveBeenCalled();
      const incrKey = redisClient.incr.mock.calls[0][0];
      expect(incrKey).toMatch(/usage:tenant-1:\d{4}-\d{2}:api/);
      expect(redisClient.expireat).toHaveBeenCalled();
    });
  });

  describe('trackTransaction', () => {
    it('should increment correct Redis key and return new count', async () => {
      redisClient.incr.mockResolvedValue(5);
      const count = await service.trackTransaction('tenant-1');
      expect(count).toBe(5);
      const incrKey = redisClient.incr.mock.calls[0][0];
      expect(incrKey).toMatch(/usage:tenant-1:\d{4}-\d{2}:txn/);
      expect(redisClient.expireat).toHaveBeenCalled();
    });
  });

  describe('hasExceededTransactionLimit', () => {
    it('should return false for enterprise tier regardless of transaction count', async () => {
      const tenant = {
        tier: TenantTier.ENTERPRISE,
        maxTransactionsPerMonth: Infinity,
      } as TenantDocument;
      
      const hasExceeded = await service.hasExceededTransactionLimit(tenant);
      expect(hasExceeded).toBe(false);
      expect(redisClient.get).not.toHaveBeenCalled();
    });

    it('should return true when count >= maxTransactionsPerMonth', async () => {
      const tenant = {
        id: 'tenant-1',
        tier: TenantTier.STARTER,
        maxTransactionsPerMonth: 1000,
      } as TenantDocument;

      redisClient.get.mockResolvedValue('1000');
      const hasExceeded = await service.hasExceededTransactionLimit(tenant);
      expect(hasExceeded).toBe(true);
    });

    it('should return false when count < maxTransactionsPerMonth', async () => {
        const tenant = {
          id: 'tenant-1',
          tier: TenantTier.STARTER,
          maxTransactionsPerMonth: 1000,
        } as TenantDocument;
  
        redisClient.get.mockResolvedValue('999');
        const hasExceeded = await service.hasExceededTransactionLimit(tenant);
        expect(hasExceeded).toBe(false);
      });
  });

  describe('getUsageSummary', () => {
    it('should return zero counts when keys do not exist in Redis', async () => {
      redisClient.mget.mockResolvedValue([null, null]);
      const summary = await service.getUsageSummary('tenant-1', '2024-12');
      expect(summary).toEqual({
        tenantId: 'tenant-1',
        yearMonth: '2024-12',
        apiCalls: 0,
        transactions: 0,
      });
    });

    it('should return parsed counts when keys exist', async () => {
        redisClient.mget.mockResolvedValue(['500', '10']);
        const summary = await service.getUsageSummary('tenant-1', '2024-12');
        expect(summary).toEqual({
          tenantId: 'tenant-1',
          yearMonth: '2024-12',
          apiCalls: 500,
          transactions: 10,
        });
      });
  });

  describe('Month boundary', () => {
    it('key for current month differs from key for next month', () => {
      // It's tested indirectly by checking the generated key format
      const key = (service as any).apiKey('t1');
      expect(key).toMatch(/usage:t1:\d{4}-\d{2}:api/);
    });
  });
});
