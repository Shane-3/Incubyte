import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { CATEGORIES, type Category, type SortField, type StockStatus, type VehicleQuery } from '../api/types';

export const PAGE_SIZES = [10, 25, 50, 100] as const;
const SORT_FIELDS: SortField[] = ['make', 'model', 'category', 'price', 'quantity', 'createdAt'];
const STOCK: StockStatus[] = ['in', 'low', 'out'];

export interface Filters {
  make: string;
  colour: string;
  model: string;
  category: Category | '';
  minPrice: string;
  maxPrice: string;
  stock: StockStatus | '';
  /** Client-side view: vehicles the forecast marks at risk (admins). */
  view: 'at-risk' | '';
  sort: SortField;
  order: 'asc' | 'desc';
  page: number;
  pageSize: number;
}

const FILTER_KEYS = ['make', 'model', 'colour', 'category', 'minPrice', 'maxPrice'] as const;

function numberOr(value: string | null, fallback: number) {
  const n = Number(value);
  return value !== null && Number.isInteger(n) && n > 0 ? n : fallback;
}

/** Filters, sort and page live in the URL so every view is shareable and survives a reload. */
export function useFilters() {
  const [params, setParams] = useSearchParams();

  const filters = useMemo<Filters>(() => {
    const category = params.get('category') ?? '';
    const stock = params.get('stock') ?? '';
    const sort = params.get('sort') ?? 'make';
    const pageSize = numberOr(params.get('pageSize'), 25);
    return {
      make: params.get('make') ?? '',
      colour: params.get('colour') ?? '',
      model: params.get('model') ?? '',
      category: (CATEGORIES as readonly string[]).includes(category) ? (category as Category) : '',
      minPrice: params.get('minPrice') ?? '',
      maxPrice: params.get('maxPrice') ?? '',
      stock: (STOCK as string[]).includes(stock) ? (stock as StockStatus) : '',
      view: params.get('view') === 'at-risk' ? 'at-risk' : '',
      sort: (SORT_FIELDS as string[]).includes(sort) ? (sort as SortField) : 'make',
      order: params.get('order') === 'desc' ? 'desc' : 'asc',
      page: numberOr(params.get('page'), 1),
      pageSize: (PAGE_SIZES as readonly number[]).includes(pageSize) ? pageSize : 25,
    };
  }, [params]);

  /** Sets or clears URL params. Any change other than paging goes back to page 1. */
  const update = useCallback(
    (changes: Partial<Record<keyof Filters, string | number>>) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          for (const [key, value] of Object.entries(changes)) {
            if (value === '' || value === undefined) next.delete(key);
            else next.set(key, String(value));
          }
          if (!('page' in changes)) next.delete('page');
          return next;
        },
        { replace: false },
      );
    },
    [setParams],
  );

  const clear = useCallback(() => {
    setParams((current) => {
      const next = new URLSearchParams(current);
      for (const key of [...FILTER_KEYS, 'page']) next.delete(key);
      return next;
    });
  }, [setParams]);

  const hasFilters = FILTER_KEYS.some((key) => filters[key] !== '');

  return { filters, update, clear, hasFilters };
}

/** The server query for the current filters. */
export function toVehicleQuery(f: Filters): VehicleQuery {
  const min = f.minPrice === '' ? undefined : Number(f.minPrice);
  const max = f.maxPrice === '' ? undefined : Number(f.maxPrice);
  const atRisk = f.view === 'at-risk';
  return {
    make: f.make || undefined,
    colour: f.colour || undefined,
    model: f.model || undefined,
    category: f.category || undefined,
    minPrice: Number.isFinite(min) ? min : undefined,
    maxPrice: Number.isFinite(max) ? max : undefined,
    stock: f.stock || undefined,
    sort: f.sort,
    order: f.order,
    // The at-risk view filters client-side over the whole (bounded) lot.
    limit: atRisk ? 100 : f.pageSize,
    offset: atRisk ? 0 : (f.page - 1) * f.pageSize,
  };
}
