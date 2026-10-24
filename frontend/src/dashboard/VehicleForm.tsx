import { useQuery } from '@tanstack/react-query';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { CATEGORIES, type Category, type NewVehicleInput, type Vehicle, type VehicleInput } from '../api/types';
import { useApi } from '../app/ApiContext';
import { Button } from '../components/ui/Button';
import { FormAlert } from '../components/ui/FormAlert';
import { SelectField } from '../components/ui/SelectField';
import { TextField } from '../components/ui/TextField';
import { type FieldErrors, mapApiError } from '../lib/form-errors';
import { type ColourRow, ColourRows, type RowErrors, totalUnits, validateRows } from './ColourRows';
import { vehicleName } from './VehicleTable';

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

function validate(draft: Draft, { checkQuantity }: { checkQuantity: boolean }) {
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

  const value: VehicleInput = {
    make: draft.make.trim(),
    model: draft.model.trim(),
    category: draft.category as Category,
    price,
    quantity,
  };
  return { errors, value: Object.keys(errors).length === 0 ? value : undefined };
}

/** Only the fields that differ from the original, so an edit never overwrites concurrent stock changes needlessly. */
export function changedFields(original: Vehicle, next: VehicleInput): Partial<VehicleInput> {
  const changes: Partial<VehicleInput> = {};
  for (const key of ['make', 'model', 'category', 'price', 'quantity'] as const) {
    if (next[key] !== original[key]) Object.assign(changes, { [key]: next[key] });
  }
  return changes;
}

/** Looks the make + model up once typing pauses, so the form can say it will add colours to it. */
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
  });
  const [rows, setRows] = useState<ColourRow[]>([]);
  const [rowErrors, setRowErrors] = useState<RowErrors>([]);
  const [errors, setErrors] = useState<FieldErrors<Field>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const rowKey = useRef(0);

  const existing = useExistingModel(draft.make, draft.model, props.mode === 'add');
  // A multi-colour model's stock is changed per colour (restock, or adding units of a colour), not as one total.
  const stockPerColour = initial !== undefined && initial.colours.length > 1;
  // When colours are listed, the quantity is their total rather than a separate field.
  const quantityFromColours = rows.length > 0;

  const set = (field: Field) => (event: { target: { value: string } }) =>
    setDraft((d) => ({ ...d, [field]: event.target.value }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    // Price and category of an existing model come from that model.
    const effective = existing ? { ...draft, price: String(existing.price), category: existing.category } : draft;
    const checked = validate(effective, { checkQuantity: !stockPerColour && !quantityFromColours });
    const colourCheck = validateRows(rows);
    setErrors(checked.errors);
    setRowErrors(colourCheck.errors);
    setFormError(null);
    if (!checked.value || (quantityFromColours && !colourCheck.colours)) return;

    setSaving(true);
    try {
      if (props.mode === 'add') {
        await props.onSubmit(
          colourCheck.colours && quantityFromColours
            ? { ...checked.value, quantity: totalUnits(rows), colours: colourCheck.colours }
            : checked.value,
        );
      } else {
        await props.onSubmit(stockPerColour ? { ...checked.value, quantity: props.initial.quantity } : checked.value);
      }
    } catch (err) {
      const mapped = mapApiError(err, LABELS);
      setErrors(mapped.fields);
      setFormError(mapped.form);
      setSaving(false);
    }
  }

  const submitLabel = props.mode === 'edit' ? 'Save changes' : existing ? 'Add colours' : 'Add vehicle';

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
          <p className="text-muted">This adds the colours to it. Price and category come from the model.</p>
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
        {!stockPerColour && !quantityFromColours && (
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
        {quantityFromColours && (
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Total units</span>
            <p className="flex h-9 items-center text-base tabular-nums">
              {totalUnits(rows)} <span className="ml-1.5 text-sm text-muted">from the colours below</span>
            </p>
          </div>
        )}
      </div>
      {stockPerColour && (
        <p className="text-sm text-muted">
          Stock is kept per colour. Use Restock, or Add vehicle with this make and model, to change it.
        </p>
      )}

      {props.mode === 'add' && (
        <ColourRows
          rows={rows}
          errors={rowErrors}
          onChange={(next) => {
            setRows(next);
            setRowErrors([]);
          }}
          nextKey={() => ++rowKey.current}
        />
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
