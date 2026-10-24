import type { InventoryStats } from '../api/types';
import { formatCurrencyTotal, formatInteger } from '../lib/format';

interface Tile {
  label: string;
  value: string;
}

/** Compact stat tiles with hairline borders, derived from live data, never hard-coded. */
export function KpiStrip({ stats, atRisk }: { stats?: InventoryStats; atRisk?: number }) {
  const dash = '—';
  const tiles: Tile[] = [
    { label: 'Models', value: stats ? formatInteger(stats.models) : dash },
    { label: 'Units in stock', value: stats ? formatInteger(stats.units) : dash },
    { label: 'Inventory value', value: stats ? formatCurrencyTotal(stats.inventoryValue) : dash },
    { label: 'Out of stock', value: stats ? formatInteger(stats.outOfStock) : dash },
  ];
  if (atRisk !== undefined) tiles.push({ label: 'At risk', value: formatInteger(atRisk) });

  return (
    <section aria-label="Inventory summary">
      {/* Flex-wrap with growing tiles, so every row is filled whatever the tile count and width. */}
      <dl className="flex flex-wrap gap-px overflow-hidden rounded-panel border border-border bg-border">
        {tiles.map((tile) => (
          <div key={tile.label} className="flex min-w-36 flex-[1_1_9rem] flex-col gap-1 bg-surface px-4 py-3">
            <dt className="text-xs text-muted">{tile.label}</dt>
            <dd className="text-xl font-semibold tabular-nums">{tile.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
