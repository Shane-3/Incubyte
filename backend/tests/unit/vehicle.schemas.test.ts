import {
  createVehicleSchema,
  searchQuerySchema,
  updateVehicleSchema,
  vehicleIdSchema,
} from '../../src/validators/vehicle.schemas';

const camry = { make: 'Toyota', model: 'Camry', category: 'Sedan', price: 27999.99, quantity: 5 };

function failedFields(result: { error?: { issues: Array<{ path: PropertyKey[] }> } }) {
  return result.error?.issues.map((issue) => issue.path.join('.')) ?? [];
}

describe('createVehicleSchema', () => {
  it('accepts a valid vehicle and trims text', () => {
    const result = createVehicleSchema.safeParse({ ...camry, make: ' Toyota ', model: 'Camry  ' });

    expect(result.data).toEqual(camry);
  });

  it.each([
    'Mercedes-Benz',
    'Land Rover',
    'Citroën',
    'Model 3',
    'F-150',
    'C-HR',
    'e-tron GT',
    '911 (992)',
    'Rolls-Royce',
  ])('accepts the real-world name %s', (make) => {
    expect(createVehicleSchema.safeParse({ ...camry, make }).success).toBe(true);
  });

  it('normalises category case to the canonical name', () => {
    expect(createVehicleSchema.parse({ ...camry, category: 'suv' }).category).toBe('SUV');
  });

  it('rejects a category outside the fixed list', () => {
    expect(failedFields(createVehicleSchema.safeParse({ ...camry, category: 'Spaceship' }))).toEqual(['category']);
  });

  it.each([
    ['<script>alert(1)</script>'],
    ['<img src=x onerror=alert(1)>'],
    ['"><svg onload=alert(1)>'],
    ['Line\nBreak'],
    [''],
    ['x'.repeat(101)],
  ])('rejects the unsafe or out-of-range name %j', (make) => {
    expect(failedFields(createVehicleSchema.safeParse({ ...camry, make }))).toEqual(['make']);
  });

  it.each([-1, 100_000_000, 10.005, Number.NaN, '27999'])('rejects the price %j', (price) => {
    expect(failedFields(createVehicleSchema.safeParse({ ...camry, price }))).toEqual(['price']);
  });

  it('accepts a zero price and zero stock', () => {
    expect(createVehicleSchema.safeParse({ ...camry, price: 0, quantity: 0 }).success).toBe(true);
  });

  it.each([-1, 1.5, 100_001, '5'])('rejects the quantity %j', (quantity) => {
    expect(failedFields(createVehicleSchema.safeParse({ ...camry, quantity }))).toEqual(['quantity']);
  });

  it('reports every missing field', () => {
    expect(failedFields(createVehicleSchema.safeParse({}))).toEqual(['make', 'model', 'category', 'price', 'quantity']);
  });

  it('rejects client-controlled fields such as id and timestamps', () => {
    expect(createVehicleSchema.safeParse({ ...camry, id: 'x' }).success).toBe(false);
    expect(createVehicleSchema.safeParse({ ...camry, createdAt: '2020-01-01' }).success).toBe(false);
  });
});

describe('updateVehicleSchema', () => {
  it('accepts a partial update', () => {
    expect(updateVehicleSchema.parse({ price: 25999 })).toEqual({ price: 25999 });
  });

  it('rejects an empty update', () => {
    expect(updateVehicleSchema.safeParse({}).success).toBe(false);
  });

  it('applies the same field rules as create', () => {
    expect(failedFields(updateVehicleSchema.safeParse({ quantity: -3 }))).toEqual(['quantity']);
  });

  it('rejects unknown fields', () => {
    expect(updateVehicleSchema.safeParse({ price: 1, id: 'x' }).success).toBe(false);
  });
});

describe('searchQuerySchema', () => {
  it('applies defaults when the query is empty', () => {
    expect(searchQuerySchema.parse({})).toEqual({ sort: 'make', order: 'asc', limit: 25, offset: 0 });
  });

  it('parses filters from query-string values', () => {
    const query = searchQuerySchema.parse({
      make: 'toyota',
      category: 'suv',
      minPrice: '10000',
      maxPrice: '30000',
      sort: 'price',
      order: 'desc',
      limit: '50',
      offset: '50',
    });

    expect(query).toEqual({
      make: 'toyota',
      category: 'SUV',
      minPrice: 10000,
      maxPrice: 30000,
      sort: 'price',
      order: 'desc',
      limit: 50,
      offset: 50,
    });
  });

  it('rejects a minimum price above the maximum', () => {
    expect(failedFields(searchQuerySchema.safeParse({ minPrice: '30000', maxPrice: '10000' }))).toEqual(['minPrice']);
  });

  it.each([
    ['minPrice', { minPrice: "1' OR '1'='1" }],
    ['maxPrice', { maxPrice: '-5' }],
    ['sort', { sort: 'password_hash' }],
    ['sort', { sort: 'price; DROP TABLE vehicles' }],
    ['order', { order: 'sideways' }],
    ['limit', { limit: '100000' }],
    ['limit', { limit: '0' }],
    ['offset', { offset: '-1' }],
    ['make', { make: ['a', 'b'] }],
    ['category', { category: 'Spaceship' }],
    ['stock', { stock: 'some' }],
  ])('rejects an invalid %s', (field, query) => {
    expect(failedFields(searchQuerySchema.safeParse(query))).toEqual([field]);
  });

  it.each(['in', 'low', 'out'])('accepts the stock status %s', (stock) => {
    expect(searchQuerySchema.parse({ stock }).stock).toBe(stock);
  });

  it('allows wildcard characters in text filters, to be matched literally by the repository', () => {
    expect(searchQuerySchema.parse({ make: '100%_' }).make).toBe('100%_');
  });
});

describe('vehicleIdSchema', () => {
  it('accepts a UUID', () => {
    expect(vehicleIdSchema.safeParse({ id: '3f2c1d4e-5a6b-4c7d-8e9f-0a1b2c3d4e5f' }).success).toBe(true);
  });

  it.each(['1', "1' OR '1'='1", 'not-a-uuid'])('rejects %j', (id) => {
    expect(failedFields(vehicleIdSchema.safeParse({ id }))).toEqual(['id']);
  });
});
