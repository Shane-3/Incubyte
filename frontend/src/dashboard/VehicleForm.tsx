import { type FormEvent, useState } from 'react';
import { CATEGORIES, type Category, type Vehicle, type VehicleInput } from '../api/types';
import { FormAlert } from '../components/ui/FormAlert';
import { Button } from '../components/ui/Button';
import { SelectField } from '../components/ui/SelectField';
import { TextField } from '../components/ui/TextField';
import { type FieldErrors, mapApiError } from '../lib/form-errors';

type Field = keyof VehicleInput;
type Draft = Record<Field, string>;

const LABELS: Record<Field, string> = {
  make: 'Make',
  model: 'Model',
  category: 'Category',
  price: 'Price',
  quantity: 'Quantity',
};
const MAX_PRICE = 99_999_999.99;
const MAX_QUANTITY = 100_000;

function validate(draft: Draft): { errors: FieldErrors<Field>; value?: VehicleInput } {
  const errors: FieldErrors<Field> = {};
  if (!draft.make.trim()) errors.make = 'Enter a make';
  if (!draft.model.trim()) errors.model = 'Enter a model';
  if (!draft.category) errors.category = 'Choose a category';

  const price = Number(draft.price);
  if (draft.price.trim() === '' || Number.isNaN(price)) errors.price = 'Enter a price';
  else if (price < 0) errors.price = 'Price must be 0 or more';
  else if (price > MAX_PRICE) errors.price = 'Price must be at most $99,999,999.99';
  else if (Math.abs(price * 100 - Math.round(price * 100)) > 1e-6) {
    errors.price = 'Price can have at most 2 decimal places';
  }

  const quantity = Number(draft.quantity);
  if (draft.quantity.trim() === '' || Number.isNaN(quantity)) errors.quantity = 'Enter a quantity';
  else if (!Number.isInteger(quantity)) errors.quantity = 'Quantity must be a whole number';
  else if (quantity < 0) errors.quantity = 'Quantity must be 0 or more';
  else if (quantity > MAX_QUANTITY) errors.quantity = 'Quantity must be at most 100,000';

  if (Object.keys(errors).length > 0) return { errors };
  return {
    errors,
    value: {
      make: draft.make.trim(),
      model: draft.model.trim(),
      category: draft.category as Category,
      price,
      quantity,
    },
  };
}

/** Only the fields that differ from the original, so an edit never overwrites concurrent stock changes needlessly. */
export function changedFields(original: Vehicle, next: VehicleInput): Partial<VehicleInput> {
  const changes: Partial<VehicleInput> = {};
  for (const key of Object.keys(next) as Field[]) {
    if (next[key] !== original[key]) Object.assign(changes, { [key]: next[key] });
  }
  return changes;
}

interface VehicleFormProps {
  initial?: Vehicle;
  submitLabel: string;
  onSubmit: (value: VehicleInput) => Promise<unknown>;
  onCancel: () => void;
}

export function VehicleForm({ initial, submitLabel, onSubmit, onCancel }: VehicleFormProps) {
  const [draft, setDraft] = useState<Draft>({
    make: initial?.make ?? '',
    model: initial?.model ?? '',
    category: initial?.category ?? '',
    price: initial ? String(initial.price) : '',
    quantity: initial ? String(initial.quantity) : '',
  });
  const [errors, setErrors] = useState<FieldErrors<Field>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = (field: Field) => (event: { target: { value: string } }) =>
    setDraft((d) => ({ ...d, [field]: event.target.value }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    const { errors: found, value } = validate(draft);
    setErrors(found);
    setFormError(null);
    if (!value) return;

    setSaving(true);
    try {
      await onSubmit(value);
    } catch (err) {
      const mapped = mapApiError(err, LABELS);
      setErrors(mapped.fields);
      setFormError(mapped.form);
      setSaving(false);
    }
  }

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-4">
      <FormAlert message={formError} />
      <div className="grid grid-cols-2 gap-4">
        <TextField label="Make" value={draft.make} onChange={set('make')} error={errors.make} maxLength={100} />
        <TextField label="Model" value={draft.model} onChange={set('model')} error={errors.model} maxLength={100} />
      </div>
      <SelectField
        label="Category"
        value={draft.category}
        onChange={set('category')}
        options={CATEGORIES}
        placeholder="Choose…"
        error={errors.category}
      />
      <div className="grid grid-cols-2 gap-4">
        <TextField
          label="Price"
          type="number"
          inputMode="decimal"
          step="0.01"
          min={0}
          value={draft.price}
          onChange={set('price')}
          error={errors.price}
        />
        <TextField
          label="Quantity"
          type="number"
          inputMode="numeric"
          step={1}
          min={0}
          value={draft.quantity}
          onChange={set('quantity')}
          error={errors.quantity}
        />
      </div>
      <div className="mt-2 flex justify-end gap-2">
        <Button onClick={onCancel}>Cancel</Button>
        <Button type="submit" variant="primary" disabled={saving}>
          {saving ? 'Saving…' : submitLabel}
        </Button>
      </div>
    </form>
  );
}
