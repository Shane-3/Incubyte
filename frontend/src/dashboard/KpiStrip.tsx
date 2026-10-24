import { ChevronRight } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';
import type { InventoryStats } from '../api/types';
import { formatCurrencyTotal, formatInteger, pluralise } from '../lib/format';
import { LOW_STOCK_THRESHOLD } from './StockStatus';

type Tone = 'low' | 'out';

interface Tile {
  label: string;
  value: string;
  /** One line that makes the number readable: what it covers or what it means. */
  context: string;
  /** Status tiles open their filtered view. */
  to?: string;
  matches?: (params: URLSearchParams) => boolean;
  /** Status dot; always next to a text label, so state never rests on colour alone. */
  tone?: Tone;
}

const DOT: Record<Tone, string> = { low: 'bg-low', out: 'bg-out' };

interface KpiStripProps {
  stats?: InventoryStats;
  /** Admins only: vehicles the forecast expects to sell out soon. */
  atRisk?: number;
  atRiskDays?: number;
}

/** Headline numbers with context; the status ones open the matching view. Derived from live data. */
export function KpiStrip({ stats, atRisk, atRiskDays = 7 }: KpiStripProps) {
  const [params] = useSearchParams();
  const dash = '—';
  const blank = ' ';
  const tiles: Tile[] = [
    {
      label: 'Units in stock',
      value: stats ? formatInteger(stats.units) : dash,
      context: stats ? `across ${pluralise(stats.models, 'model')}` : blank,
    },
    {
      label: 'Inventory value',
      value: stats ? formatCurrencyTotal(stats.inventoryValue) : dash,
      context:
        stats && stats.units > 0 ? `avg ${formatCurrencyTotal(stats.inventoryValue / stats.units)} per unit` : blank,
    },
    {
      label: 'Low stock',
      value: stats ? formatInteger(stats.lowStock) : dash,
      context: `${LOW_STOCK_THRESHOLD} or fewer left`,
      to: '/?stock=low',
      matches: (p) => p.get('stock') === 'low',
      tone: 'low',
    },
    {
      label: 'Out of stock',
      value: stats ? formatInteger(stats.outOfStock) : dash,
      context: 'sold out in every colour',
      to: '/?stock=out',
      matches: (p) => p.get('stock') === 'out',
      tone: 'out',
    },
  ];
  if (atRisk !== undefined) {
    tiles.push({
      label: 'At risk',
      value: formatInteger(atRisk),
      context: `may sell out within ${atRiskDays} days`,
      to: '/?view=at-risk',
      matches: (p) => p.get('view') === 'at-risk',
      tone: 'low',
    });
  }

  return (
    <section aria-label="Inventory summary">
      {/* Flex-wrap with growing tiles, so every row is filled whatever the tile count and width. */}
      <dl className="flex flex-wrap gap-px overflow-hidden rounded-panel border border-border bg-border">
        {tiles.map((tile) => {
          const active = tile.matches?.(params) ?? false;
          return (
            <div
              key={tile.label}
              data-kpi
              className={`group relative flex min-w-40 flex-[1_1_10rem] flex-col gap-0.5 bg-surface px-4 py-3 transition-colors ${
                tile.to ? 'hover:bg-surface-hover' : ''
              } ${active ? 'bg-surface-hover shadow-[inset_0_-2px_0_var(--accent)]' : ''}`}
            >
              <dt className="flex items-center gap-1.5 text-xs text-muted">
                {tile.tone && <span aria-hidden="true" className={`size-1.5 rounded-full ${DOT[tile.tone]}`} />}
                {tile.label}
              </dt>
              <dd className="text-2xl leading-8 font-semibold tracking-tight">{tile.value}</dd>
              <dd className="text-xs text-muted">
                {tile.to ? (
                  // Stretched link: the ::after overlay makes the whole tile the click target.
                  <Link
                    to={tile.to}
                    aria-label={`Show ${tile.label.toLowerCase()}: ${tile.context}`}
                    aria-current={active ? 'page' : undefined}
                    className="after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-accent"
                  >
                    {tile.context}
                  </Link>
                ) : (
                  tile.context
                )}
              </dd>
              {tile.to && (
                <ChevronRight
                  aria-hidden="true"
                  className="absolute top-3 right-3 size-3.5 text-muted opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
                  strokeWidth={1.75}
                />
              )}
            </div>
          );
        })}
      </dl>
    </section>
  );
}
