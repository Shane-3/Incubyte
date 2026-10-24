import { SlidersHorizontal, X } from 'lucide-react';
import { type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { CATEGORIES } from '../api/types';
import { Button } from '../components/ui/Button';
import { formatPrice } from '../lib/format';
import type { Filters } from './useFilters';

type TextKey = 'make' | 'model' | 'colour' | 'minPrice' | 'maxPrice';

const DEBOUNCE_MS = 300;

interface ToolbarProps {
  filters: Filters;
  hasFilters: boolean;
  onChange: (changes: Partial<Record<keyof Filters, string>>) => void;
  onClear: () => void;
}

function Field({
  label,
  children,
  className = '',
}: {
  label: string;
  children: (id: string) => ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label htmlFor={id} className="text-xs text-muted">
        {label}
      </label>
      {children(id)}
    </div>
  );
}

const inputClass =
  'h-8 w-full rounded-control border border-border-strong bg-surface px-2.5 text-base text-text placeholder:text-muted aria-invalid:border-out';

export function Toolbar({ filters, hasFilters, onChange, onClear }: ToolbarProps) {
  const [draft, setDraft] = useState<Record<TextKey, string>>({
    make: filters.make,
    colour: filters.colour,
    model: filters.model,
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
  });
  const [open, setOpen] = useState(false);
  const makeInput = useRef<HTMLInputElement>(null);

  // "/" jumps to the filters from anywhere on the page, unless the user is already typing somewhere.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]')) return;
      event.preventDefault();
      setOpen(true);
      // The panel may have just been revealed on small screens; focus after it renders.
      requestAnimationFrame(() => makeInput.current?.focus());
      makeInput.current?.focus();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Follow the URL when it changes from elsewhere (Clear, chips, sidebar).
  useEffect(() => {
    setDraft({
      make: filters.make,
      model: filters.model,
      colour: filters.colour,
      minPrice: filters.minPrice,
      maxPrice: filters.maxPrice,
    });
  }, [filters.make, filters.model, filters.colour, filters.minPrice, filters.maxPrice]);

  const min = draft.minPrice === '' ? undefined : Number(draft.minPrice);
  const max = draft.maxPrice === '' ? undefined : Number(draft.maxPrice);
  const rangeInvalid = min !== undefined && max !== undefined && min > max;

  // Push text edits to the URL once typing pauses; an invalid price range is held back.
  useEffect(() => {
    const changes: Partial<Record<TextKey, string>> = {};
    if (draft.make !== filters.make) changes.make = draft.make;
    if (draft.colour !== filters.colour) changes.colour = draft.colour;
    if (draft.model !== filters.model) changes.model = draft.model;
    if (!rangeInvalid) {
      if (draft.minPrice !== filters.minPrice) changes.minPrice = draft.minPrice;
      if (draft.maxPrice !== filters.maxPrice) changes.maxPrice = draft.maxPrice;
    }
    if (Object.keys(changes).length === 0) return;
    const timer = setTimeout(() => onChange(changes), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [draft, filters, onChange, rangeInvalid]);

  const set = (key: TextKey) => (event: { target: { value: string } }) =>
    setDraft((d) => ({ ...d, [key]: event.target.value }));

  const chips: Array<{ label: string; key: keyof Filters }> = [];
  if (filters.make) chips.push({ label: `Make: ${filters.make}`, key: 'make' });
  if (filters.colour) chips.push({ label: `Colour: ${filters.colour}`, key: 'colour' });
  if (filters.model) chips.push({ label: `Model: ${filters.model}`, key: 'model' });
  if (filters.category) chips.push({ label: `Category: ${filters.category}`, key: 'category' });
  if (filters.minPrice) chips.push({ label: `Min price: ${formatPrice(Number(filters.minPrice))}`, key: 'minPrice' });
  if (filters.maxPrice) chips.push({ label: `Max price: ${formatPrice(Number(filters.maxPrice))}`, key: 'maxPrice' });

  return (
    <div className="flex flex-col gap-3">
      <div className="md:hidden">
        <Button size="sm" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <SlidersHorizontal aria-hidden="true" className="size-4" strokeWidth={1.5} />
          Filters{chips.length > 0 ? ` (${chips.length})` : ''}
        </Button>
      </div>

      <div
        className={`${open ? 'grid' : 'max-md:hidden md:grid'} grid-cols-2 gap-3 md:grid-cols-[1fr_1fr_1fr_150px_110px_110px_auto] md:items-end`}
      >
        <Field label="Make">
          {(id) => (
            <span className="relative block">
              <input
                id={id}
                ref={makeInput}
                className={`${inputClass} pr-8`}
                value={draft.make}
                onChange={set('make')}
                placeholder="Any make"
                aria-keyshortcuts="/"
              />
              <kbd
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 rounded border border-border px-1 font-sans text-xs leading-4 text-muted max-md:hidden"
              >
                /
              </kbd>
            </span>
          )}
        </Field>
        <Field label="Model">
          {(id) => (
            <input id={id} className={inputClass} value={draft.model} onChange={set('model')} placeholder="Any model" />
          )}
        </Field>
        <Field label="Colour">
          {(id) => (
            <input
              id={id}
              className={inputClass}
              value={draft.colour}
              onChange={set('colour')}
              placeholder="Any colour"
            />
          )}
        </Field>
        <Field label="Category">
          {(id) => (
            <select
              id={id}
              className={inputClass}
              value={filters.category}
              onChange={(e) => onChange({ category: e.target.value })}
            >
              <option value="">All categories</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Min price">
          {(id) => (
            <input
              id={id}
              className={inputClass}
              inputMode="numeric"
              value={draft.minPrice}
              onChange={set('minPrice')}
              aria-invalid={rangeInvalid || undefined}
              aria-describedby={rangeInvalid ? 'price-range-error' : undefined}
              placeholder="$0"
            />
          )}
        </Field>
        <Field label="Max price">
          {(id) => (
            <input
              id={id}
              className={inputClass}
              inputMode="numeric"
              value={draft.maxPrice}
              onChange={set('maxPrice')}
              aria-invalid={rangeInvalid || undefined}
              aria-describedby={rangeInvalid ? 'price-range-error' : undefined}
              placeholder="No max"
            />
          )}
        </Field>
        {hasFilters && (
          <Button size="md" variant="ghost" onClick={onClear} className="col-span-2 md:col-span-1">
            Clear
          </Button>
        )}
      </div>

      {rangeInvalid && (
        <p id="price-range-error" className="text-xs text-out">
          Min price must not be above max price
        </p>
      )}

      {chips.length > 0 && (
        <ul aria-label="Active filters" className="flex flex-wrap gap-1.5">
          {chips.map((chip) => (
            <li key={chip.key}>
              <span className="inline-flex h-6 items-center gap-1 rounded-full border border-border bg-surface pl-2.5 pr-1 text-xs">
                {chip.label}
                <button
                  type="button"
                  aria-label={`Remove filter ${chip.label}`}
                  onClick={() => onChange({ [chip.key]: '' })}
                  className="inline-flex size-4 items-center justify-center rounded-full text-muted hover:bg-surface-hover hover:text-text"
                >
                  <X aria-hidden="true" className="size-3" strokeWidth={2} />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
