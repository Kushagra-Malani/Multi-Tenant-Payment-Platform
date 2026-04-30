# audit-tenant-isolation

Run a full security audit of the multi-tenant isolation layer.
Check every file in the project for potential cross-tenant data leaks.

## Instructions

### Step 1: Scan All Repository Files
Search every file matching `*.repository.ts`.
For each file, check:
- [ ] Does it extend `BaseTenantRepository`? If not, flag it as a security violation
- [ ] Does it call `this.model.find()` or `this.model.findOne()` directly? Flag as violation
- [ ] Does any method accept `tenantId` as a parameter? Flag as design smell

### Step 2: Scan All Service Files
Search every file matching `*.service.ts`.
For each file, check:
- [ ] Does it ever read `req.body.tenantId` or `req.params.tenantId`? Flag as violation
- [ ] Does it inject `TenantContextService` to get the tenant? Good.
- [ ] Does it pass `tenantId` into repository methods? Flag as redundant (base handles it)

### Step 3: Scan All Aggregation Pipelines
Search for `aggregate(` in all TypeScript files.
For each aggregation:
- [ ] Is the first stage `{ $match: { tenantId: ... } }`? If not, flag as critical violation
- [ ] Does any `$lookup` stage join without filtering by `tenantId`? Flag as violation

### Step 4: Scan All MongoDB Schema Files
Search every file matching `*.schema.ts`.
For each schema:
- [ ] Does it have `tenantId: string` as a `@Prop({ required: true })` field? If not, flag
- [ ] Does it have a compound index with `tenantId` as the first field? If not, flag

### Step 5: Report
Generate a Markdown audit report with:
- Summary: X files scanned, Y violations found
- Critical violations (must fix before shipping)
- Warnings (should fix)
- Passed checks

## // turbo
This workflow can run terminal commands automatically to search the codebase.
