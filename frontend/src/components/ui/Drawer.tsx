import { X } from 'lucide-react';
import { type ReactNode, useId, useRef } from 'react';
import { useDialogFocus } from './useDialogFocus';

interface DrawerProps {
  title: string;
  description?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}

/** Right-side modal panel for forms (design.md 6.3), not a centred modal. */
export function Drawer({ title, description, onClose, children }: DrawerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useDialogFocus(ref, onClose);

  return (
    <div className="fixed inset-0 z-40">
      <div aria-hidden="true" className="absolute inset-0 bg-overlay" onClick={onClose} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="absolute inset-y-0 right-0 flex w-full max-w-[420px] flex-col rounded-l-drawer border-l border-border bg-surface shadow-float"
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <h2 id={titleId} className="text-lg font-semibold">
              {title}
            </h2>
            {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="inline-flex size-7 items-center justify-center rounded-control text-muted hover:bg-surface-hover hover:text-text"
          >
            <X aria-hidden="true" className="size-4" strokeWidth={1.5} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
      </div>
    </div>
  );
}
