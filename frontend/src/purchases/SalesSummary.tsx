import type { PurchaseFeed } from '../api/types';
import { formatCurrencyTotal, formatInteger } from '../lib/format';

/** The period's headline numbers, each with a line that makes it readable. Same tile style as the inventory. */
export function SalesSummary({ feed }: { feed?: PurchaseFeed }) {
  const dash = '—';
  const blank = ' ';
  const s = feed?.summary;
  const tiles = [
    {
      label: 'Orders',
      value: s ? formatInteger(s.orders) : dash,
      context: feed ? `in the last ${feed.days} days` : blank,
    },
    {
      label: 'Units sold',
      value: s ? formatInteger(s.units) : dash,
      context: feed && s ? `${(s.units / feed.days).toFixed(1)} a day on average` : blank,
    },
    {
      label: 'Revenue',
      value: s ? formatCurrencyTotal(s.revenue) : dash,
      context: 'at the price paid',
    },
    {
      label: 'Average order',
      value: s && s.orders > 0 ? formatCurrencyTotal(s.revenue / s.orders) : dash,
      context: s && s.orders > 0 ? `${(s.units / s.orders).toFixed(1)} units per order` : blank,
    },
  ];

  return (
    <section aria-label="Sales summary">
      <dl className="flex flex-wrap gap-px overflow-hidden rounded-panel border border-border bg-border">
        {tiles.map((tile) => (
          <div key={tile.label} className="flex min-w-40 flex-[1_1_10rem] flex-col gap-0.5 bg-surface px-4 py-3">
            <dt className="text-xs text-muted">{tile.label}</dt>
            <dd className="text-2xl leading-8 font-semibold tracking-tight">{tile.value}</dd>
            <dd className="text-xs text-muted">{tile.context}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
