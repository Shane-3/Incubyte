import {
  createVehicleSchema,
  purchaseSchema,
  restockSchema,
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

  it('rejects client-controlled fields such as id, sku and timestamps', () => {
    expect(createVehicleSchema.safeParse({ ...camry, id: 'x' }).success).toBe(false);
    expect(createVehicleSchema.safeParse({ ...camry, sku: 'MINE-1' }).success).toBe(false);
    expect(createVehicleSchema.safeParse({ ...camry, createdAt: '2020-01-01' }).success).toBe(false);
  });

  describe('colour', () => {
    it('is optional', () => {
      expect(createVehicleSchema.parse(camry)).not.toHaveProperty('colour');
    });

    it('accepts a paint name and a hex value, trimmed and lower-cased', () => {
      const parsed = createVehicleSchema.parse({ ...camry, colour: { name: ' Supersonic Red ', hex: '#A3161A' } });

      expect(parsed.colour).toEqual({ name: 'Supersonic Red', hex: '#a3161a' });
    });

    it.each([
      [{ name: '', hex: '#a3161a' }, 'colour.name'],
      [{ name: '<b>Red</b>', hex: '#a3161a' }, 'colour.name'],
      [{ name: 'x'.repeat(41), hex: '#a3161a' }, 'colour.name'],
      [{ name: 'Red', hex: 'red' }, 'colour.hex'],
      [{ name: 'Red', hex: '#a3161' }, 'colour.hex'],
      [{ name: 'Red', hex: 'url(javascript:alert(1))' }, 'colour.hex'],
    ])('rejects %j', (colour, field) => {
      expect(failedFields(createVehicleSchema.safeParse({ ...camry, colour }))).toEqual([field]);
    });

    it('rejects unknown colour fields', () => {
      expect(
        createVehicleSchema.safeParse({ ...camry, colour: { name: 'Red', hex: '#a3161a', id: 'x' } }).success,
      ).toBe(false);
    });
  });

  describe('colours (several at once, each with its own units)', () => {
    const red = { name: 'Supersonic Red', hex: '#a3161a', quantity: 2 };
    const white = { name: 'Wind Chill Pearl', hex: '#edede8', quantity: 3 };

    it('accepts a list whose units add up to the quantity', () => {
      const parsed = createVehicleSchema.parse({ ...camry, quantity: 5, colours: [red, { ...white, hex: '#EDEDE8' }] });

      expect(parsed.colours).toEqual([red, white]);
    });

    it('requires the quantity to be the total of the colours', () => {
      expect(failedFields(createVehicleSchema.safeParse({ ...camry, quantity: 9, colours: [red, white] }))).toEqual([
        'quantity',
      ]);
    });

    it.each([
      [[{ ...red, quantity: -1 }], 'colours.0.quantity'],
      [[{ ...red, quantity: 1.5 }], 'colours.0.quantity'],
      [[{ ...red, hex: 'red' }], 'colours.0.hex'],
      [[red, { ...white, name: 'SUPERSONIC RED' }], 'colours.1.name'],
      [[], 'colours'],
      [Array.from({ length: 13 }, (_, i) => ({ ...red, name: `Red ${i}`, quantity: 0 })), 'colours'],
    ])('rejects %j', (colours, field) => {
      const total = (colours as Array<{ quantity: number }>).reduce((sum, c) => sum + (c.quantity > 0 ? c.quantity : 0), 0);
      expect(failedFields(createVehicleSchema.safeParse({ ...camry, quantity: total, colours }))).toContain(field);
    });

    it('refuses colour and colours together', () => {
      const result = createVehicleSchema.safeParse({
        ...camry,
        quantity: 2,
        colour: { name: 'Red', hex: '#a3161a' },
        colours: [red],
      });

      expect(failedFields(result)).toEqual(['colours']);
    });
  });
});

describe('purchaseSchema and restockSchema', () => {
  const colourId = '3f2c1d4e-5a6b-4c7d-8e9f-0a1b2c3d4e5f';

  it('accept an optional colour id', () => {
    expect(purchaseSchema.parse({ quantity: 1, colourId })).toEqual({ quantity: 1, colourId });
    expect(purchaseSchema.parse({})).toEqual({ quantity: 1 });
    expect(restockSchema.parse({ quantity: 4, colourId })).toEqual({ quantity: 4, colourId });
  });

  it('reject a malformed colour id', () => {
    expect(failedFields(purchaseSchema.safeParse({ colourId: 'red' }))).toEqual(['colourId']);
    expect(failedFields(restockSchema.safeParse({ quantity: 1, colourId: "1' OR '1'='1" }))).toEqual(['colourId']);
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

  it('does not change colours or the SKU', () => {
    expect(updateVehicleSchema.safeParse({ colour: { name: 'Red', hex: '#a3161a' } }).success).toBe(false);
    expect(updateVehicleSchema.safeParse({ sku: 'NEW-SKU' }).success).toBe(false);
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

  it('accepts a colour text filter', () => {
    expect(searchQuerySchema.parse({ colour: ' red ' }).colour).toBe('red');
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
