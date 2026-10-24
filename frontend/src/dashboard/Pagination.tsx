import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useId } from 'react';
import { formatInteger } from '../lib/format';
import { PAGE_SIZES } from './useFilters';

interface PaginationProps {
  page: number;
  pageSize: number;
  count: number;
  onPage: (page: number) => void;
  onPageSize: (size: number) => void;
}

export function Pagination({ page, pageSize, count, onPage, onPageSize }: PaginationProps) {
  const id = useId();
  const first = count === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, count);
  const lastPage = Math.max(1, Math.ceil(count / pageSize));

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-3 py-2 text-sm text-muted">
      <div className="flex items-center gap-2">
        <label htmlFor={id}>Rows per page</label>
        <select
          id={id}
          value={pageSize}
          onChange={(e) => onPageSize(Number(e.target.value))}
          className="h-7 rounded-control border border-border-strong bg-surface px-1.5 text-sm text-text"
        >
          {PAGE_SIZES.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-2">
        <span className="tabular-nums">
          {formatInteger(first)}–{formatInteger(last)} of {formatInteger(count)}
        </span>
        <button
          type="button"
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          className="inline-flex size-7 items-center justify-center rounded-control text-text hover:bg-surface-hover disabled:opacity-40"
        >
          <ChevronLeft aria-hidden="true" className="size-4" strokeWidth={1.5} />
        </button>
        <button
          type="button"
          aria-label="Next page"
          disabled={page >= lastPage}
          onClick={() => onPage(page + 1)}
          className="inline-flex size-7 items-center justify-center rounded-control text-text hover:bg-surface-hover disabled:opacity-40"
        >
          <ChevronRight aria-hidden="true" className="size-4" strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}
