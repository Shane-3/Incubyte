const priceWithCents = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

const wholeCurrency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const integer = new Intl.NumberFormat('en-US');

/** $28,400 or $27,999.50: cents only when there are some, and then always two digits. */
export function formatPrice(value: number): string {
  return Number.isInteger(value) ? wholeCurrency.format(value) : priceWithCents.format(value);
}

/** Rounded to whole dollars, for totals. */
export function formatCurrencyTotal(value: number): string {
  return wholeCurrency.format(value);
}

export function formatInteger(value: number): string {
  return integer.format(value);
}

export function pluralise(count: number, singular: string, plural = `${singular}s`): string {
  return `${formatInteger(count)} ${count === 1 ? singular : plural}`;
}

const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto', style: 'short' });
const UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['day', 86_400_000],
  ['hour', 3_600_000],
  ['minute', 60_000],
];

/** "5 min. ago", "yesterday". */
export function formatRelative(iso: string, now = Date.now()): string {
  const diff = new Date(iso).getTime() - now;
  for (const [unit, ms] of UNITS) {
    if (Math.abs(diff) >= ms) return relative.format(Math.round(diff / ms), unit);
  }
  return 'just now';
}
