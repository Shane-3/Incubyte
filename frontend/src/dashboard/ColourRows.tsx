import { Plus, X } from 'lucide-react';
import type { ColourInput, ColourStock } from '../api/types';
import { Swatch } from '../components/ColourSwatches';
import { Button } from '../components/ui/Button';
import { pluralise } from '../lib/format';

export interface ColourRow {
  key: number;
  name: string;
  hex: string;
  units: string;
}

export type RowErrors = Array<{ name?: string; units?: string } | undefined>;

export const NEUTRAL_PAINT = '#8a8f98';
const COLOUR_NAME = /^[\p{L}\p{M}\p{N} .,'&()/+-]{1,40}$/u;
const MAX_UNITS = 100_000;

/** Common paint families; the name can then be made specific ("Soul Red Crystal Metallic"). */
export const PAINT_PRESETS: ColourInput[] = [
  { name: 'Black', hex: '#111214' },
  { name: 'White', hex: '#f1f1ee' },
  { name: 'Silver', hex: '#a7abaf' },
  { name: 'Grey', hex: '#5f6366' },
  { name: 'Red', hex: '#a3161a' },
  { name: 'Blue', hex: '#1f3a5f' },
  { name: 'Green', hex: '#2f4a3a' },
];

/** Mirrors the API: a name, whole units of 0 or more, and each name once. */
export function validateRows(rows: ColourRow[]): { errors: RowErrors; colours?: ColourStock[] } {
  const errors: RowErrors = [];
  const seen = new Set<string>();
  rows.forEach((row, i) => {
    const name = row.name.trim();
    const units = Number(row.units);
    const rowErrors: { name?: string; units?: string } = {};
    if (!name) rowErrors.name = 'Enter a colour name';
    else if (!COLOUR_NAME.test(name)) rowErrors.name = 'Use letters, digits, spaces and basic punctuation';
    else if (seen.has(name.toLowerCase())) rowErrors.name = 'Already listed above';
    if (name) seen.add(name.toLowerCase());
    if (row.units.trim() === '' || !Number.isInteger(units) || units < 0)
      rowErrors.units = 'Use whole units, 0 or more';
    else if (units > MAX_UNITS) rowErrors.units = 'At most 100,000';
    if (rowErrors.name || rowErrors.units) errors[i] = rowErrors;
  });
  if (errors.some(Boolean)) return { errors };
  return {
    errors,
    colours: rows.map((row) => ({ name: row.name.trim(), hex: row.hex, quantity: Number(row.units) })),
  };
}

export function totalUnits(rows: ColourRow[]): number {
  return rows.reduce((sum, row) => sum + (Number.isInteger(Number(row.units)) ? Number(row.units) : 0), 0);
}

interface ColourRowsProps {
  rows: ColourRow[];
  errors: RowErrors;
  onChange: (rows: ColourRow[]) => void;
  /** Allocates a stable key for a new row. */
  nextKey: () => number;
}

const ROW_GRID = 'grid grid-cols-[2.5rem_minmax(0,1fr)_5.5rem_2rem] items-start gap-2';
const INPUT =
  'h-9 w-full rounded-control border border-border-strong bg-surface px-2.5 text-base text-text aria-invalid:border-out';

/** The colours being received, one row each: paint, name and units on a single line. */
export function ColourRows({ rows, errors, onChange, nextKey }: ColourRowsProps) {
  const update = (index: number, change: Partial<ColourRow>) =>
    onChange(rows.map((row, i) => (i === index ? { ...row, ...change } : row)));

  function addRow(paint: ColourInput = { name: '', hex: NEUTRAL_PAINT }) {
    onChange([...rows, { key: nextKey(), name: paint.name, hex: paint.hex, units: '' }]);
  }

  const listed = (name: string) => rows.some((row) => row.name.trim().toLowerCase() === name.toLowerCase());
  const total = totalUnits(rows);

  return (
    <fieldset className="flex flex-col gap-3 rounded-control border border-border p-3">
      <legend className="px-1 text-sm font-medium">Colours</legend>
      <p className="-mt-1 text-xs text-muted">
        Add each colour you are receiving with its units. Leave empty for a single Standard colour.
      </p>

      <div className="flex flex-wrap gap-1.5">
        {PAINT_PRESETS.map((preset) => (
          <button
            key={preset.name}
            type="button"
            aria-pressed={listed(preset.name)}
            disabled={listed(preset.name)}
            onClick={() => addRow(preset)}
            className="inline-flex h-7 items-center gap-1.5 rounded-full border border-border px-2.5 text-sm hover:bg-surface-hover disabled:cursor-default disabled:opacity-60 aria-pressed:border-accent"
          >
            <Swatch hex={preset.hex} />
            {preset.name}
          </button>
        ))}
      </div>

      {rows.length > 0 && (
        <div className="flex flex-col gap-2">
          <div aria-hidden="true" className={`${ROW_GRID} text-xs text-muted`}>
            <span>Paint</span>
            <span>Colour name</span>
            <span>Units</span>
            <span />
          </div>
          {rows.map((row, i) => {
            const n = i + 1;
            const rowErrors = errors[i];
            const nameError = `colour-${row.key}-name-error`;
            const unitsError = `colour-${row.key}-units-error`;
            return (
              <div key={row.key} data-colour-row className={ROW_GRID}>
                <input
                  type="color"
                  aria-label={`Colour ${n} paint`}
                  value={row.hex}
                  onChange={(e) => update(i, { hex: e.target.value })}
                  className="h-9 w-10 cursor-pointer rounded-control border border-border-strong bg-surface p-1"
                />
                <div>
                  <input
                    aria-label={`Colour ${n} name`}
                    value={row.name}
                    maxLength={40}
                    onChange={(e) => update(i, { name: e.target.value })}
                    aria-invalid={rowErrors?.name ? true : undefined}
                    aria-describedby={rowErrors?.name ? nameError : undefined}
                    placeholder="e.g. Soul Red Crystal"
                    className={INPUT}
                  />
                  {rowErrors?.name && (
                    <p id={nameError} className="mt-1 text-xs text-out">
                      {rowErrors.name}
                    </p>
                  )}
                </div>
                <div>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={1}
                    aria-label={`Colour ${n} units`}
                    value={row.units}
                    onChange={(e) => update(i, { units: e.target.value })}
                    aria-invalid={rowErrors?.units ? true : undefined}
                    aria-describedby={rowErrors?.units ? unitsError : undefined}
                    className={`${INPUT} tabular-nums`}
                  />
                  {rowErrors?.units && (
                    <p id={unitsError} className="mt-1 text-xs text-out">
                      {rowErrors.units}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  aria-label={`Remove colour ${n}`}
                  onClick={() => onChange(rows.filter((_, j) => j !== i))}
                  className="inline-flex size-9 items-center justify-center rounded-control text-muted hover:bg-surface-hover hover:text-text"
                >
                  <X aria-hidden="true" className="size-4" strokeWidth={1.5} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <Button size="sm" onClick={() => addRow()}>
          <Plus aria-hidden="true" className="size-3.5" strokeWidth={1.75} />
          Add colour
        </Button>
        {rows.length > 0 && (
          <p className="text-sm text-muted tabular-nums">
            {pluralise(total, 'unit')} in {pluralise(rows.length, 'colour')}
          </p>
        )}
      </div>
    </fieldset>
  );
}
