# Multi-Tenant Payment Platform — Agent Rules

## Project Overview
This is a multi-tenant payment platform built with NestJS 10, MongoDB, Redis, and Next.js 14.
Multiple financial institutions (tenants) share the same infrastructure but are completely
isolated from each other at the data, rate-limit, and context levels.

## Tech Stack
- **Backend**: NestJS 10, TypeScript (strict mode)
- **Database**: MongoDB with Mongoose ODM
- **Cache / Queue**: Redis (ioredis), BullMQ
- **Frontend**: Next.js 14, React 18, MUI 5
- **Testing**: Vitest
- **Monorepo**: Nx (optional)

## Architecture — Three Core Layers (implement in this order)

### Layer 1: Tenant Resolution (Task A)
Every request must be resolved to a tenant before anything else runs.
- Middleware runs globally on every request
- Resolution priority: Subdomain → X-Tenant-ID header → JWT claim
- Resolved tenant is stored in a REQUEST-scoped NestJS service (TenantContext)
- Tenant lookups are cached in Redis with a 5-minute TTL
- Key files: `tenant.middleware.ts`, `tenant-context.service.ts`, `tenant.service.ts`

### Layer 2: Data Isolation (Task B)
All MongoDB reads and writes must be scoped to the resolved tenant.
- All repositories MUST extend `BaseTenantRepository`
- `BaseTenantRepository` auto-injects `tenantId` on every write
- `BaseTenantRepository` auto-filters by `tenantId` on every read
- Developers using repositories must never manually add tenantId — it is handled invisibly
- Every MongoDB collection has a compound index: `{ tenantId: 1, _id: 1 }`
- Key file: `base-tenant.repository.ts`

### Layer 3: Rate Limiting & Usage Tracking (Task C)
All requests pass through a rate limit guard before reaching controllers.
- Uses Redis sliding window algorithm with atomic Lua scripts
- Per-tenant limits based on their subscription tier (Starter/Professional/Enterprise)
- Returns standard headers: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset
- Monthly usage tracked in Redis: `usage:{tenantId}:{YYYY-MM}:api` and `:txn`
- Key files: `rate-limit.guard.ts`, `usage-tracking.service.ts`

## Tenant Tiers
| Tier         | Max Users | Transactions/Month | API Rate Limit |
|--------------|-----------|--------------------|----------------|
| starter      | 10        | 1,000              | 60/min         |
| professional | 100       | 50,000             | 300/min        |
| enterprise   | unlimited | unlimited          | 1000/min       |

## Coding Standards

### TypeScript
- Always use strict TypeScript — no `any` types
- Use interfaces for data shapes, types for unions
- All async functions must be properly typed with return types
- Use `readonly` for properties that should not be mutated

### NestJS Patterns
- Use constructor injection for all dependencies
- Decorate services with `@Injectable()`, modules with `@Module()`
- Use `@RequestScope()` for TenantContext — critical for isolation
- Guards go in `common/guards/`, middleware in the relevant module
- Use `ConfigService` for all environment variables — never `process.env` directly

### MongoDB / Mongoose
- Define schemas with `@Schema()` and `@Prop()` decorators
- Always add `{ timestamps: true }` to schema options
- Soft deletes: use `deletedAt: Date | null` field, never hard delete
- Aggregation pipelines must always start with a `$match` on `tenantId`

### Error Handling
- Use NestJS built-in exceptions: `NotFoundException`, `ForbiddenException`, etc.
- Never expose internal error details to API responses
- Log errors with context: always include `tenantId` and `requestId` in logs

### Testing
- Unit test every service method with Vitest
- Mock Redis and MongoDB — never use real connections in unit tests
- Test the BaseTenantRepository to ensure tenantId isolation cannot be bypassed

## Project Folder Structure
```
src/
├── tenant/                          # Task A
│   ├── tenant.schema.ts
│   ├── tenant.middleware.ts
│   ├── tenant-context.service.ts
│   ├── tenant.service.ts
│   └── tenant.module.ts
├── common/
│   ├── repositories/
│   │   └── base-tenant.repository.ts  # Task B
│   └── guards/
│       └── rate-limit.guard.ts        # Task C
├── usage/                             # Task C
│   ├── usage-tracking.service.ts
│   └── usage.module.ts
├── payments/                          # Example domain module
│   ├── payment.schema.ts
│   ├── payment.repository.ts
│   └── payment.service.ts
└── app.module.ts
```

## Security Rules
- NEVER hardcode secrets, API keys, or connection strings
- NEVER allow a tenantId from the request body to override the resolved tenantId
- NEVER write a MongoDB query without tenantId filtering outside of admin/analytics contexts
- NEVER expose one tenant's error messages or data in another tenant's response
- Always validate and sanitize inputs before they reach the database layer
