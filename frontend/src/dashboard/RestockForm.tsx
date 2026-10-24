import { type FormEvent, useEffect, useState } from 'react';
import type { Colour, Vehicle } from '../api/types';
import { ColourPicker } from '../components/ColourSwatches';
import { Button } from '../components/ui/Button';
import { FormAlert } from '../components/ui/FormAlert';
import { TextField } from '../components/ui/TextField';
import { mapApiError } from '../lib/form-errors';

interface RestockFormProps {
  vehicle: Vehicle;
  /** From the forecast; 0 or undefined means there is nothing to suggest. */
  suggested?: number;
  windowDays?: number;
  onSubmit: (quantity: number, colourId: string) => Promise<unknown>;
  onCancel: () => void;
}

/** Where restocking most likely starts: a sold-out colour, else the one running lowest. */
function neediestColour(colours: Colour[]): Colour | undefined {
  return colours.reduce<Colour | undefined>((low, c) => (!low || c.quantity < low.quantity ? c : low), undefined);
}

export function RestockForm({ vehicle, suggested, windowDays = 30, onSubmit, onCancel }: RestockFormProps) {
  const [value, setValue] = useState(suggested ? String(suggested) : '');
  const [colourId, setColourId] = useState(() => neediestColour(vehicle.colours)?.id ?? '');
  const [error, setError] = useState<string>();
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const several = vehicle.colours.length > 1;

  // The forecast may land after the drawer opens; fill it in unless the admin has typed something.
  useEffect(() => {
    if (suggested) setValue((current) => current || String(suggested));
  }, [suggested]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const quantity = Number(value);
    if (value.trim() === '' || quantity < 1) return setError('Enter at least 1 unit');
    if (!Number.isInteger(quantity)) return setError('Enter a whole number of units');
    if (quantity > 100_000) return setError('Enter at most 100,000 units');
    setError(undefined);
    setFormError(null);
    setSaving(true);
    try {
      await onSubmit(quantity, colourId);
    } catch (err) {
      setFormError(mapApiError(err, { quantity: 'Quantity' }).form ?? 'Could not restock');
      setSaving(false);
    }
  }

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-4">
      <FormAlert message={formError} />
      <p className="text-base">
        <span className="tabular-nums">{vehicle.quantity}</span> in stock now
        {several && <span className="text-muted"> across {vehicle.colours.length} colours</span>}
      </p>
      {several && (
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Colour</span>
          <ColourPicker colours={vehicle.colours} value={colourId} onChange={setColourId} />
        </div>
      )}
      <TextField
        label="Units to add"
        type="number"
        inputMode="numeric"
        min={1}
        step={1}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        hint={suggested ? `Suggested: ${suggested} (covers ${windowDays} days of sales)` : undefined}
        error={error}
      />
      <div className="mt-2 flex justify-end gap-2">
        <Button onClick={onCancel}>Cancel</Button>
        <Button type="submit" variant="primary" disabled={saving}>
          {saving ? 'Restocking…' : 'Restock'}
        </Button>
      </div>
    </form>
  );
}
