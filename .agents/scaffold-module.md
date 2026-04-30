# scaffold-module

Scaffold a complete, multi-tenant-aware NestJS module for a new domain entity.

## Instructions

You will be given an entity name (e.g. "Invoice", "Transfer", "Merchant").
Generate all of the following files, wired together and ready to use.

### Files to Generate

1. **`src/{entity}/schemas/{entity}.schema.ts`**
   - Include `tenantId: string` as the first `@Prop()` field (required, indexed)
   - Include `deletedAt: Date | null` for soft deletes
   - Add `{ timestamps: true }` to schema options
   - Add compound indexes: `{ tenantId: 1, _id: 1 }` and any domain-relevant indexes

2. **`src/{entity}/{entity}.repository.ts`**
   - Extend `BaseTenantRepository<{Entity}Document>`
   - Constructor injects `@InjectModel({Entity}.name)` and `TenantContextService`
   - Add 2–3 domain-specific query methods that call `this.find()` or `this.findOne()`
   - Never call `this.model` directly — always use the base class methods

3. **`src/{entity}/dto/create-{entity}.dto.ts`**
   - Use `class-validator` decorators
   - Do NOT include `tenantId` in the DTO — it is set by the repository automatically

4. **`src/{entity}/dto/update-{entity}.dto.ts`**
   - Use `PartialType(Create{Entity}Dto)` from `@nestjs/mapped-types`

5. **`src/{entity}/{entity}.service.ts`**
   - Inject `{Entity}Repository` and `UsageTrackingService`
   - For `create()`: call `usageTracking.hasExceededTransactionLimit(tenant)` first
   - Throw `ForbiddenException` if transaction limit exceeded
   - Call `usageTracking.trackTransaction(tenantId)` after successful create

6. **`src/{entity}/{entity}.controller.ts`**
   - Decorate with `@UseGuards(RateLimitGuard)`
   - Standard CRUD endpoints: POST /, GET /, GET /:id, PATCH /:id, DELETE /:id
   - DELETE calls `repository.softDelete()` — not a hard delete

7. **`src/{entity}/{entity}.module.ts`**
   - Import `MongooseModule.forFeature([{Entity}Schema])`
   - Provide `{Entity}Repository`, `{Entity}Service`
   - Export `{Entity}Service`

8. **`src/{entity}/__tests__/{entity}.service.spec.ts`**
   - Mock `{Entity}Repository` and `UsageTrackingService`
   - Test: create() blocks when transaction limit exceeded
   - Test: create() calls trackTransaction() on success
   - Test: find() delegates to repository (which handles tenantId filtering)

### After Generating Files
- Import the new module in `app.module.ts`
- Remind the developer to run `npm run test` to verify the new module
