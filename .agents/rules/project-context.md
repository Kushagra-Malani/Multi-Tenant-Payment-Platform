# Project Context — Multi-Tenant Payment Platform

## What This Project Is
A SaaS payment platform where multiple banks and financial institutions (tenants) share
one NestJS backend but are completely isolated from each other. Think of it like
apartment units in one building — shared infrastructure, zero visibility into each other.

## The Three Core Systems

### 1. TenantContext (src/tenant/)
**The "who are you?" system.**
Every HTTP request first hits `TenantMiddleware`, which figures out which tenant is
calling. It checks in this order:
1. Subdomain — `hdfc.financeops.com` → tenant slug is `hdfc`
2. `X-Tenant-ID` header — for API clients
3. JWT claim `tenantId` — for authenticated users

Once resolved, the tenant object is stored in `TenantContextService`, which is
decorated with `@Injectable({ scope: Scope.REQUEST })`. This REQUEST scope means
a brand-new instance is created for every request and destroyed after — tenant data
can never bleed between requests.

Redis caches resolved tenants for 5 minutes to avoid hitting MongoDB on every request.
Cache key format: `tenant:{slug}`

### 2. BaseTenantRepository (src/common/repositories/)
**The "only your data" system.**
Every MongoDB repository in this project extends `BaseTenantRepository<T>`.
The base class wraps every Mongoose operation:
- `find(filter)` → internally becomes `find({ ...filter, tenantId })`
- `create(dto)` → internally injects `{ tenantId, ...dto }`
- `findByIdAndUpdate(id, update)` → verifies `tenantId` matches before updating
- `softDelete(id)` → sets `deletedAt` and verifies `tenantId`

Developers using repositories never think about tenants — it is handled automatically.
The only way to legitimately bypass this is via `AdminRepository`, which requires an
explicit admin service context and is logged for audit purposes.

### 3. RateLimitGuard + UsageTrackingService (src/common/guards/, src/usage/)
**The "you've used up your quota" system.**
Every controller is decorated with `@UseGuards(RateLimitGuard)`.
The guard:
1. Gets the tenant from `TenantContextService`
2. Checks the tenant's `apiRateLimit` from their tier config
3. Runs an atomic Redis Lua script: INCR the sliding-window counter, check against limit
4. Returns 429 with `X-RateLimit-*` headers if over limit
5. If allowed, calls `UsageTrackingService.trackApiCall(tenantId)`

`UsageTrackingService` maintains monthly counters in Redis:
- `usage:{tenantId}:{YYYY-MM}:api` — API call count
- `usage:{tenantId}:{YYYY-MM}:txn` — transaction count
These are read by the billing module at month end.

## Tenant Schema (key fields)
```typescript
{
  slug: string          // unique identifier, used in subdomains
  name: string          // display name
  tier: 'starter' | 'professional' | 'enterprise'
  customDomain?: string // e.g. "payments.theirbank.com"
  apiRateLimit: number  // calls per minute (60 / 300 / 1000)
  maxUsers: number
  maxTransactionsPerMonth: number
  isActive: boolean
}
```

## Key Architectural Decisions
- **Shared database, tenant isolation by field** — all tenants share MongoDB collections,
  isolation is enforced by `tenantId` on every document and query
- **Compound indexes** — every collection has `{ tenantId: 1, _id: 1 }` as a compound index
- **Sliding window rate limiting** — chosen over fixed window to prevent burst attacks at
  window boundaries; implemented with an atomic Lua script for distributed correctness
- **REQUEST-scoped context** — NestJS's built-in REQUEST scope guarantees per-request
  isolation with zero extra code from the developer

## What NOT To Do
- Do not read `tenantId` from `req.body` or `req.params` — always use `TenantContextService`
- Do not use Mongoose models directly — always go through a repository that extends `BaseTenantRepository`
- Do not use Redis `MULTI/EXEC` for rate limiting — use atomic Lua scripts instead
- Do not create a MongoDB query with only `{ _id }` filter — always include `tenantId`
