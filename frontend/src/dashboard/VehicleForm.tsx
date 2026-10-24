import { useQuery } from '@tanstack/react-query';
import { type FormEvent, useEffect, useId, useState } from 'react';
import {
  CATEGORIES,
  type Category,
  type ColourInput,
  type NewVehicleInput,
  type Vehicle,
  type VehicleInput,
} from '../api/types';
import { useApi } from '../app/ApiContext';
import { Swatch } from '../components/ColourSwatches';
import { Button } from '../components/ui/Button';
import { FormAlert } from '../components/ui/FormAlert';
import { SelectField } from '../components/ui/SelectField';
import { TextField } from '../components/ui/TextField';
import { type FieldErrors, mapApiError } from '../lib/form-errors';
import { vehicleName } from './VehicleTable';

type Field = keyof VehicleInput | 'colourName';
type Draft = Record<keyof VehicleInput, string> & { colourName: string; hex: string };

const LABELS: Record<Field, string> = {
  make: 'Make',
  model: 'Model',
  category: 'Category',
  price: 'Price',
  quantity: 'Quantity',
  colourName: 'Colour name',
};
const MAX_PRICE = 99_999_999.99;
const MAX_QUANTITY = 100_000;
const COLOUR_NAME = /^[\p{L}\p{M}\p{N} .,'&()/+-]{1,40}$/u;
const NEUTRAL = '#8a8f98';

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

interface Checked {
  errors: FieldErrors<Field>;
  value?: NewVehicleInput;
}

function validate(draft: Draft, { checkQuantity }: { checkQuantity: boolean }): Checked {
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
  if (checkQuantity) {
    if (draft.quantity.trim() === '' || Number.isNaN(quantity)) errors.quantity = 'Enter a quantity';
    else if (!Number.isInteger(quantity)) errors.quantity = 'Quantity must be a whole number';
    else if (quantity < 0) errors.quantity = 'Quantity must be 0 or more';
    else if (quantity > MAX_QUANTITY) errors.quantity = 'Quantity must be at most 100,000';
  }

  const colourName = draft.colourName.trim();
  if (colourName && !COLOUR_NAME.test(colourName)) {
    errors.colourName = 'Use up to 40 letters, digits, spaces and basic punctuation';
  }

  if (Object.keys(errors).length > 0) return { errors };
  return {
    errors,
    value: {
      make: draft.make.trim(),
      model: draft.model.trim(),
      category: draft.category as Category,
      price,
      quantity,
      ...(colourName && { colour: { name: colourName, hex: draft.hex } }),
    },
  };
}

/** Only the fields that differ from the original, so an edit never overwrites concurrent stock changes needlessly. */
export function changedFields(original: Vehicle, next: VehicleInput): Partial<VehicleInput> {
  const changes: Partial<VehicleInput> = {};
  for (const key of ['make', 'model', 'category', 'price', 'quantity'] as const) {
    if (next[key] !== original[key]) Object.assign(changes, { [key]: next[key] });
  }
  return changes;
}

/** Looks the make + model up once typing pauses, so the form can say it will add a colour to it. */
function useExistingModel(make: string, model: string, enabled: boolean): Vehicle | undefined {
  const api = useApi();
  const [key, setKey] = useState({ make: '', model: '' });
  useEffect(() => {
    const timer = setTimeout(() => setKey({ make: make.trim(), model: model.trim() }), 300);
    return () => clearTimeout(timer);
  }, [make, model]);

  const lookup = useQuery({
    queryKey: ['model-lookup', key.make.toLowerCase(), key.model.toLowerCase()],
    queryFn: () => api.vehicles.search({ make: key.make, model: key.model, limit: 10 }),
    enabled: enabled && key.make !== '' && key.model !== '',
    staleTime: 30_000,
  });
  const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
  return lookup.data?.data.find((v) => same(v.make, key.make) && same(v.model, key.model));
}

interface AddProps {
  mode: 'add';
  onSubmit: (value: NewVehicleInput) => Promise<unknown>;
  onCancel: () => void;
}

interface EditProps {
  mode: 'edit';
  initial: Vehicle;
  onSubmit: (value: VehicleInput) => Promise<unknown>;
  onCancel: () => void;
}

export function VehicleForm(props: AddProps | EditProps) {
  const initial = props.mode === 'edit' ? props.initial : undefined;
  const [draft, setDraft] = useState<Draft>({
    make: initial?.make ?? '',
    model: initial?.model ?? '',
    category: initial?.category ?? '',
    price: initial ? String(initial.price) : '',
    quantity: initial ? String(initial.quantity) : '',
    colourName: '',
    hex: NEUTRAL,
  });
  const [errors, setErrors] = useState<FieldErrors<Field>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const paintId = useId();

  const existing = useExistingModel(draft.make, draft.model, props.mode === 'add');
  // A multi-colour model's stock is changed per colour (restock, or adding units of a colour), not as one total.
  const stockPerColour = initial !== undefined && initial.colours.length > 1;

  const set = (field: keyof Draft) => (event: { target: { value: string } }) =>
    setDraft((d) => ({ ...d, [field]: event.target.value }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    // Price and category of an existing model come from that model.
    const effective = existing ? { ...draft, price: String(existing.price), category: existing.category } : draft;
    const { errors: found, value } = validate(effective, { checkQuantity: !stockPerColour });
    setErrors(found);
    setFormError(null);
    if (!value) return;

    setSaving(true);
    try {
      if (props.mode === 'add') {
        await props.onSubmit(value);
      } else {
        const { colour: _ignored, ...fields } = value;
        await props.onSubmit(stockPerColour ? { ...fields, quantity: props.initial.quantity } : fields);
      }
    } catch (err) {
      const mapped = mapApiError(err, LABELS);
      setErrors(mapped.fields);
      setFormError(mapped.form);
      setSaving(false);
    }
  }

  const submitLabel = props.mode === 'edit' ? 'Save changes' : existing ? 'Add colour' : 'Add vehicle';

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-4">
      <FormAlert message={formError} />
      <div className="grid grid-cols-2 gap-4">
        <TextField label="Make" value={draft.make} onChange={set('make')} error={errors.make} maxLength={100} />
        <TextField label="Model" value={draft.model} onChange={set('model')} error={errors.model} maxLength={100} />
      </div>

      {existing && (
        <div className="rounded-control border border-border bg-page px-3 py-2 text-sm">
          <p className="font-medium">
            {vehicleName(existing)} is already listed as {existing.sku}.
          </p>
          <p className="text-muted">This adds the colour to it. Price and category come from the model.</p>
        </div>
      )}

      <SelectField
        label="Category"
        value={existing ? existing.category : draft.category}
        onChange={set('category')}
        options={CATEGORIES}
        placeholder="Choose…"
        disabled={existing !== undefined}
        error={errors.category}
      />
      <div className="grid grid-cols-2 gap-4">
        <TextField
          label="Price"
          type="number"
          inputMode="decimal"
          step="0.01"
          min={0}
          value={existing ? String(existing.price) : draft.price}
          onChange={set('price')}
          disabled={existing !== undefined}
          error={errors.price}
        />
        {!stockPerColour && (
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
        )}
      </div>
      {stockPerColour && (
        <p className="text-sm text-muted">
          Stock is kept per colour. Use Restock, or Add vehicle with this make and model, to change it.
        </p>
      )}

      {props.mode === 'add' && (
        <fieldset className="flex flex-col gap-3 rounded-control border border-border p-3">
          <legend className="px-1 text-sm font-medium">Colour</legend>
          <div className="flex flex-wrap gap-1.5">
            {PAINT_PRESETS.map((preset) => (
              <button
                key={preset.name}
                type="button"
                aria-pressed={draft.colourName === preset.name && draft.hex === preset.hex}
                onClick={() => setDraft((d) => ({ ...d, colourName: preset.name, hex: preset.hex }))}
                className="inline-flex h-7 items-center gap-1.5 rounded-full border border-border px-2.5 text-sm hover:bg-surface-hover aria-pressed:border-accent"
              >
                <Swatch hex={preset.hex} />
                {preset.name}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-[1fr_auto] items-end gap-3">
            <TextField
              label="Colour name"
              value={draft.colourName}
              onChange={set('colourName')}
              hint="Leave blank for a single Standard colour"
              error={errors.colourName}
              maxLength={40}
            />
            <div className="flex flex-col gap-1.5">
              <label htmlFor={paintId} className="text-sm font-medium">
                Paint
              </label>
              <input
                id={paintId}
                type="color"
                value={draft.hex}
                onChange={set('hex')}
                className="h-9 w-14 cursor-pointer rounded-control border border-border-strong bg-surface p-1"
              />
            </div>
          </div>
        </fieldset>
      )}

      <div className="mt-2 flex justify-end gap-2">
        <Button onClick={props.onCancel}>Cancel</Button>
        <Button type="submit" variant="primary" disabled={saving}>
          {saving ? 'Saving…' : submitLabel}
        </Button>
      </div>
    </form>
  );
}
