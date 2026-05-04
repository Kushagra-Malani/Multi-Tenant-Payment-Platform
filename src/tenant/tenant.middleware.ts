import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response, NextFunction } from 'express';
import { TenantService } from './tenant.service';
import { TenantContextService } from './tenant-context.service';
import { TenantDocument } from './tenant.schema';

/**
 * Global middleware that resolves the current tenant for every incoming request.
 *
 * Resolution priority (strict order):
 *   1. Subdomain — e.g. bank1.financeops.com → slug "bank1"
 *   2. X-Tenant-ID header — explicit tenant identifier
 *   3. JWT claim — decoded (NOT verified) from Authorization: Bearer <token>
 *
 * After resolution, the tenant is validated (must exist and be active) and stored
 * in the REQUEST-scoped TenantContextService for downstream access.
 *
 * TENANT ISOLATION: This middleware is the security boundary. Every request must
 * pass through it before reaching any controller.
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  private readonly logger = new Logger(TenantMiddleware.name);
  private readonly platformDomain: string;

  constructor(
    private readonly tenantService: TenantService,
    private readonly tenantContext: TenantContextService,
    private readonly configService: ConfigService,
  ) {
    this.platformDomain = this.configService.get<string>(
      'PLATFORM_DOMAIN',
      'financeops.com',
    );
  }

  async use(req: Request, _res: Response, next: NextFunction): Promise<void> {
    let tenant: TenantDocument | null = null;

    // TENANT ISOLATION: Resolution order is strict — subdomain > header > JWT
    // Priority 1: Subdomain
    tenant = await this.resolveFromSubdomain(req);

    // Priority 2: X-Tenant-ID header
    if (!tenant) {
      tenant = await this.resolveFromHeader(req);
    }

    // Priority 3: JWT claim
    if (!tenant) {
      tenant = await this.resolveFromJwt(req);
    }

    // No tenant resolved from any source
    if (!tenant) {
      throw new UnauthorizedException('Tenant could not be resolved');
    }

    // TENANT ISOLATION: Inactive tenants are rejected at the gate
    if (!tenant.isActive) {
      throw new UnauthorizedException('Tenant is inactive');
    }

    // Store resolved tenant for downstream services
    this.tenantContext.set(tenant);
    this.logger.debug(`Resolved tenant: ${tenant.slug}`);

    next();
  }

  /**
   * Extract tenant slug from the request host's subdomain.
   *
   * Examples:
   *   bank1.financeops.com       → slug "bank1"
   *   bank1.financeops.com:3000  → slug "bank1" (port stripped)
   *   www.bank1.financeops.com   → slug "bank1" (www stripped)
   *   financeops.com             → null (root domain, no subdomain)
   *   payments.hdfc.com          → lookup by customDomain
   */
  private async resolveFromSubdomain(
    req: Request,
  ): Promise<TenantDocument | null> {
    const host = req.headers.host;
    if (!host) {
      return null;
    }

    // Strip port number if present (e.g. bank1.financeops.com:3000)
    let hostname = host.split(':')[0];

    // Strip www. prefix if present
    if (hostname.startsWith('www.')) {
      hostname = hostname.substring(4);
    }

    // Check if this is the bare platform domain (no subdomain)
    if (hostname === this.platformDomain) {
      // Root domain resolves to the "platform" tenant for super admin access
      return this.tenantService.findBySlug('platform');
    }

    // Check if host ends with the platform domain → extract subdomain
    const domainSuffix = `.${this.platformDomain}`;
    if (hostname.endsWith(domainSuffix)) {
      const slug = hostname.slice(0, -domainSuffix.length);
      if (slug) {
        return this.tenantService.findBySlug(slug);
      }
      return null;
    }

    // Host doesn't match platform domain — try custom domain lookup
    return this.tenantService.findByCustomDomain(hostname);
  }

  /**
   * Extract tenant slug from the X-Tenant-ID request header.
   */
  private async resolveFromHeader(
    req: Request,
  ): Promise<TenantDocument | null> {
    const tenantId = req.headers['x-tenant-id'];
    if (!tenantId || typeof tenantId !== 'string') {
      return null;
    }

    return this.tenantService.findBySlug(tenantId);
  }

  /**
   * Extract tenant ID from the JWT payload's `tenantId` claim.
   *
   * IMPORTANT: The JWT is only *decoded* here, NOT verified. Signature
   * verification is the responsibility of the auth guard later in the pipeline.
   * This middleware only needs the tenantId claim to resolve context.
   */
  private async resolveFromJwt(
    req: Request,
  ): Promise<TenantDocument | null> {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7);

    try {
      // Decode without verification — just extract the payload
      const payloadBase64 = token.split('.')[1];
      if (!payloadBase64) {
        return null;
      }

      const payload = JSON.parse(
        Buffer.from(payloadBase64, 'base64').toString('utf-8'),
      ) as { tenantId?: string };

      if (!payload.tenantId) {
        return null;
      }

      return this.tenantService.findById(payload.tenantId);
    } catch {
      this.logger.warn('Failed to decode JWT for tenant extraction');
      return null;
    }
  }
}
