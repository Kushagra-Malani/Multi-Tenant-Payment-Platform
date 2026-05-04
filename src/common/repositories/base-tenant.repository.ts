import {
  HydratedDocument,
  Model,
  PipelineStage,
  UpdateQuery,
  ClientSession,
  QueryOptions,
} from 'mongoose';
import { TenantContextService } from '../../tenant/tenant-context.service';

/**
 * Filter type for tenant-scoped queries.
 * Mongoose 9 no longer exports `FilterQuery` — we define a lightweight
 * equivalent that satisfies all our usage patterns.
 */
type TenantFilter<T> = {
  [P in keyof T]?: T[P] | Record<string, unknown>;
} & Record<string, unknown>;

/**
 * Abstract base repository that enforces tenant-scoped data isolation on every
 * MongoDB operation.
 *
 * TENANT ISOLATION: This is the most security-critical file in the project.
 * Every concrete repository MUST extend this class — never use the Mongoose Model
 * directly. The `tenantId` is always sourced from the REQUEST-scoped
 * TenantContextService, never from method parameters or request bodies.
 *
 * All read operations also exclude soft-deleted documents (`deletedAt: null`).
 *
 * @template T  The Mongoose HydratedDocument type for the collection.
 */
export abstract class BaseTenantRepository<T extends HydratedDocument<unknown>> {
  constructor(
    protected readonly model: Model<unknown>,
    private readonly tenantContext: TenantContextService,
  ) {}

  // ---------------------------------------------------------------------------
  // TENANT ISOLATION: Private getter — single source of truth for tenantId.
  // Never accept tenantId as a method parameter.
  // ---------------------------------------------------------------------------
  /**
   * Returns the tenantId for the current request.
   * Uses Mongoose's `.id` string getter (hex representation of `_id`).
   */
  private get tenantId(): string {
    // TENANT ISOLATION: tenantId comes ONLY from the resolved tenant context
    return this.tenantContext.get().id as string;
  }

  // ---------------------------------------------------------------------------
  // READ operations — always inject tenantId and exclude soft-deleted docs
  // ---------------------------------------------------------------------------

  /**
   * Find all documents matching `filter`, scoped to the current tenant.
   * Soft-deleted documents are automatically excluded.
   *
   * Any `tenantId` key present in the caller's `filter` is silently overridden —
   * callers cannot access another tenant's data, even by accident.
   */
  async find(
    filter: TenantFilter<T> = {},
    options?: { sort?: Record<string, 1 | -1>; limit?: number },
    session?: ClientSession,
  ): Promise<T[]> {
    // TENANT ISOLATION: merge tenantId last so it cannot be overridden by caller
    let query = this.model
      .find({ ...filter, tenantId: this.tenantId, deletedAt: null }, null, { session });

    if (options?.sort) {
      query = query.sort(options.sort);
    }
    if (options?.limit) {
      query = query.limit(options.limit);
    }

    return query.exec() as Promise<T[]>;
  }

  /**
   * Find a single document matching `filter`, scoped to the current tenant.
   * Soft-deleted documents are automatically excluded.
   */
  async findOne(filter: TenantFilter<T>, session?: ClientSession): Promise<T | null> {
    // TENANT ISOLATION: tenantId always wins over any caller-supplied value
    return this.model
      .findOne({ ...filter, tenantId: this.tenantId, deletedAt: null }, null, { session })
      .exec() as Promise<T | null>;
  }

  /**
   * Find a document by its `_id`, scoped to the current tenant.
   *
   * NOTE: We deliberately avoid Mongoose's native `findById()` because it does
   * NOT accept a filter — it would bypass tenant isolation entirely.
   */
  async findById(id: string, session?: ClientSession): Promise<T | null> {
    // TENANT ISOLATION: compound filter ensures only the owning tenant can access
    return this.model
      .findOne({ _id: id, tenantId: this.tenantId, deletedAt: null }, null, { session })
      .exec() as Promise<T | null>;
  }

  // ---------------------------------------------------------------------------
  // WRITE operations — always inject tenantId on creation
  // ---------------------------------------------------------------------------

  /**
   * Create a new document, automatically injecting `tenantId` from context.
   *
   * TENANT ISOLATION: Even if `dto` contains a `tenantId` key, it is overridden
   * by spreading `tenantId: this.tenantId` after `...dto`.
   */
  async create(dto: Partial<T>, session?: ClientSession): Promise<T> {
    // TENANT ISOLATION: tenantId injected after dto spread so caller cannot override
    const doc = new this.model({ ...dto, tenantId: this.tenantId });
    return doc.save({ session }) as Promise<T>;
  }

  // ---------------------------------------------------------------------------
  // UPDATE operations — verify tenant ownership before modifying
  // ---------------------------------------------------------------------------

  /**
   * Update a document by `_id`, only if it belongs to the current tenant.
   * Returns `null` (no mutation) if the document belongs to a different tenant.
   */
  async findByIdAndUpdate(id: string, update: UpdateQuery<T>, session?: ClientSession): Promise<T | null> {
    // TENANT ISOLATION: filter includes tenantId — cross-tenant update returns null
    return this.model
      .findOneAndUpdate(
        { _id: id, tenantId: this.tenantId, deletedAt: null },
        update,
        { new: true, session },
      )
      .exec() as Promise<T | null>;
  }

  /**
   * Find a document matching the filter and update it.
   */
  async findOneAndUpdate(
    filter: TenantFilter<T>,
    update: UpdateQuery<T>,
    options?: QueryOptions,
    session?: ClientSession,
  ): Promise<T | null> {
    // TENANT ISOLATION: filter includes tenantId
    return this.model
      .findOneAndUpdate(
        { ...filter, tenantId: this.tenantId, deletedAt: null },
        update,
        { new: true, ...options, session },
      )
      .exec() as Promise<T | null>;
  }

  /**
   * Soft-delete a document by setting `deletedAt` to the current timestamp.
   * The document is NEVER hard-deleted — it remains in the collection for auditing.
   *
   * Returns `null` if the document does not belong to the current tenant.
   */
  async softDelete(id: string, session?: ClientSession): Promise<T | null> {
    // TENANT ISOLATION: only the owning tenant can soft-delete
    return this.model
      .findOneAndUpdate(
        { _id: id, tenantId: this.tenantId, deletedAt: null },
        { deletedAt: new Date() },
        { new: true, session },
      )
      .exec() as Promise<T | null>;
  }

  // ---------------------------------------------------------------------------
  // AGGREGATION — pipeline always starts with tenant-scoped $match
  // ---------------------------------------------------------------------------

  /**
   * Execute an aggregation pipeline, prepending a `$match` on `tenantId` as the
   * very first stage. This ensures that no pipeline — regardless of what the
   * caller passes — can ever access data from another tenant.
   */
  async aggregate(pipeline: PipelineStage[], session?: ClientSession): Promise<unknown[]> {
    // TENANT ISOLATION: prepend $match so pipeline cannot access other tenants
    const safePipeline: PipelineStage[] = [
      { $match: { tenantId: this.tenantId } },
      ...pipeline,
    ];
    // In Mongoose, options (like session) is passed as a second parameter to aggregate
    const aggregation = this.model.aggregate(safePipeline);
    if (session) {
      aggregation.session(session);
    }
    return aggregation.exec();
  }

  // ---------------------------------------------------------------------------
  // COUNT — scoped to tenant
  // ---------------------------------------------------------------------------

  /**
   * Count documents matching `filter`, scoped to the current tenant.
   * Soft-deleted documents are automatically excluded.
   */
  async count(filter: TenantFilter<T> = {}, session?: ClientSession): Promise<number> {
    // TENANT ISOLATION: tenantId and deletedAt always enforced
    return this.model
      .countDocuments({ ...filter, tenantId: this.tenantId, deletedAt: null }, { session })
      .exec();
  }
}
