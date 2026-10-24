import { type FormEvent, useEffect, useState } from 'react';
import type { ColourUnits, Vehicle } from '../api/types';
import { Swatch } from '../components/ColourSwatches';
import { Button } from '../components/ui/Button';
import { FormAlert } from '../components/ui/FormAlert';
import { TextField } from '../components/ui/TextField';
import { pluralise } from '../lib/format';
import { mapApiError } from '../lib/form-errors';

interface RestockFormProps {
  vehicle: Vehicle;
  /** From the forecast; 0 or undefined means there is nothing to suggest. */
  suggested?: number;
  windowDays?: number;
  /** Units per colour; colours left at zero are not sent. */
  onSubmit: (colours: ColourUnits[]) => Promise<unknown>;
  onCancel: () => void;
}

const MAX_UNITS = 100_000;

function unitsError(value: string): string | undefined {
  if (value.trim() === '') return undefined;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) return 'Use whole units, 0 or more';
  if (n > MAX_UNITS) return 'At most 100,000';
  return undefined;
}

const unitsOf = (value: string) => (value.trim() === '' ? 0 : Number(value));

/** Restock one or more colours of a model in a single change. */
export function RestockForm({ vehicle, suggested, windowDays = 30, onSubmit, onCancel }: RestockFormProps) {
  const single = vehicle.colours.length === 1 ? vehicle.colours[0] : undefined;
  const [units, setUnits] = useState<Record<string, string>>(() =>
    single && suggested ? { [single.id]: String(suggested) } : {},
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [totalError, setTotalError] = useState<string>();
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // The forecast may land after the drawer opens; fill a single-colour field unless the admin has typed something.
  useEffect(() => {
    if (single && suggested) setUnits((current) => (current[single.id] ? current : { [single.id]: String(suggested) }));
  }, [single, suggested]);

  const set = (colourId: string) => (event: { target: { value: string } }) =>
    setUnits((current) => ({ ...current, [colourId]: event.target.value }));

  const valid = vehicle.colours.filter((c) => !unitsError(units[c.id] ?? ''));
  const total = valid.reduce((sum, c) => sum + unitsOf(units[c.id] ?? ''), 0);
  const restocked = valid.filter((c) => unitsOf(units[c.id] ?? '') > 0).length;

  async function submit(event: FormEvent) {
    event.preventDefault();
    const found: Record<string, string> = {};
    for (const c of vehicle.colours) {
      const error = unitsError(units[c.id] ?? '');
      if (error) found[c.id] = error;
    }
    setErrors(found);
    const noUnits = Object.keys(found).length === 0 && total < 1;
    setTotalError(noUnits ? 'Enter at least 1 unit' : undefined);
    setFormError(null);
    if (Object.keys(found).length > 0 || noUnits) return;

    setSaving(true);
    try {
      await onSubmit(
        vehicle.colours
          .map((c) => ({ colourId: c.id, quantity: unitsOf(units[c.id] ?? '') }))
          .filter((c) => c.quantity > 0),
      );
    } catch (err) {
      setFormError(mapApiError(err, { quantity: 'Quantity' }).form ?? 'Could not restock');
      setSaving(false);
    }
  }

  const suggestion = suggested
    ? `Suggested: ${suggested}${single ? '' : ' in total'} (covers ${windowDays} days of sales)`
    : undefined;

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-4">
      <FormAlert message={formError} />
      <p className="text-base">
        <span className="tabular-nums">{vehicle.quantity}</span> in stock now
        {!single && <span className="text-muted"> across {pluralise(vehicle.colours.length, 'colour')}</span>}
      </p>

      {single ? (
        <TextField
          label="Units to add"
          type="number"
          inputMode="numeric"
          min={1}
          step={1}
          value={units[single.id] ?? ''}
          onChange={set(single.id)}
          hint={suggestion}
          error={errors[single.id] ?? totalError}
        />
      ) : (
        <div className="flex flex-col gap-2">
          {suggestion && <p className="text-sm text-muted">{suggestion}</p>}
          <div aria-hidden="true" className="grid grid-cols-[1rem_minmax(0,1fr)_6rem] gap-3 text-xs text-muted">
            <span />
            <span>Colour</span>
            <span>Units to add</span>
          </div>
          {vehicle.colours.map((c) => {
            const noteId = `restock-${c.id}-stock`;
            const errorId = `restock-${c.id}-error`;
            return (
              <div key={c.id} className="grid grid-cols-[1rem_minmax(0,1fr)_6rem] items-center gap-x-3 gap-y-1">
                <Swatch hex={c.hex} size={16} soldOut={c.quantity === 0} />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-base">{c.name}</span>
                  <span id={noteId} className="text-xs text-muted tabular-nums">
                    {c.quantity} in stock
                  </span>
                </span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1}
                  aria-label={`${c.name} units to add`}
                  aria-describedby={errors[c.id] ? errorId : noteId}
                  aria-invalid={errors[c.id] ? true : undefined}
                  value={units[c.id] ?? ''}
                  onChange={set(c.id)}
                  placeholder="0"
                  className="h-9 w-full rounded-control border border-border-strong bg-surface px-2.5 text-base text-text tabular-nums aria-invalid:border-out"
                />
                {errors[c.id] && (
                  <p id={errorId} className="col-start-3 text-xs text-out">
                    {errors[c.id]}
                  </p>
                )}
              </div>
            );
          })}
          <div className="flex items-center justify-between border-t border-border pt-2 text-sm">
            <span className={totalError ? 'text-out' : 'text-muted'}>{totalError ?? ''}</span>
            <span className="text-muted tabular-nums">
              {total > 0 ? `${pluralise(total, 'unit')} across ${pluralise(restocked, 'colour')}` : 'No units yet'}
            </span>
          </div>
        </div>
      )}

      <div className="mt-2 flex justify-end gap-2">
        <Button onClick={onCancel}>Cancel</Button>
        <Button type="submit" variant="primary" disabled={saving}>
          {saving ? 'Restocking…' : 'Restock'}
        </Button>
      </div>
    </form>
  );
}
