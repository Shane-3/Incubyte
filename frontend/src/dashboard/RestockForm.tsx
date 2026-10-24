import { type FormEvent, useEffect, useState } from 'react';
import type { Vehicle } from '../api/types';
import { FormAlert } from '../components/ui/FormAlert';
import { Button } from '../components/ui/Button';
import { TextField } from '../components/ui/TextField';
import { mapApiError } from '../lib/form-errors';

interface RestockFormProps {
  vehicle: Vehicle;
  /** From the forecast; 0 or undefined means there is nothing to suggest. */
  suggested?: number;
  windowDays?: number;
  onSubmit: (quantity: number) => Promise<unknown>;
  onCancel: () => void;
}

export function RestockForm({ vehicle, suggested, windowDays = 30, onSubmit, onCancel }: RestockFormProps) {
  const [value, setValue] = useState(suggested ? String(suggested) : '');
  const [error, setError] = useState<string>();
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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
      await onSubmit(quantity);
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
      </p>
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
