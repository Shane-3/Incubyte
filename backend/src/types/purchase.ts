import type { Category } from './vehicle';

/** One sale as admins see it in the purchases feed. */
export interface PurchaseView {
  id: string;
  quantity: number;
  unitPrice: number;
  total: number;
  createdAt: Date;
  vehicle: { id: string; make: string; model: string; sku: string; category: Category };
  /** Null when the sale predates colours or its colour was later removed. */
  colour: { name: string; hex: string } | null;
  buyer: { id: string; name: string; email: string };
}

export interface PurchaseTotals {
  orders: number;
  units: number;
  revenue: number;
}

export const PURCHASE_PERIODS = [7, 30, 90] as const;
export type PurchasePeriod = (typeof PURCHASE_PERIODS)[number];
