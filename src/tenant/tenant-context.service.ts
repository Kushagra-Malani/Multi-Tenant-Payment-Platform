import { Injectable, NotFoundException, Scope } from '@nestjs/common';
import { TenantDocument } from './tenant.schema';

/**
 * REQUEST-scoped service that holds the resolved tenant for the current request.
 *
 * TENANT ISOLATION: Using Scope.REQUEST is NON-NEGOTIABLE. Without it, a single
 * shared instance would leak tenant data between concurrent requests. Every
 * request gets its own instance of this service.
 *
 * The middleware calls `set()` after resolving the tenant. Downstream services
 * call `get()` to retrieve the tenant without ever touching the request object.
 */
@Injectable({ scope: Scope.REQUEST })
export class TenantContextService {
  private tenant: TenantDocument | null = null;

  /**
   * Store the resolved tenant for this request.
   * Called exclusively by TenantMiddleware.
   */
  set(tenant: TenantDocument): void {
    // TENANT ISOLATION: Once set, the tenant cannot be overridden within the same request
    this.tenant = tenant;
  }

  /**
   * Retrieve the resolved tenant. Throws if the middleware has not resolved one yet.
   * This is the primary accessor used by all downstream services.
   */
  get(): TenantDocument {
    if (!this.tenant) {
      throw new NotFoundException(
        'Tenant context is not set. Ensure TenantMiddleware is applied.',
      );
    }
    return this.tenant;
  }

  /**
   * Retrieve the resolved tenant or null — useful for optional tenant checks
   * (e.g. health-check endpoints that may not require a tenant).
   */
  getOrNull(): TenantDocument | null {
    return this.tenant;
  }
}
