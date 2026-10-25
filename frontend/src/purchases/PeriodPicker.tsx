import { useId } from 'react';
import { PURCHASE_PERIODS, type PurchasePeriod } from '../api/types';

/** Segmented control over native radios, so arrow keys and screen readers work as for any radio group. */
export function PeriodPicker({ value, onChange }: { value: PurchasePeriod; onChange: (days: PurchasePeriod) => void }) {
  const name = useId();
  return (
    <fieldset>
      <legend className="sr-only">Period</legend>
      <div className="inline-flex rounded-control border border-border-strong bg-surface p-0.5">
        {PURCHASE_PERIODS.map((days) => (
          <label key={days} className="cursor-pointer">
            <input
              type="radio"
              name={name}
              value={days}
              checked={value === days}
              onChange={() => onChange(days)}
              className="peer sr-only"
            />
            <span className="flex h-7 items-center rounded-[calc(var(--radius-control)-2px)] px-3 text-sm text-muted transition-colors peer-checked:bg-surface-hover peer-checked:font-medium peer-checked:text-text peer-focus-visible:outline-2 peer-focus-visible:outline-accent hover:text-text">
              {days} days
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
