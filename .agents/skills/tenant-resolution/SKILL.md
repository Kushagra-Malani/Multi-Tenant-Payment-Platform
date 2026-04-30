---
name: tenant-resolution
description: >
  Use this skill when implementing or modifying anything related to tenant resolution,
  tenant context, tenant middleware, subdomain parsing, or JWT tenant extraction.
  Triggers on: TenantMiddleware, TenantContextService, tenant caching, X-Tenant-ID header handling.
---

# Tenant Resolution Skill

## Files to Create

### 1. `src/tenant/tenant.schema.ts`
Define the Mongoose schema for a Tenant document.

Required fields:
- `slug: string` — unique, lowercase, URL-safe (used in subdomains)
- `name: string` — display name
- `tier: enum` — 'starter' | 'professional' | 'enterprise'
- `customDomain?: string` — optional custom domain like `payments.theirbank.com`
- `apiRateLimit: number` — derived from tier (60 / 300 / 1000)
- `maxUsers: number` — derived from tier (10 / 100 / Infinity)
- `maxTransactionsPerMonth: number` — derived from tier
- `isActive: boolean` — default true
- Add `{ timestamps: true }` to schema options
- Add unique index on `slug` and sparse unique index on `customDomain`

### 2. `src/tenant/tenant-context.service.ts`
A REQUEST-scoped service that stores the resolved tenant for the current request.

```typescript
@Injectable({ scope: Scope.REQUEST })
export class TenantContextService {
  private tenant: TenantDocument | null = null;

  set(tenant: TenantDocument): void { ... }
  get(): TenantDocument { ... }  // throws NotFoundException if not set
  getOrNull(): TenantDocument | null { ... }
}
```

Critical: The `@Injectable({ scope: Scope.REQUEST })` decorator is NON-NEGOTIABLE.
Without it, a single shared instance would leak tenant data between concurrent requests.

### 3. `src/tenant/tenant.service.ts`
Handles tenant lookups with Redis caching.

```typescript
async findBySlug(slug: string): Promise<TenantDocument | null> {
  // 1. Check Redis: GET tenant:{slug}
  // 2. If hit: parse JSON, return
  // 3. If miss: query MongoDB, SET tenant:{slug} EX 300, return
}

async findByCustomDomain(domain: string): Promise<TenantDocument | null> {
  // Same pattern but key: tenant:domain:{domain}
}
```

### 4. `src/tenant/tenant.middleware.ts`
The core middleware. Resolution order is strict:

```
Priority 1 — Subdomain
  Parse host header: "bank1.financeops.com" → slug = "bank1"
  Strip "www." prefix if present
  Strip port number if present
  If host === platform domain root (e.g. "financeops.com"), skip

Priority 2 — X-Tenant-ID header
  Read req.headers['x-tenant-id']
  Use as slug

Priority 3 — JWT claim
  Decode JWT from Authorization: Bearer <token>
  Extract payload.tenantId claim
  Do NOT verify the JWT here — just decode for tenant extraction
  (JWT verification happens in the Auth guard later)

After extracting slug/id:
  Look up tenant via TenantService (uses Redis cache)
  If not found or isActive === false: throw UnauthorizedException
  Call TenantContextService.set(tenant)
  Call next()
```

### 5. `src/tenant/tenant.module.ts`
Wire everything together. Register middleware globally in `app.module.ts`:

```typescript
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantMiddleware).forRoutes('*');
  }
}
```

## Edge Cases to Handle
- Host header includes port: `bank1.financeops.com:3000` → strip `:3000`
- Host header has `www.`: `www.bank1.financeops.com` → strip `www.`
- Custom domain: `payments.hdfc.com` → look up by `customDomain` field
- Multiple identifiers present: subdomain takes priority over header over JWT
- Tenant is found but `isActive === false`: throw `UnauthorizedException('Tenant is inactive')`
- No tenant identifier found at all: throw `UnauthorizedException('Tenant could not be resolved')`

## Redis Key Reference
- `tenant:{slug}` — cached tenant object, TTL 300s
- `tenant:domain:{customDomain}` — cached by custom domain, TTL 300s

## Tests to Write
- Middleware resolves from subdomain correctly
- Middleware resolves from header when no subdomain
- Middleware resolves from JWT when no header or subdomain
- Middleware throws when tenant not found
- Middleware throws when tenant is inactive
- TenantContextService throws when get() called before set()
- TenantService returns from cache on second call (Redis hit)
- www. and port stripping works correctly
