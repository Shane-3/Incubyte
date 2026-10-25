import type { ReactNode } from 'react';
import { Link } from 'react-router';
import type { Purchase } from '../api/types';
import { CarIllustration } from '../components/CarIllustration';
import { Swatch } from '../components/ColourSwatches';
import { formatDateTime, formatPrice, formatRelative } from '../lib/format';

function inventoryLink(v: Purchase['vehicle']) {
  return `/?${new URLSearchParams({ make: v.make, model: v.model }).toString()}`;
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 6 }, (_, i) => (
        <tr key={i} className="h-14 border-t border-border">
          {Array.from({ length: 7 }, (_, j) => (
            <td key={j} className="px-3">
              <span className="block h-3 w-3/4 animate-pulse rounded bg-surface-hover" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

const th = 'h-9 bg-surface px-3 font-medium';

/**
 * Newest sales first. Below md each row stacks into two columns: vehicle and total, colour and time, buyer and
 * units; the cells keep their DOM order and are only reordered visually.
 */
export function PurchasesTable({
  purchases,
  loading,
  footer,
}: {
  purchases: Purchase[];
  loading: boolean;
  footer?: ReactNode;
}) {
  const now = Date.now();
  return (
    <div className="rounded-panel border border-border bg-surface">
      <table aria-label="Purchases" aria-busy={loading} className="w-full border-collapse text-base max-md:block">
        <thead className="sticky top-12 z-10 bg-surface text-xs text-muted max-md:hidden">
          <tr>
            <th scope="col" className={`${th} rounded-tl-panel text-left`}>
              When
            </th>
            <th scope="col" className={`${th} text-left`}>
              Vehicle
            </th>
            <th scope="col" className={`${th} text-left`}>
              Colour
            </th>
            <th scope="col" className={`${th} text-left`}>
              Buyer
            </th>
            <th scope="col" className={`${th} text-right`}>
              Units
            </th>
            <th scope="col" className={`${th} text-right max-lg:hidden`}>
              Unit price
            </th>
            <th scope="col" className={`${th} rounded-tr-panel text-right`}>
              Total
            </th>
          </tr>
        </thead>
        <tbody className="max-md:block">
          {loading && purchases.length === 0 ? (
            <SkeletonRows />
          ) : (
            purchases.map((p) => (
              <tr
                key={p.id}
                className="h-14 border-t border-border transition-colors hover:bg-surface-hover max-md:grid max-md:h-auto max-md:grid-cols-[minmax(0,1fr)_auto] max-md:items-center max-md:gap-x-3 max-md:gap-y-1.5 max-md:py-3 max-md:first:border-t-0"
              >
                <td className="px-3 whitespace-nowrap max-md:order-4 max-md:text-right">
                  <time dateTime={p.createdAt} title={formatDateTime(p.createdAt)} className="block">
                    <span className="block">{formatRelative(p.createdAt, Math.max(now, Date.parse(p.createdAt)))}</span>
                    <span className="block text-xs text-muted max-md:hidden">{formatDateTime(p.createdAt)}</span>
                  </time>
                </td>
                <td className="px-3 py-1.5 max-md:order-1">
                  <span className="flex items-center gap-3">
                    <CarIllustration
                      category={p.vehicle.category}
                      hex={p.colour?.hex ?? '#8a8f98'}
                      className="h-7 w-[70px] shrink-0 max-sm:hidden"
                    />
                    <span className="min-w-0">
                      <Link
                        to={inventoryLink(p.vehicle)}
                        className="block max-w-[28ch] truncate font-medium text-text hover:underline"
                      >
                        {p.vehicle.make} {p.vehicle.model}
                      </Link>
                      <span className="font-mono text-xs text-muted">{p.vehicle.sku}</span>
                    </span>
                  </span>
                </td>
                <td className="px-3 max-md:order-3">
                  {p.colour ? (
                    <span className="inline-flex items-center gap-2">
                      <Swatch hex={p.colour.hex} />
                      <span>{p.colour.name}</span>
                    </span>
                  ) : (
                    <span className="text-muted">Not recorded</span>
                  )}
                </td>
                <td className="px-3 max-md:order-5">
                  <span className="block max-w-[30ch] truncate">{p.buyer.name}</span>
                  <span className="block max-w-[30ch] truncate text-xs text-muted">{p.buyer.email}</span>
                </td>
                <td className="px-3 text-right tabular-nums max-md:order-6">
                  <span>{p.quantity}</span>
                  <span className="text-muted md:hidden"> {p.quantity === 1 ? 'unit' : 'units'}</span>
                </td>
                <td className="px-3 text-right whitespace-nowrap text-muted tabular-nums max-lg:hidden">
                  {formatPrice(p.unitPrice)}
                </td>
                <td className="px-3 text-right font-medium whitespace-nowrap tabular-nums max-md:order-2">
                  {formatPrice(p.total)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      {footer}
    </div>
  );
}
