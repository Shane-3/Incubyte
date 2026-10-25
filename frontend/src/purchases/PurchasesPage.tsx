import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { PURCHASE_PERIODS, type PurchasePeriod, type PurchaseQuery } from '../api/types';
import { AppShell } from '../app/AppShell';
import { Button } from '../components/ui/Button';
import { Freshness } from '../dashboard/Freshness';
import { Pagination } from '../dashboard/Pagination';
import { queryKeys, usePurchases } from '../dashboard/queries';
import { PAGE_SIZES } from '../dashboard/useFilters';
import { pluralise } from '../lib/format';
import { PeriodPicker } from './PeriodPicker';
import { PurchasesTable } from './PurchasesTable';
import { SalesSummary } from './SalesSummary';

const DEFAULT_DAYS: PurchasePeriod = 30;
const DEFAULT_PAGE_SIZE = 25;

interface FeedParams {
  days: PurchasePeriod;
  page: number;
  pageSize: number;
}

/** Period and page live in the URL, like the inventory filters; defaults are left out. A new period restarts paging. */
function useFeedParams() {
  const [params, setParams] = useSearchParams();

  const current = useMemo<FeedParams>(() => {
    const page = Number(params.get('page'));
    const pageSize = Number(params.get('pageSize'));
    return {
      days: PURCHASE_PERIODS.find((d) => String(d) === params.get('days')) ?? DEFAULT_DAYS,
      page: Number.isInteger(page) && page > 0 ? page : 1,
      pageSize: (PAGE_SIZES as readonly number[]).includes(pageSize) ? pageSize : DEFAULT_PAGE_SIZE,
    };
  }, [params]);

  const update = useCallback(
    (changes: Partial<FeedParams>) => {
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        const defaults: FeedParams = { days: DEFAULT_DAYS, page: 1, pageSize: DEFAULT_PAGE_SIZE };
        for (const [key, value] of Object.entries(changes) as Array<[keyof FeedParams, number]>) {
          if (value === defaults[key]) next.delete(key);
          else next.set(key, String(value));
        }
        if (!('page' in changes)) next.delete('page');
        return next;
      });
    },
    [setParams],
  );

  return { params: current, update };
}

export function PurchasesPage() {
  const { params, update } = useFeedParams();
  const query = useMemo<PurchaseQuery>(
    () => ({ days: params.days, limit: params.pageSize, offset: (params.page - 1) * params.pageSize }),
    [params],
  );
  const purchases = usePurchases(query);
  const queryClient = useQueryClient();
  const feed = purchases.data;

  return (
    <AppShell>
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Purchases</h1>
            <p className="flex items-center gap-2 text-sm text-muted">
              <span>{feed ? `${pluralise(feed.count, 'sale')}, newest first` : ' '}</span>
              {purchases.dataUpdatedAt > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <Freshness
                    updatedAt={purchases.dataUpdatedAt}
                    refreshing={purchases.isFetching}
                    onRefresh={() => void queryClient.invalidateQueries({ queryKey: queryKeys.allPurchases })}
                  />
                </>
              )}
            </p>
          </div>
          <PeriodPicker value={params.days} onChange={(days) => update({ days })} />
        </div>

        <SalesSummary feed={feed} />

        {purchases.isError ? (
          <div
            role="alert"
            className="flex items-center justify-between gap-3 rounded-panel border border-out/40 bg-surface px-4 py-3"
          >
            <p>
              <span className="font-medium">Couldn&apos;t load purchases.</span>{' '}
              <span className="text-muted">{purchases.error.message}</span>
            </p>
            <Button size="sm" onClick={() => void purchases.refetch()}>
              Retry
            </Button>
          </div>
        ) : feed && feed.data.length === 0 ? (
          <div className="flex flex-col items-center gap-1 rounded-panel border border-border bg-surface px-6 py-16 text-center">
            <p className="font-medium">No purchases in the last {params.days} days</p>
            <p className="text-sm text-muted">Sales appear here as soon as they are made.</p>
          </div>
        ) : (
          <PurchasesTable
            purchases={feed?.data ?? []}
            loading={purchases.isFetching}
            footer={
              <Pagination
                page={params.page}
                pageSize={params.pageSize}
                count={feed?.count ?? 0}
                onPage={(page) => update({ page })}
                onPageSize={(pageSize) => update({ pageSize })}
              />
            }
          />
        )}
      </div>
    </AppShell>
  );
}
