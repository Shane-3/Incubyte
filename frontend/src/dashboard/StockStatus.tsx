export const LOW_STOCK_THRESHOLD = 3;

export type StockLevel = 'in' | 'low' | 'out';

export function stockLevel(quantity: number): StockLevel {
  if (quantity === 0) return 'out';
  return quantity <= LOW_STOCK_THRESHOLD ? 'low' : 'in';
}

const LABEL: Record<StockLevel, string> = { in: 'In stock', low: 'Low', out: 'Out of stock' };
const DOT: Record<StockLevel, string> = { in: 'bg-in-stock', low: 'bg-low', out: 'bg-out' };

/** Coloured dot plus a label in body text colour, so the meaning never rests on colour alone and contrast holds. */
export function StockPill({ quantity }: { quantity: number }) {
  const level = stockLevel(quantity);
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-px text-xs text-text">
      <span aria-hidden="true" className={`size-1.5 rounded-full ${DOT[level]}`} />
      {LABEL[level]}
    </span>
  );
}

export function AtRiskPill() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-low/50 px-2 py-px text-xs text-text">
      <span aria-hidden="true" className="size-1.5 rounded-full bg-low" />
      At risk
    </span>
  );
}
