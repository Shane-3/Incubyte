import { type InputHTMLAttributes, useId } from 'react';

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string;
  /** Shown under the field until there is an error, which replaces it. */
  hint?: string;
  error?: string;
}

/** Labelled input whose hint or error is wired to aria-describedby, so screen readers announce it. */
export function TextField({ label, hint, error, className = '', ...props }: TextFieldProps) {
  const id = useId();
  const descriptionId = `${id}-description`;
  const description = error ?? hint;

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-sm font-medium text-text">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={description ? descriptionId : undefined}
        className="h-9 rounded-control border border-border-strong bg-surface px-2.5 text-base text-text placeholder:text-muted aria-invalid:border-out"
        {...props}
      />
      {description && (
        <p id={descriptionId} className={`text-xs ${error ? 'text-out' : 'text-muted'}`}>
          {description}
        </p>
      )}
    </div>
  );
}
