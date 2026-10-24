import { useId } from 'react';
import type { Colour } from '../api/types';

export function stockText(colour: Pick<Colour, 'quantity'>): string {
  return colour.quantity === 0 ? 'sold out' : `${colour.quantity} in stock`;
}

/** A dot of paint. The hex is validated server-side to #rrggbb before it ever reaches the fill. */
export function Swatch({ hex, size = 12, soldOut = false }: { hex: string; size?: number; soldOut?: boolean }) {
  const r = size / 2;
  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      aria-hidden="true"
      className="shrink-0 text-paint-outline"
    >
      <circle cx={r} cy={r} r={r - 0.75} fill={hex} stroke="currentColor" strokeWidth="1.5" />
      {soldOut && <line x1="2" y1={size - 2} x2={size - 2} y2="2" stroke="currentColor" strokeWidth="1.5" />}
    </svg>
  );
}

/** Compact row of colours with their stock read out to screen readers. */
export function ColourSwatches({ colours, label, max = 5 }: { colours: Colour[]; label: string; max?: number }) {
  const shown = colours.slice(0, max);
  const hidden = colours.length - shown.length;
  return (
    <ul aria-label={label} className="flex items-center gap-1">
      {shown.map((c) => (
        <li key={c.id} title={`${c.name}, ${stockText(c)}`} className="inline-flex">
          <Swatch hex={c.hex} soldOut={c.quantity === 0} />
          <span className="sr-only">
            {c.name}, {stockText(c)}
          </span>
        </li>
      ))}
      {hidden > 0 && <li className="text-xs text-muted">+{hidden}</li>}
    </ul>
  );
}

interface ColourPickerProps {
  colours: Colour[];
  value: string;
  onChange: (colourId: string) => void;
  /** Purchases cannot pick a colour with no stock; browsing and restocking can. */
  disableSoldOut?: boolean;
}

/** Radio group of paint swatches with each colour's stock. Native radios, so arrow keys just work. */
export function ColourPicker({ colours, value, onChange, disableSoldOut = false }: ColourPickerProps) {
  const name = useId();
  return (
    <div role="radiogroup" aria-label="Colour" className="flex flex-col gap-1">
      {colours.map((c) => {
        const disabled = disableSoldOut && c.quantity === 0;
        return (
          <label
            key={c.id}
            className={`flex cursor-pointer items-center gap-2.5 rounded-control border px-2.5 py-1.5 text-base has-checked:border-accent has-focus-visible:outline-2 has-focus-visible:outline-accent ${
              disabled ? 'cursor-not-allowed border-border opacity-50' : 'border-border hover:bg-surface-hover'
            }`}
          >
            <input
              type="radio"
              name={name}
              value={c.id}
              checked={value === c.id}
              disabled={disabled}
              onChange={() => onChange(c.id)}
              aria-label={`${c.name}, ${stockText(c)}`}
              className="sr-only"
            />
            <Swatch hex={c.hex} size={16} />
            <span aria-hidden="true" className="min-w-0 flex-1 truncate">
              {c.name}
            </span>
            <span aria-hidden="true" className="text-sm text-muted tabular-nums">
              {stockText(c)}
            </span>
          </label>
        );
      })}
    </div>
  );
}

/** The colour with the most stock; the first listed wins a tie. */
export function bestStocked(colours: Colour[]): Colour | undefined {
  return colours.reduce<Colour | undefined>((best, c) => (!best || c.quantity > best.quantity ? c : best), undefined);
}
