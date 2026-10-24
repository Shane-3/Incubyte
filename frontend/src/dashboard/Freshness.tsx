import { RotateCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { formatRelative } from '../lib/format';

const TICK_MS = 30_000;

/** "Updated 2 min. ago" with a refresh action, so people know how current the numbers are. */
export function Freshness({
  updatedAt,
  refreshing,
  onRefresh,
}: {
  updatedAt: number;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, [updatedAt]);

  return (
    <span className="inline-flex items-center gap-1">
      <span>Updated {formatRelative(new Date(updatedAt).toISOString(), Math.max(now, updatedAt))}</span>
      <button
        type="button"
        aria-label="Refresh data"
        title="Refresh data"
        onClick={onRefresh}
        disabled={refreshing}
        className="inline-flex size-6 items-center justify-center rounded-control text-muted hover:bg-surface-hover hover:text-text disabled:opacity-60"
      >
        <RotateCw aria-hidden="true" className={`size-3.5 ${refreshing ? 'animate-spin' : ''}`} strokeWidth={1.75} />
      </button>
    </span>
  );
}
