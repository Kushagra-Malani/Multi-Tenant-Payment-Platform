import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Document, Model } from 'mongoose';
import { BaseTenantRepository } from './base-tenant.repository';
import { TenantContextService } from '../../tenant/tenant-context.service';

// ---------------------------------------------------------------------------
// Test infrastructure
// ---------------------------------------------------------------------------

/**
 * Minimal interface matching the shape of documents this test exercises.
 * Extends Document so it satisfies the BaseTenantRepository<T extends Document> constraint.
 */
interface TestDocument extends Document {
  id: string;
  tenantId: string;
  name: string;
  deletedAt: Date | null;
  __v: number;
}

/**
 * Concrete subclass of BaseTenantRepository for testing purposes.
 * (BaseTenantRepository is abstract, so we need a thin subclass.)
 */
class TestRepository extends BaseTenantRepository<TestDocument> {
  constructor(model: Model<TestDocument>, tenantContext: TenantContextService) {
    super(model, tenantContext);
  }
}

/** Mock tenant IDs used throughout the suite. */
const TENANT_A_ID = 'aaaa-aaaa-aaaa-aaaa';
const TENANT_B_ID = 'bbbb-bbbb-bbbb-bbbb';

/** Helper — creates a mock TenantContextService returning the given tenantId. */
function createMockTenantContext(tenantId: string): TenantContextService {
  return {
    get: vi.fn(() => ({ id: tenantId })),
    getOrNull: vi.fn(() => ({ id: tenantId })),
    set: vi.fn(),
  } as unknown as TenantContextService;
}

/**
 * Helper — creates a mock Mongoose Model with chainable query methods.
 *
 * Each query method (find, findOne, findOneAndUpdate, countDocuments, aggregate)
 * is mocked to return a chainable object with `.sort()`, `.limit()`, and `.exec()`.
 * The `exec` function can be controlled per-test via the returned `execResolve` map.
 */
function createMockModel() {
  // Track what arguments each method was called with
  const calls: Record<string, unknown[][]> = {
    find: [],
    findOne: [],
    findOneAndUpdate: [],
    countDocuments: [],
    aggregate: [],
    save: [],
  };

  // Default return values for exec — override per test
  const execResults: Record<string, unknown> = {
    find: [],
    findOne: null,
    findOneAndUpdate: null,
    countDocuments: 0,
    aggregate: [],
  };

  function makeChainable(methodName: string) {
    return (...args: unknown[]) => {
      calls[methodName].push(args);
      const chain = {
        sort: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue(execResults[methodName]),
      };
      // Store the chain so tests can inspect sort/limit calls
      (chain as Record<string, unknown>)['_methodName'] = methodName;
      return chain;
    };
  }

  const modelFn = vi.fn(function (this: unknown, data: Record<string, unknown>) {
    return {
      ...data,
      save: vi.fn().mockImplementation(async () => {
        calls['save'].push([data]);
        return data;
      }),
    };
  }) as unknown as Model<TestDocument>;

  // Attach static methods
  (modelFn as unknown as Record<string, unknown>).find = vi.fn(makeChainable('find'));
  (modelFn as unknown as Record<string, unknown>).findOne = vi.fn(makeChainable('findOne'));
  (modelFn as unknown as Record<string, unknown>).findOneAndUpdate = vi.fn(makeChainable('findOneAndUpdate'));
  (modelFn as unknown as Record<string, unknown>).countDocuments = vi.fn(makeChainable('countDocuments'));
  (modelFn as unknown as Record<string, unknown>).aggregate = vi.fn(makeChainable('aggregate'));

  return { model: modelFn, calls, execResults };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BaseTenantRepository', () => {
  let repo: TestRepository;
  let mockModel: ReturnType<typeof createMockModel>;
  let tenantContext: TenantContextService;

  beforeEach(() => {
    tenantContext = createMockTenantContext(TENANT_A_ID);
    mockModel = createMockModel();
    repo = new TestRepository(mockModel.model, tenantContext);
  });

  // -----------------------------------------------------------------------
  // find()
  // -----------------------------------------------------------------------

  describe('find()', () => {
    it('should inject tenantId and deletedAt:null into every query', async () => {
      await repo.find({ name: 'test' });

      const findFn = mockModel.model.find as ReturnType<typeof vi.fn>;
      expect(findFn).toHaveBeenCalledTimes(1);

      const filter = findFn.mock.calls[0][0] as Record<string, unknown>;
      expect(filter.tenantId).toBe(TENANT_A_ID);
      expect(filter.deletedAt).toBeNull();
      expect(filter.name).toBe('test');
    });

    it('should never return documents belonging to a different tenant', async () => {
      // The filter always contains TENANT_A_ID, regardless of what docs exist in DB
      await repo.find();

      const findFn = mockModel.model.find as ReturnType<typeof vi.fn>;
      const filter = findFn.mock.calls[0][0] as Record<string, unknown>;
      expect(filter.tenantId).toBe(TENANT_A_ID);
      expect(filter.tenantId).not.toBe(TENANT_B_ID);
    });

    it('should silently override tenantId if caller tries to pass a different one', async () => {
      // Attacker tries: find({ tenantId: 'other-tenant' })
      await repo.find({ tenantId: TENANT_B_ID } as unknown as Record<string, unknown>);

      const findFn = mockModel.model.find as ReturnType<typeof vi.fn>;
      const filter = findFn.mock.calls[0][0] as Record<string, unknown>;

      // TENANT ISOLATION: The context tenantId MUST win
      expect(filter.tenantId).toBe(TENANT_A_ID);
      expect(filter.tenantId).not.toBe(TENANT_B_ID);
    });

    it('should exclude soft-deleted documents (deletedAt !== null)', async () => {
      await repo.find();

      const findFn = mockModel.model.find as ReturnType<typeof vi.fn>;
      const filter = findFn.mock.calls[0][0] as Record<string, unknown>;
      expect(filter.deletedAt).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // create()
  // -----------------------------------------------------------------------

  describe('create()', () => {
    it('should always set tenantId from context, ignoring any tenantId in dto', async () => {
      // Caller tries to sneak in a different tenantId
      await repo.create({
        tenantId: TENANT_B_ID,
        name: 'sneaky-payment',
      } as unknown as Partial<TestDocument>);

      // The model constructor should have been called with TENANT_A_ID
      const modelConstructor = mockModel.model as unknown as ReturnType<typeof vi.fn>;
      const constructorArg = modelConstructor.mock.calls[0][0] as Record<string, unknown>;

      expect(constructorArg.tenantId).toBe(TENANT_A_ID);
      expect(constructorArg.tenantId).not.toBe(TENANT_B_ID);
      expect(constructorArg.name).toBe('sneaky-payment');
    });

    it('should inject tenantId even when dto has no tenantId field', async () => {
      await repo.create({ name: 'normal-payment' } as unknown as Partial<TestDocument>);

      const modelConstructor = mockModel.model as unknown as ReturnType<typeof vi.fn>;
      const constructorArg = modelConstructor.mock.calls[0][0] as Record<string, unknown>;

      expect(constructorArg.tenantId).toBe(TENANT_A_ID);
    });
  });

  // -----------------------------------------------------------------------
  // findById()
  // -----------------------------------------------------------------------

  describe('findById()', () => {
    it('should include tenantId in the filter alongside _id', async () => {
      await repo.findById('doc-id-123');

      const findOneFn = mockModel.model.findOne as ReturnType<typeof vi.fn>;
      const filter = findOneFn.mock.calls[0][0] as Record<string, unknown>;

      expect(filter._id).toBe('doc-id-123');
      expect(filter.tenantId).toBe(TENANT_A_ID);
      expect(filter.deletedAt).toBeNull();
    });

    it('should return null for a valid MongoDB ID owned by a different tenant', async () => {
      // When findOne finds no match (because tenantId doesn't match), it returns null
      mockModel.execResults.findOne = null;

      const result = await repo.findById('valid-id-but-wrong-tenant');

      expect(result).toBeNull();
      const findOneFn = mockModel.model.findOne as ReturnType<typeof vi.fn>;
      const filter = findOneFn.mock.calls[0][0] as Record<string, unknown>;
      expect(filter.tenantId).toBe(TENANT_A_ID);
    });
  });

  // -----------------------------------------------------------------------
  // findByIdAndUpdate()
  // -----------------------------------------------------------------------

  describe('findByIdAndUpdate()', () => {
    it('should include tenantId in the filter for updates', async () => {
      await repo.findByIdAndUpdate('doc-id-123', { name: 'updated' });

      const updateFn = mockModel.model.findOneAndUpdate as ReturnType<typeof vi.fn>;
      const filter = updateFn.mock.calls[0][0] as Record<string, unknown>;

      expect(filter._id).toBe('doc-id-123');
      expect(filter.tenantId).toBe(TENANT_A_ID);
      expect(filter.deletedAt).toBeNull();
    });

    it('should return null and make no changes for a different tenant\'s document', async () => {
      mockModel.execResults.findOneAndUpdate = null;

      const result = await repo.findByIdAndUpdate('other-tenant-doc', { name: 'hacked' });

      expect(result).toBeNull();
      const updateFn = mockModel.model.findOneAndUpdate as ReturnType<typeof vi.fn>;
      const filter = updateFn.mock.calls[0][0] as Record<string, unknown>;
      expect(filter.tenantId).toBe(TENANT_A_ID);
    });
  });

  // -----------------------------------------------------------------------
  // softDelete()
  // -----------------------------------------------------------------------

  describe('softDelete()', () => {
    it('should set deletedAt field and NOT hard delete the document', async () => {
      const deletedDoc = { _id: 'doc-123', tenantId: TENANT_A_ID, deletedAt: new Date() };
      mockModel.execResults.findOneAndUpdate = deletedDoc;

      const result = await repo.softDelete('doc-123');

      // The update query should set deletedAt, not remove the document
      const updateFn = mockModel.model.findOneAndUpdate as ReturnType<typeof vi.fn>;
      expect(updateFn).toHaveBeenCalledTimes(1);

      const updateArg = updateFn.mock.calls[0][1] as Record<string, unknown>;
      expect(updateArg.deletedAt).toBeInstanceOf(Date);

      // The result should have deletedAt set
      expect(result).toBeDefined();
      expect((result as unknown as Record<string, unknown>).deletedAt).toBeInstanceOf(Date);
    });

    it('should return null for a document owned by a different tenant', async () => {
      mockModel.execResults.findOneAndUpdate = null;

      const result = await repo.softDelete('other-tenant-doc');

      expect(result).toBeNull();
      const updateFn = mockModel.model.findOneAndUpdate as ReturnType<typeof vi.fn>;
      const filter = updateFn.mock.calls[0][0] as Record<string, unknown>;
      expect(filter.tenantId).toBe(TENANT_A_ID);
    });

    it('should filter by tenantId in the softDelete query', async () => {
      await repo.softDelete('doc-id-456');

      const updateFn = mockModel.model.findOneAndUpdate as ReturnType<typeof vi.fn>;
      const filter = updateFn.mock.calls[0][0] as Record<string, unknown>;

      expect(filter._id).toBe('doc-id-456');
      expect(filter.tenantId).toBe(TENANT_A_ID);
      expect(filter.deletedAt).toBeNull(); // only soft-delete non-deleted docs
    });
  });

  // -----------------------------------------------------------------------
  // aggregate()
  // -----------------------------------------------------------------------

  describe('aggregate()', () => {
    it('should always prepend { $match: { tenantId } } as the very first stage', async () => {
      const userPipeline = [
        { $group: { _id: '$status', total: { $sum: '$amount' } } },
      ];

      await repo.aggregate(userPipeline);

      const aggFn = mockModel.model.aggregate as ReturnType<typeof vi.fn>;
      expect(aggFn).toHaveBeenCalledTimes(1);

      const pipeline = aggFn.mock.calls[0][0] as Record<string, unknown>[];

      // First stage MUST be $match with tenantId
      expect(pipeline[0]).toEqual({ $match: { tenantId: TENANT_A_ID } });
      // Original pipeline follows
      expect(pipeline[1]).toEqual(userPipeline[0]);
    });

    it('should prepend tenantId $match even when pipeline already has a $match', async () => {
      const userPipeline = [
        { $match: { status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ];

      await repo.aggregate(userPipeline);

      const aggFn = mockModel.model.aggregate as ReturnType<typeof vi.fn>;
      const pipeline = aggFn.mock.calls[0][0] as Record<string, unknown>[];

      // First stage must be the injected tenant $match
      expect(pipeline[0]).toEqual({ $match: { tenantId: TENANT_A_ID } });
      // User's $match should be second
      expect(pipeline[1]).toEqual({ $match: { status: 'completed' } });
      // Total pipeline length = 1 (injected) + 2 (user) = 3
      expect(pipeline).toHaveLength(3);
    });

    it('should prepend tenantId $match even when pipeline is empty', async () => {
      await repo.aggregate([]);

      const aggFn = mockModel.model.aggregate as ReturnType<typeof vi.fn>;
      const pipeline = aggFn.mock.calls[0][0] as Record<string, unknown>[];

      expect(pipeline).toHaveLength(1);
      expect(pipeline[0]).toEqual({ $match: { tenantId: TENANT_A_ID } });
    });
  });

  // -----------------------------------------------------------------------
  // count()
  // -----------------------------------------------------------------------

  describe('count()', () => {
    it('should inject tenantId and deletedAt:null into the count filter', async () => {
      await repo.count({ name: 'x' } as unknown as Record<string, unknown>);

      const countFn = mockModel.model.countDocuments as ReturnType<typeof vi.fn>;
      const filter = countFn.mock.calls[0][0] as Record<string, unknown>;

      expect(filter.tenantId).toBe(TENANT_A_ID);
      expect(filter.deletedAt).toBeNull();
      expect(filter.name).toBe('x');
    });
  });

  // -----------------------------------------------------------------------
  // findOne()
  // -----------------------------------------------------------------------

  describe('findOne()', () => {
    it('should inject tenantId and deletedAt:null', async () => {
      await repo.findOne({ name: 'abc' } as unknown as Record<string, unknown>);

      const findOneFn = mockModel.model.findOne as ReturnType<typeof vi.fn>;
      const filter = findOneFn.mock.calls[0][0] as Record<string, unknown>;

      expect(filter.tenantId).toBe(TENANT_A_ID);
      expect(filter.deletedAt).toBeNull();
      expect(filter.name).toBe('abc');
    });
  });
});
