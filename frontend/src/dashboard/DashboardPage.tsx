import { Plus } from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import type { SortField, Vehicle } from '../api/types';
import { AppShell } from '../app/AppShell';
import { useAuth } from '../auth/AuthProvider';
import { Button } from '../components/ui/Button';
import type { MenuItem } from '../components/ui/Menu';
import { pluralise } from '../lib/format';
import { KpiStrip } from './KpiStrip';
import { Pagination } from './Pagination';
import { RowControls } from './RowControls';
import { Toolbar } from './Toolbar';
import { useForecast, useStats, useVehicles } from './queries';
import { type Filters, toVehicleQuery, useFilters } from './useFilters';
import { type Panel, VehiclePanels } from './VehiclePanels';
import { VehicleTable } from './VehicleTable';

const SORT_CHOICES: Array<{ value: `${SortField}:${'asc' | 'desc'}`; label: string }> = [
  { value: 'make:asc', label: 'Make, A to Z' },
  { value: 'price:asc', label: 'Price, low to high' },
  { value: 'price:desc', label: 'Price, high to low' },
  { value: 'quantity:asc', label: 'Stock, lowest first' },
  { value: 'createdAt:desc', label: 'Newest first' },
];

/** Column headers are hidden on small screens, so sorting moves into a select there. */
function MobileSort({
  value,
  onChange,
}: {
  value: string;
  onChange: (sort: SortField, order: 'asc' | 'desc') => void;
}) {
  const id = useId();
  return (
    <div className="flex items-center gap-2 md:hidden">
      <label htmlFor={id} className="text-sm text-muted">
        Sort by
      </label>
      <select
        id={id}
        value={SORT_CHOICES.some((c) => c.value === value) ? value : ''}
        onChange={(e) => {
          const [sort, order] = e.target.value.split(':') as [SortField, 'asc' | 'desc'];
          onChange(sort, order);
        }}
        className="h-8 flex-1 rounded-control border border-border-strong bg-surface px-2 text-base text-text"
      >
        {!SORT_CHOICES.some((c) => c.value === value) && <option value="">Custom</option>}
        {SORT_CHOICES.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function emptyMessage(hasFilters: boolean, stock: Filters['stock'], view: Filters['view']): string {
  if (hasFilters) return 'No vehicles match your filters';
  if (view === 'at-risk') return 'Nothing is at risk of selling out this week';
  if (stock === 'low') return 'No vehicles are running low';
  if (stock === 'out') return 'Nothing is sold out';
  return 'No vehicles yet. Add the first one to start tracking stock.';
}

export function DashboardPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { filters, update, clear, hasFilters } = useFilters();
  const query = useMemo(() => toVehicleQuery(filters), [filters]);
  const vehicles = useVehicles(query);
  const stats = useStats();
  const forecast = useForecast(isAdmin);
  const [panel, setPanel] = useState<Panel | null>(null);

  const forecastById = useMemo(
    () => (isAdmin ? new Map((forecast.data?.data ?? []).map((f) => [f.vehicleId, f])) : undefined),
    [forecast.data, isAdmin],
  );
  const atRiskCount = isAdmin && forecast.data ? forecast.data.data.filter((f) => f.atRisk).length : undefined;

  const rows = useMemo(() => {
    const all = vehicles.data?.data ?? [];
    if (filters.view !== 'at-risk' || !forecastById) return all;
    return all.filter((v) => forecastById.get(v.id)?.atRisk);
  }, [vehicles.data, filters.view, forecastById]);
  const count = filters.view === 'at-risk' ? rows.length : (vehicles.data?.count ?? 0);

  function onSort(field: SortField) {
    const order = filters.sort === field && filters.order === 'asc' ? 'desc' : 'asc';
    update({ sort: field, order });
  }

  const menuFor = (vehicle: Vehicle): MenuItem[] => {
    const items: MenuItem[] = [{ label: 'Edit', onSelect: () => setPanel({ kind: 'edit', vehicle }) }];
    if (isAdmin) {
      items.push({ label: 'Restock', onSelect: () => setPanel({ kind: 'restock', vehicle }) });
      items.push({ label: 'Delete', onSelect: () => setPanel({ kind: 'delete', vehicle }), tone: 'danger' });
    }
    return items;
  };

  const primaryFor = (v: Vehicle) => <RowControls vehicle={v} />;

  return (
    <AppShell>
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Inventory</h1>
            <p className="text-sm text-muted">{vehicles.data ? pluralise(count, 'vehicle') : ' '}</p>
          </div>
          <Button variant="primary" onClick={() => setPanel({ kind: 'add' })}>
            <Plus aria-hidden="true" className="size-4" strokeWidth={1.75} />
            Add vehicle
          </Button>
        </div>

        <KpiStrip stats={stats.data} atRisk={atRiskCount} />

        <Toolbar filters={filters} hasFilters={hasFilters} onChange={update} onClear={clear} />

        <MobileSort value={`${filters.sort}:${filters.order}`} onChange={(sort, order) => update({ sort, order })} />

        {vehicles.isError ? (
          <div
            role="alert"
            className="flex items-center justify-between gap-3 rounded-panel border border-out/40 bg-surface px-4 py-3"
          >
            <p>
              <span className="font-medium">Couldn&apos;t load vehicles.</span>{' '}
              <span className="text-muted">{vehicles.error.message}</span>
            </p>
            <Button size="sm" onClick={() => void vehicles.refetch()}>
              Retry
            </Button>
          </div>
        ) : !vehicles.isPending && rows.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-panel border border-border bg-surface px-6 py-16 text-center">
            <p className="font-medium">{emptyMessage(hasFilters, filters.stock, filters.view)}</p>
            {hasFilters && (
              <Button size="sm" onClick={clear}>
                Clear filters
              </Button>
            )}
          </div>
        ) : (
          <VehicleTable
            vehicles={rows}
            loading={vehicles.isFetching}
            sort={filters.sort}
            order={filters.order}
            onSort={onSort}
            forecastById={forecastById}
            actions={{ primary: primaryFor, menu: menuFor }}
            footer={
              filters.view !== 'at-risk' && (
                <Pagination
                  page={filters.page}
                  pageSize={filters.pageSize}
                  count={count}
                  onPage={(page) => update({ page })}
                  onPageSize={(pageSize) => update({ pageSize })}
                />
              )
            }
          />
        )}
      </div>
      <VehiclePanels
        panel={panel}
        onClose={() => setPanel(null)}
        forecastById={forecastById}
        windowDays={forecast.data?.windowDays}
      />
    </AppShell>
  );
}
