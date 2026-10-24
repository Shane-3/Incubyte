import { ArrowDown, ArrowUp, ChevronsUpDown, MoreHorizontal } from 'lucide-react';
import type { ReactNode } from 'react';
import type { SortField, Vehicle, VehicleForecast } from '../api/types';
import { Menu, type MenuItem } from '../components/ui/Menu';
import { CarIllustration } from '../components/CarIllustration';
import { bestStocked, ColourSwatches } from '../components/ColourSwatches';
import { formatPrice } from '../lib/format';
import { AtRiskPill, StockPill } from './StockStatus';

export interface RowActions {
  /** Purchase / Notify me controls for a row. */
  primary: (vehicle: Vehicle) => ReactNode;
  menu: (vehicle: Vehicle) => MenuItem[];
}

interface VehicleTableProps {
  vehicles: Vehicle[];
  loading: boolean;
  sort: SortField;
  order: 'asc' | 'desc';
  onSort: (field: SortField) => void;
  /** Present for admins only; adds the Days left column. */
  forecastById?: Map<string, VehicleForecast>;
  actions: RowActions;
  /** Opens the vehicle's detail view. */
  onOpen: (vehicle: Vehicle) => void;
  footer?: ReactNode;
}

/** The colour the thumbnail shows: the best-stocked one, so the row looks like what is on the lot. */
function thumbnailColour(v: Vehicle) {
  return bestStocked(v.colours)?.hex ?? '#8a8f98';
}

export function vehicleName(v: Pick<Vehicle, 'make' | 'model'>) {
  return `${v.make} ${v.model}`;
}

function SortHeader({
  label,
  field,
  sort,
  order,
  onSort,
  align = 'left',
  className = '',
}: {
  label: string;
  field: SortField;
  sort: SortField;
  order: 'asc' | 'desc';
  onSort: (field: SortField) => void;
  align?: 'left' | 'right';
  className?: string;
}) {
  const active = sort === field;
  const Icon = !active ? ChevronsUpDown : order === 'asc' ? ArrowUp : ArrowDown;
  return (
    <th
      scope="col"
      aria-sort={active ? (order === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={`h-9 bg-surface px-3 font-medium ${align === 'right' ? 'text-right' : 'text-left'} ${className}`}
    >
      <button
        type="button"
        onClick={() => onSort(field)}
        className={`inline-flex items-center gap-1 rounded-control hover:text-text ${active ? 'text-text' : ''} ${
          align === 'right' ? 'flex-row-reverse' : ''
        }`}
      >
        {label}
        <Icon aria-hidden="true" className="size-3.5" strokeWidth={1.5} />
      </button>
    </th>
  );
}

function SkeletonRows({ columns }: { columns: number }) {
  return (
    <>
      {Array.from({ length: 6 }, (_, i) => (
        <tr key={i} className="h-14 border-t border-border">
          {Array.from({ length: columns }, (_, j) => (
            <td key={j} className="px-3">
              <span className="block h-3 w-3/4 animate-pulse rounded bg-surface-hover" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function VehicleTable({
  vehicles,
  loading,
  sort,
  order,
  onSort,
  forecastById,
  actions,
  onOpen,
  footer,
}: VehicleTableProps) {
  const showForecast = forecastById !== undefined;
  const columns = showForecast ? 6 : 5;

  // No overflow clipping on the wrapper: row popovers and menus must be able to extend past the table.
  // Below md the rows stack (vehicle and price, then stock and actions) instead of scrolling sideways.
  return (
    <div className="rounded-panel border border-border bg-surface">
      <div>
        <table aria-label="Vehicles" aria-busy={loading} className="w-full border-collapse text-base max-md:block">
          <thead className="sticky top-12 z-10 bg-surface text-xs text-muted max-md:hidden">
            <tr>
              <SortHeader
                label="Vehicle"
                field="make"
                sort={sort}
                order={order}
                onSort={onSort}
                className="rounded-tl-panel"
              />
              <SortHeader
                label="Category"
                field="category"
                sort={sort}
                order={order}
                onSort={onSort}
                className="max-lg:hidden"
              />
              <SortHeader label="Price" field="price" sort={sort} order={order} onSort={onSort} align="right" />
              <SortHeader label="Stock" field="quantity" sort={sort} order={order} onSort={onSort} />
              {showForecast && (
                <th scope="col" className="h-9 px-3 text-right font-medium max-lg:hidden">
                  Days left
                </th>
              )}
              <th scope="col" className="h-9 rounded-tr-panel bg-surface px-3 text-right font-medium">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="max-md:block">
            {loading && vehicles.length === 0 ? (
              <SkeletonRows columns={columns} />
            ) : (
              vehicles.map((v) => {
                const forecast = forecastById?.get(v.id);
                return (
                  <tr
                    key={v.id}
                    className="h-14 border-t border-border transition-colors hover:bg-surface-hover max-md:grid max-md:h-auto max-md:grid-cols-[minmax(0,1fr)_auto] max-md:items-center max-md:gap-x-3 max-md:gap-y-2 max-md:py-3 max-md:first:border-t-0"
                  >
                    <td className="px-3 py-1.5">
                      <span className="flex items-center gap-3">
                        <CarIllustration
                          category={v.category}
                          hex={thumbnailColour(v)}
                          className="h-7 w-[70px] shrink-0 max-sm:hidden"
                        />
                        <span className="min-w-0">
                          <button
                            type="button"
                            onClick={() => onOpen(v)}
                            className="block max-w-[28ch] truncate text-left font-medium text-text hover:underline"
                          >
                            {vehicleName(v)}
                          </button>
                          <span className="mt-0.5 flex items-center gap-2">
                            <span className="font-mono text-xs text-muted">{v.sku}</span>
                            <ColourSwatches colours={v.colours} label={`Colours of ${vehicleName(v)}`} />
                          </span>
                        </span>
                      </span>
                    </td>
                    <td className="px-3 text-muted max-lg:hidden">{v.category}</td>
                    <td className="px-3 text-right whitespace-nowrap tabular-nums">{formatPrice(v.price)}</td>
                    <td className="px-3 whitespace-nowrap">
                      <span className="inline-flex items-center gap-2">
                        <span className="w-8 text-right tabular-nums">{v.quantity}</span>
                        <StockPill quantity={v.quantity} />
                      </span>
                    </td>
                    {showForecast && (
                      <td className="px-3 text-right max-lg:hidden">
                        <span className="inline-flex items-center justify-end gap-2">
                          {forecast?.atRisk && <AtRiskPill />}
                          <span className="tabular-nums">
                            {forecast?.daysOfStockLeft == null ? '—' : String(forecast.daysOfStockLeft)}
                          </span>
                        </span>
                      </td>
                    )}
                    <td className="px-3">
                      <span className="flex items-center justify-end gap-1.5">
                        {actions.primary(v)}
                        <Menu
                          label={`More actions for ${vehicleName(v)}`}
                          trigger={<MoreHorizontal aria-hidden="true" className="size-4" strokeWidth={1.5} />}
                          items={actions.menu(v)}
                        />
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {footer}
    </div>
  );
}
