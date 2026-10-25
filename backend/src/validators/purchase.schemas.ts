import { z } from 'zod';
import { PURCHASE_PERIODS, type PurchasePeriod } from '../types/purchase';

export const purchasesQuerySchema = z.strictObject({
  days: z
    .enum(PURCHASE_PERIODS.map(String) as ['7', '30', '90'], { message: 'must be 7, 30 or 90' })
    .default('30')
    .transform((value) => Number(value) as PurchasePeriod),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).max(1_000_000).default(0),
});

export type PurchasesQuery = z.infer<typeof purchasesQuerySchema>;
