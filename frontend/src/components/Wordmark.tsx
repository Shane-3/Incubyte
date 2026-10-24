/** Product wordmark: a squared "F" mark and the name. Decorative mark, readable name. */
export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-semibold tracking-tight text-text ${className}`}>
      <svg viewBox="0 0 32 32" className="size-6" aria-hidden="true">
        <rect width="32" height="32" rx="7" className="fill-accent" />
        <path d="M9 22V10h13M9 16h9" fill="none" className="stroke-on-accent" strokeWidth="3" strokeLinecap="square" />
      </svg>
      Forecourt
    </span>
  );
}
