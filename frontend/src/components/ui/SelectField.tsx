import { type SelectHTMLAttributes, useId } from 'react';

export interface SelectFieldProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> {
  label: string;
  error?: string;
  options: readonly string[];
  placeholder?: string;
}

export function SelectField({ label, error, options, placeholder, className = '', ...props }: SelectFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-sm font-medium text-text">
        {label}
      </label>
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className="h-9 rounded-control border border-border-strong bg-surface px-2 text-base text-text aria-invalid:border-out"
        {...props}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      {error && (
        <p id={errorId} className="text-xs text-out">
          {error}
        </p>
      )}
    </div>
  );
}
