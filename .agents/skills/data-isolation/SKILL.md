---
name: data-isolation
description: >
  Use this skill when implementing or modifying the data isolation layer, BaseTenantRepository,
  any repository that extends it, MongoDB schema design, or anything related to preventing
  cross-tenant data access. Triggers on: BaseTenantRepository, repository classes, tenantId
  filtering, aggregation pipelines, soft deletes, cross-tenant queries.
---

# Data Isolation Skill

## The Core Idea
Every MongoDB operation in this project MUST be scoped to a single tenant.
The `BaseTenantRepository<T>` class is the single place where this is enforced.
All other repositories extend it — they get isolation for free.

## Files to Create

### 1. `src/common/repositories/base-tenant.repository.ts`

This is the most security-critical file in the project. Implement it carefully.

```typescript
export abstract class BaseTenantRepository<T extends Document> {
  constructor(
    protected readonly model: Model<T>,
    private readonly tenantContext: TenantContextService,
  ) {}

  // Always called internally — never exposed as public
  private get tenantId(): string {
    return this.tenantContext.get().id;
  }

  // READ — always inject tenantId filter
  async find(filter: FilterQuery<T> = {}): Promise<T[]> {
    // TENANT ISOLATION: merge tenantId into every find
    return this.model.find({ ...filter, tenantId: this.tenantId }).exec();
  }

  async findOne(filter: FilterQuery<T>): Promise<T | null> {
    return this.model.findOne({ ...filter, tenantId: this.tenantId }).exec();
  }

  async findById(id: string): Promise<T | null> {
    return this.model.findOne({ _id: id, tenantId: this.tenantId }).exec();
    // NOTE: Never use findById(id) alone — it ignores tenantId
  }

  // WRITE — always inject tenantId on create
  async create(dto: Partial<T>): Promise<T> {
    // TENANT ISOLATION: inject tenantId so caller never needs to pass it
    const doc = new this.model({ ...dto, tenantId: this.tenantId });
    return doc.save();
  }

  // UPDATE — verify tenantId ownership before updating
  async findByIdAndUpdate(id: string, update: UpdateQuery<T>): Promise<T | null> {
    // TENANT ISOLATION: filter includes tenantId so cross-tenant update returns null
    return this.model
      .findOneAndUpdate({ _id: id, tenantId: this.tenantId }, update, { new: true })
      .exec();
  }

  // SOFT DELETE — never hard delete; set deletedAt
  async softDelete(id: string): Promise<T | null> {
    return this.model
      .findOneAndUpdate(
        { _id: id, tenantId: this.tenantId },
        { deletedAt: new Date() },
        { new: true },
      )
      .exec();
  }

  // AGGREGATION — pipeline must always start with tenantId $match
  async aggregate(pipeline: PipelineStage[]): Promise<unknown[]> {
    // TENANT ISOLATION: prepend $match stage so pipeline cannot access other tenants
    const safePipeline: PipelineStage[] = [
      { $match: { tenantId: new Types.ObjectId(this.tenantId) } },
      ...pipeline,
    ];
    return this.model.aggregate(safePipeline).exec();
  }

  // COUNT
  async count(filter: FilterQuery<T> = {}): Promise<number> {
    return this.model.countDocuments({ ...filter, tenantId: this.tenantId }).exec();
  }
}
```

### 2. Example: `src/payments/payment.repository.ts`
Show how a concrete repository is built by extending the base:

```typescript
@Injectable()
export class PaymentRepository extends BaseTenantRepository<PaymentDocument> {
  constructor(
    @InjectModel(Payment.name) model: Model<PaymentDocument>,
    tenantContext: TenantContextService,
  ) {
    super(model, tenantContext);
  }

  // Domain-specific methods can be added here — they inherit isolation automatically
  async findByStatus(status: PaymentStatus): Promise<PaymentDocument[]> {
    return this.find({ status }); // tenantId is added by the base class
  }
}
```

### 3. `src/payments/payment.schema.ts`
Every schema needs `tenantId` and soft-delete fields:

```typescript
@Schema({ timestamps: true })
export class Payment {
  @Prop({ required: true, index: true })
  tenantId: string;   // TENANT ISOLATION: required on every schema

  @Prop({ required: true })
  amount: number;

  @Prop({ required: true, enum: PaymentStatus })
  status: PaymentStatus;

  @Prop({ default: null })
  deletedAt: Date | null;  // soft delete field
}
```

Add compound index in schema:
```typescript
PaymentSchema.index({ tenantId: 1, _id: 1 });
PaymentSchema.index({ tenantId: 1, status: 1 });
```

## Critical Rules for Aggregation Pipelines

When using `$lookup` to join collections, the joined collection must ALSO be filtered:

```typescript
// WRONG — exposes all tenants' data in $lookup
{ $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'user' } }

// CORRECT — add pipeline to filter by tenantId in the joined collection
{
  $lookup: {
    from: 'users',
    let: { userId: '$userId', tId: '$tenantId' },
    pipeline: [
      { $match: { $expr: { $and: [
        { $eq: ['$_id', '$$userId'] },
        { $eq: ['$tenantId', '$$tId'] },  // TENANT ISOLATION in $lookup
      ]}}}
    ],
    as: 'user',
  }
}
```

## Cross-Tenant Access (Admin / Analytics Only)

For legitimate cross-tenant access (admin endpoints, analytics dashboards):
- Create a separate `AdminRepository` that does NOT extend `BaseTenantRepository`
- Inject it only into admin services
- Every admin query must be logged with: `tenantId`, `adminUserId`, `action`, `timestamp`
- Admin services must be behind an admin-only guard

## Handling Deleted Documents

All `find` operations automatically exclude soft-deleted documents:
```typescript
// In BaseTenantRepository.find():
return this.model.find({ ...filter, tenantId: this.tenantId, deletedAt: null }).exec();
```

## MongoDB Indexes to Add on Every Collection
```typescript
// Compound index — fastest path for all tenant-scoped queries
schema.index({ tenantId: 1, _id: 1 });

// Add domain-specific indexes with tenantId as the first field
schema.index({ tenantId: 1, createdAt: -1 });  // for time-sorted queries
schema.index({ tenantId: 1, status: 1 });       // for status-filtered queries
```

## Tests to Write
- `find()` never returns documents from another tenant
- `create()` always sets tenantId from context (not from caller)
- `findById()` returns null for a valid ID belonging to a different tenant
- `softDelete()` does not delete a document owned by a different tenant
- `aggregate()` always has `$match: { tenantId }` as the first pipeline stage
- Passing `{ tenantId: 'other-tenant' }` in the filter is overridden and ignored
