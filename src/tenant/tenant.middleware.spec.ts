import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response, NextFunction } from 'express';
import { TenantMiddleware } from './tenant.middleware';
import { TenantService } from './tenant.service';
import { TenantContextService } from './tenant-context.service';
import { TenantDocument, TenantTier } from './tenant.schema';

/**
 * Unit tests for TenantMiddleware — the security boundary of the multi-tenant system.
 *
 * These tests verify the strict resolution priority (subdomain > header > JWT),
 * edge cases (www stripping, port stripping), and rejection of unknown / inactive tenants.
 *
 * All dependencies (TenantService, TenantContextService, ConfigService) are mocked.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Creates a mock TenantDocument with sensible defaults. */
function createMockTenant(
  overrides: Partial<{
    slug: string;
    name: string;
    tier: TenantTier;
    isActive: boolean;
    customDomain: string | null;
  }> = {},
): TenantDocument {
  return {
    _id: 'tenant-id-123',
    slug: 'bank1',
    name: 'Bank One',
    tier: TenantTier.STARTER,
    customDomain: null,
    apiRateLimit: 60,
    maxUsers: 10,
    maxTransactionsPerMonth: 1000,
    isActive: true,
    deletedAt: null,
    ...overrides,
  } as unknown as TenantDocument;
}

/** Creates a minimal mock Express Request with optional overrides. */
function createMockRequest(
  overrides: Partial<{
    host: string;
    'x-tenant-id': string;
    authorization: string;
  }> = {},
): Request {
  const headers: Record<string, string | undefined> = {};
  if (overrides.host !== undefined) headers['host'] = overrides.host;
  if (overrides['x-tenant-id'] !== undefined)
    headers['x-tenant-id'] = overrides['x-tenant-id'];
  if (overrides.authorization !== undefined)
    headers['authorization'] = overrides.authorization;

  return { headers } as unknown as Request;
}

/** Encodes a JSON payload as a fake JWT (header.payload.signature). */
function createFakeJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256' })).toString(
    'base64url',
  );
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.fake-signature`;
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('TenantMiddleware', () => {
  let middleware: TenantMiddleware;
  let tenantService: {
    findBySlug: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    findByCustomDomain: ReturnType<typeof vi.fn>;
  };
  let tenantContext: { set: ReturnType<typeof vi.fn> };
  let mockRes: Response;
  let mockNext: NextFunction;

  beforeEach(() => {
    tenantService = {
      findBySlug: vi.fn(),
      findById: vi.fn(),
      findByCustomDomain: vi.fn(),
    };

    tenantContext = {
      set: vi.fn(),
    };

    const configService = {
      get: vi.fn((key: string, defaultValue?: string) => {
        if (key === 'PLATFORM_DOMAIN') return 'financeops.com';
        return defaultValue;
      }),
    };

    middleware = new TenantMiddleware(
      tenantService as unknown as TenantService,
      tenantContext as unknown as TenantContextService,
      configService as unknown as ConfigService,
    );

    mockRes = {} as Response;
    mockNext = vi.fn();
  });

  // -----------------------------------------------------------------------
  // Subdomain resolution
  // -----------------------------------------------------------------------

  describe('subdomain resolution (Priority 1)', () => {
    it('should resolve tenant from subdomain', async () => {
      const tenant = createMockTenant({ slug: 'bank1' });
      tenantService.findBySlug.mockResolvedValue(tenant);

      const req = createMockRequest({ host: 'bank1.financeops.com' });
      await middleware.use(req, mockRes, mockNext);

      expect(tenantService.findBySlug).toHaveBeenCalledWith('bank1');
      expect(tenantContext.set).toHaveBeenCalledWith(tenant);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should strip www. prefix before resolving', async () => {
      const tenant = createMockTenant({ slug: 'bank1' });
      tenantService.findBySlug.mockResolvedValue(tenant);

      const req = createMockRequest({ host: 'www.bank1.financeops.com' });
      await middleware.use(req, mockRes, mockNext);

      expect(tenantService.findBySlug).toHaveBeenCalledWith('bank1');
      expect(tenantContext.set).toHaveBeenCalledWith(tenant);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should strip port number before resolving', async () => {
      const tenant = createMockTenant({ slug: 'bank1' });
      tenantService.findBySlug.mockResolvedValue(tenant);

      const req = createMockRequest({ host: 'bank1.financeops.com:3000' });
      await middleware.use(req, mockRes, mockNext);

      expect(tenantService.findBySlug).toHaveBeenCalledWith('bank1');
      expect(tenantContext.set).toHaveBeenCalledWith(tenant);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should strip both www. and port number', async () => {
      const tenant = createMockTenant({ slug: 'bank1' });
      tenantService.findBySlug.mockResolvedValue(tenant);

      const req = createMockRequest({
        host: 'www.bank1.financeops.com:8080',
      });
      await middleware.use(req, mockRes, mockNext);

      expect(tenantService.findBySlug).toHaveBeenCalledWith('bank1');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should resolve custom domain via findByCustomDomain', async () => {
      const tenant = createMockTenant({
        slug: 'hdfc',
        customDomain: 'payments.hdfc.com',
      });
      tenantService.findByCustomDomain.mockResolvedValue(tenant);

      const req = createMockRequest({ host: 'payments.hdfc.com' });
      await middleware.use(req, mockRes, mockNext);

      expect(tenantService.findByCustomDomain).toHaveBeenCalledWith(
        'payments.hdfc.com',
      );
      expect(tenantContext.set).toHaveBeenCalledWith(tenant);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should skip subdomain resolution when host is the bare platform domain', async () => {
      // Host is "financeops.com" — no subdomain present
      // Must fall through to header / JWT resolution
      const tenant = createMockTenant({ slug: 'bank2' });
      tenantService.findBySlug.mockResolvedValue(tenant);

      const req = createMockRequest({
        host: 'financeops.com',
        'x-tenant-id': 'bank2',
      });
      await middleware.use(req, mockRes, mockNext);

      // findBySlug should be called once — from the header fallback, not subdomain
      expect(tenantService.findBySlug).toHaveBeenCalledWith('bank2');
      expect(tenantContext.set).toHaveBeenCalledWith(tenant);
    });
  });

  // -----------------------------------------------------------------------
  // Header resolution fallback
  // -----------------------------------------------------------------------

  describe('X-Tenant-ID header resolution (Priority 2)', () => {
    it('should resolve tenant from X-Tenant-ID header when no subdomain', async () => {
      const tenant = createMockTenant({ slug: 'bank2' });
      tenantService.findBySlug.mockResolvedValue(tenant);

      const req = createMockRequest({
        host: 'financeops.com',
        'x-tenant-id': 'bank2',
      });
      await middleware.use(req, mockRes, mockNext);

      expect(tenantService.findBySlug).toHaveBeenCalledWith('bank2');
      expect(tenantContext.set).toHaveBeenCalledWith(tenant);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should NOT use header when subdomain already resolved', async () => {
      const subdomainTenant = createMockTenant({ slug: 'bank1' });
      const headerTenant = createMockTenant({ slug: 'bank2' });

      tenantService.findBySlug.mockImplementation(
        async (slug: string) => {
          if (slug === 'bank1') return subdomainTenant;
          if (slug === 'bank2') return headerTenant;
          return null;
        },
      );

      const req = createMockRequest({
        host: 'bank1.financeops.com',
        'x-tenant-id': 'bank2',
      });
      await middleware.use(req, mockRes, mockNext);

      // Subdomain takes priority — findBySlug called with 'bank1', not 'bank2'
      expect(tenantService.findBySlug).toHaveBeenCalledTimes(1);
      expect(tenantService.findBySlug).toHaveBeenCalledWith('bank1');
      expect(tenantContext.set).toHaveBeenCalledWith(subdomainTenant);
    });
  });

  // -----------------------------------------------------------------------
  // JWT fallback
  // -----------------------------------------------------------------------

  describe('JWT claim resolution (Priority 3)', () => {
    it('should resolve tenant from JWT when no subdomain or header', async () => {
      const tenant = createMockTenant({ _id: 'tenant-id-123' });
      tenantService.findById.mockResolvedValue(tenant);

      const jwt = createFakeJwt({ tenantId: 'tenant-id-123', sub: 'user123' });
      const req = createMockRequest({
        host: 'financeops.com',
        authorization: `Bearer ${jwt}`,
      });
      await middleware.use(req, mockRes, mockNext);

      expect(tenantService.findById).toHaveBeenCalledWith('tenant-id-123');
      expect(tenantContext.set).toHaveBeenCalledWith(tenant);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should skip JWT resolution when tenantId claim is missing', async () => {
      const jwt = createFakeJwt({ sub: 'user123' }); // no tenantId
      const req = createMockRequest({
        host: 'financeops.com',
        authorization: `Bearer ${jwt}`,
      });

      await expect(
        middleware.use(req, mockRes, mockNext),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should skip JWT resolution when Authorization header is not Bearer', async () => {
      const req = createMockRequest({
        host: 'financeops.com',
        authorization: 'Basic dXNlcjpwYXNz',
      });

      await expect(
        middleware.use(req, mockRes, mockNext),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // -----------------------------------------------------------------------
  // Error cases
  // -----------------------------------------------------------------------

  describe('error handling', () => {
    it('should throw UnauthorizedException when tenant is not found', async () => {
      tenantService.findBySlug.mockResolvedValue(null);

      const req = createMockRequest({
        host: 'unknown.financeops.com',
      });

      await expect(
        middleware.use(req, mockRes, mockNext),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        middleware.use(req, mockRes, mockNext),
      ).rejects.toThrow('Tenant could not be resolved');
    });

    it('should throw UnauthorizedException when tenant is inactive', async () => {
      const inactiveTenant = createMockTenant({
        slug: 'bank-closed',
        isActive: false,
      });
      tenantService.findBySlug.mockResolvedValue(inactiveTenant);

      const req = createMockRequest({
        host: 'bank-closed.financeops.com',
      });

      await expect(
        middleware.use(req, mockRes, mockNext),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        middleware.use(req, mockRes, mockNext),
      ).rejects.toThrow('Tenant is inactive');
    });

    it('should throw UnauthorizedException when no identifier is provided at all', async () => {
      const req = createMockRequest({ host: 'financeops.com' });

      await expect(
        middleware.use(req, mockRes, mockNext),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        middleware.use(req, mockRes, mockNext),
      ).rejects.toThrow('Tenant could not be resolved');
    });

    it('should throw when host header is missing entirely', async () => {
      const req = createMockRequest({}); // no host at all

      await expect(
        middleware.use(req, mockRes, mockNext),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
