import { z } from 'zod';
import { CATEGORIES, type Category, SORT_FIELDS, STOCK_STATUSES } from '../types/vehicle';

export const MAX_PRICE = 99_999_999.99;
export const MAX_QUANTITY = 100_000;
export const MAX_PAGE_SIZE = 100;
export const MAX_PURCHASE_QUANTITY = 10;

// Letters, digits and the punctuation real make/model names use. Rejects <, >, quotes and control characters.
const NAME_PATTERN = /^[\p{L}\p{M}\p{N} .,'&()/+-]+$/u;
// Search text is matched literally (LIKE wildcards are escaped by the repository), so only markup and control
// characters are refused here.
const SEARCH_TEXT_PATTERN = /^[^\p{C}<>]+$/u;

const name = z
  .string()
  .trim()
  .min(1, { message: 'is required', abort: true })
  .max(100, { message: 'must be at most 100 characters', abort: true })
  .regex(NAME_PATTERN, 'contains characters that are not allowed');

const category = z
  .string()
  .trim()
  .transform((value, ctx): Category => {
    const match = CATEGORIES.find((c) => c.toLowerCase() === value.toLowerCase());
    if (!match) {
      ctx.addIssue({ code: 'custom', message: `must be one of ${CATEGORIES.join(', ')}` });
      return z.NEVER;
    }
    return match;
  });

const hasAtMostTwoDecimals = (value: number) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6;

const price = z
  .number()
  .min(0, 'must be 0 or more')
  .max(MAX_PRICE, `must be at most ${MAX_PRICE}`)
  .refine(hasAtMostTwoDecimals, 'must have at most 2 decimal places');

const quantity = z
  .number()
  .int('must be a whole number')
  .min(0, 'must be 0 or more')
  .max(MAX_QUANTITY, `must be at most ${MAX_QUANTITY}`);

// Paint names like "Wind Chill Pearl", "Soul Red Crystal Metallic" or "Grigio Telesto (Mk II)".
const COLOUR_NAME_PATTERN = /^[\p{L}\p{M}\p{N} .,'&()/+-]+$/u;

const colour = z.strictObject({
  name: z
    .string()
    .trim()
    .min(1, { message: 'is required', abort: true })
    .max(40, { message: 'must be at most 40 characters', abort: true })
    .regex(COLOUR_NAME_PATTERN, 'contains characters that are not allowed'),
  // Only #rrggbb ever reaches the SVG fill attribute.
  hex: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'must be a colour like #a3161a')
    .transform((value) => value.toLowerCase()),
});

export const MAX_COLOURS_PER_REQUEST = 12;

const colours = z
  .array(colour.extend({ quantity }))
  .min(1, 'must list at least one colour')
  .max(MAX_COLOURS_PER_REQUEST, `must list at most ${MAX_COLOURS_PER_REQUEST} colours`)
  .superRefine((list, ctx) => {
    const seen = new Set<string>();
    list.forEach((c, i) => {
      const key = c.name.toLowerCase();
      if (seen.has(key)) ctx.addIssue({ code: 'custom', path: [i, 'name'], message: 'is listed twice' });
      seen.add(key);
    });
  });

const modelFields = { make: name, model: name, category, price, quantity };

/**
 * One colour for all of `quantity`, or several `colours` with their own units totalling `quantity`. Adding an
 * existing make + model adds the colours (or units of them) to that model.
 */
export const createVehicleSchema = z
  .strictObject({ ...modelFields, colour: colour.optional(), colours: colours.optional() })
  .superRefine((input, ctx) => {
    if (!input.colours) return;
    if (input.colour) {
      ctx.addIssue({ code: 'custom', path: ['colours'], message: 'send either colour or colours, not both' });
      return;
    }
    const total = input.colours.reduce((sum, c) => sum + c.quantity, 0);
    if (input.quantity !== total) {
      ctx.addIssue({ code: 'custom', path: ['quantity'], message: `must equal the total of the colours (${total})` });
    }
  });

export const updateVehicleSchema = z
  .strictObject(modelFields)
  .partial()
  .refine((changes) => Object.keys(changes).length > 0, 'must include at least one field to update');

/** Query strings arrive as text; an empty value means "no filter". */
const optionalQuery = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (value === '' ? undefined : value), schema.optional());

const searchText = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .regex(SEARCH_TEXT_PATTERN, 'contains characters that are not allowed');
const queryPrice = z.coerce.number().min(0, 'must be 0 or more').max(MAX_PRICE);

export const searchQuerySchema = z
  .strictObject({
    make: optionalQuery(searchText),
    model: optionalQuery(searchText),
    category: optionalQuery(category),
    minPrice: optionalQuery(queryPrice),
    maxPrice: optionalQuery(queryPrice),
    stock: optionalQuery(z.enum(STOCK_STATUSES)),
    colour: optionalQuery(searchText),
    sort: z.enum(SORT_FIELDS).default('make'),
    order: z.enum(['asc', 'desc']).default('asc'),
    limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(25),
    offset: z.coerce.number().int().min(0).max(1_000_000).default(0),
  })
  .refine((q) => q.minPrice === undefined || q.maxPrice === undefined || q.minPrice <= q.maxPrice, {
    message: 'must not be greater than maxPrice',
    path: ['minPrice'],
  });

export const purchaseSchema = z.strictObject({
  quantity: quantity
    .min(1, 'must be at least 1')
    .max(MAX_PURCHASE_QUANTITY, `must be at most ${MAX_PURCHASE_QUANTITY}`)
    .default(1),
  /** Optional: without it the sale comes from the best-stocked colour. */
  colourId: z.uuid('must be a valid id').optional(),
});

export const restockSchema = z.strictObject({
  quantity: quantity.min(1, 'must be at least 1'),
  /** Required by the service when the model has several colours. */
  colourId: z.uuid('must be a valid id').optional(),
  colours: z.never().optional(),
});

/** For endpoints that take no body: anything sent is a client trying to set fields it does not own. */
export const emptyBodySchema = z.strictObject({});

export const vehicleIdSchema = z.strictObject({ id: z.uuid('must be a valid id') });

export type CreateVehicleBody = z.infer<typeof createVehicleSchema>;
export type UpdateVehicleBody = z.infer<typeof updateVehicleSchema>;
export type SearchQuery = z.infer<typeof searchQuerySchema>;
export type PurchaseBody = z.infer<typeof purchaseSchema>;
export type RestockBody = z.infer<typeof restockSchema>;
