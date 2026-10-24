import { ArrowDown, ArrowUp, ChevronsUpDown, MoreHorizontal } from 'lucide-react';
import type { ReactNode } from 'react';
import type { SortField, Vehicle, VehicleForecast } from '../api/types';
import { Menu, type MenuItem } from '../components/ui/Menu';
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
  footer?: ReactNode;
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
      className={`h-9 px-3 font-medium ${align === 'right' ? 'text-right' : 'text-left'} ${className}`}
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
        <tr key={i} className="h-11 border-t border-border">
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
  footer,
}: VehicleTableProps) {
  const showForecast = forecastById !== undefined;
  const columns = showForecast ? 6 : 5;

  return (
    <div className="overflow-hidden rounded-panel border border-border bg-surface">
      <div className="overflow-x-auto">
        <table aria-label="Vehicles" aria-busy={loading} className="w-full border-collapse text-base">
          <thead className="sticky top-0 z-10 bg-surface text-xs text-muted">
            <tr>
              <SortHeader label="Vehicle" field="make" sort={sort} order={order} onSort={onSort} />
              <SortHeader
                label="Category"
                field="category"
                sort={sort}
                order={order}
                onSort={onSort}
                className="max-md:hidden"
              />
              <SortHeader label="Price" field="price" sort={sort} order={order} onSort={onSort} align="right" />
              <SortHeader label="Stock" field="quantity" sort={sort} order={order} onSort={onSort} />
              {showForecast && (
                <th scope="col" className="h-9 px-3 text-right font-medium max-lg:hidden">
                  Days left
                </th>
              )}
              <th scope="col" className="h-9 px-3 text-right font-medium">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {loading && vehicles.length === 0 ? (
              <SkeletonRows columns={columns} />
            ) : (
              vehicles.map((v) => {
                const forecast = forecastById?.get(v.id);
                return (
                  <tr key={v.id} className="h-11 border-t border-border transition-colors hover:bg-surface-hover">
                    <td className="px-3 font-medium text-text">
                      <span className="block max-w-[28ch] truncate">{vehicleName(v)}</span>
                    </td>
                    <td className="px-3 text-muted max-md:hidden">{v.category}</td>
                    <td className="px-3 text-right tabular-nums">{formatPrice(v.price)}</td>
                    <td className="px-3">
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
