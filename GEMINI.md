# Antigravity-Specific Rules — Payment Platform

## Agent Behaviour

### Planning Mode
Always use **Planning mode** (not Fast mode) for any task that touches:
- The tenant resolution middleware or context service
- The BaseTenantRepository or any class that extends it
- Redis key schemas or rate limiting logic
- New MongoDB schemas or index definitions

For simple tasks (adding a field, writing a test, fixing a typo), Fast mode is fine.

### Task Breakdown
Break every implementation task into sub-tasks of no more than 1 hour each.
Always include in the `implementation_plan.md` artifact:
1. Files to create
2. Files to modify
3. Tests to write
4. Redis keys or MongoDB indexes affected

### Verification
After implementing any of the three core layers (Task A, B, or C), always:
1. Run `npm run test` and confirm all tests pass
2. Verify that the new code uses `TenantContext` to get the tenant — never reads tenantId from request body
3. Check that no new MongoDB query bypasses the `BaseTenantRepository`

## Code Generation Preferences

### Style
- Prefer explicit over implicit — write out types fully
- Add a JSDoc comment above every class explaining its role in the multi-tenant system
- Use `// TENANT ISOLATION:` comments to mark any line that is critical for security

### NestJS Specifics
- When generating a new module, always wire it into `app.module.ts`
- When generating a new repository, always extend `BaseTenantRepository` — never use Mongoose Model directly
- When generating a new controller, always apply `@UseGuards(RateLimitGuard)`

### Redis Keys
Strictly follow this key naming convention — never deviate:
- Rate limiting: `ratelimit:{tenantId}:{YYYY-MM-DD-HH-mm}`
- Tenant cache: `tenant:{slug}`
- Monthly API usage: `usage:{tenantId}:{YYYY-MM}:api`
- Monthly transaction usage: `usage:{tenantId}:{YYYY-MM}:txn`

### Environment Variables
All env vars must be declared in `.env.example`. Never generate code that reads
an undeclared env var. Required variables for this project:
```
MONGODB_URI=
REDIS_URL=
JWT_SECRET=
PLATFORM_DOMAIN=financeops.com
TENANT_CACHE_TTL_SECONDS=300
```

## Antigravity Agent Manager Preferences

### Parallel Agents
The three tasks (A, B, C) have dependencies — do NOT run them in parallel:
- Task A must be fully complete before Task B starts
- Task B must be fully complete before Task C starts

### Browser Agent
Use the browser agent to verify the running application only after all three tasks
are implemented. Test scenarios to verify:
1. Make a request to `bank1.financeops.com/api/payments` — should resolve tenant "bank1"
2. Make 61 requests/min as a Starter tenant — the 61st should return 429
3. Create a payment as tenant A — confirm it is invisible when queried as tenant B

### Artifact Comments
When reviewing agent artifacts, use inline comments to flag:
- Any MongoDB query that does not include a `tenantId` filter
- Any place where `req.body.tenantId` is used instead of `TenantContext`
- Any Redis operation that is not atomic (not using Lua or transactions)
