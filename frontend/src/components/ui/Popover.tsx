import { type ReactNode, useEffect, useRef } from 'react';

interface PopoverProps {
  label: string;
  onClose: () => void;
  children: ReactNode;
}

/**
 * Small non-modal dialog anchored under its trigger (render it inside a relatively positioned wrapper).
 * Focus moves in on open; Escape and outside clicks close it.
 */
export function Popover({ label, onClose, children }: PopoverProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const panel = ref.current;
    panel?.querySelector<HTMLElement>('input, button')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const onPointerDown = (e: PointerEvent) => {
      if (panel && !panel.contains(e.target as Node)) onClose();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={label}
      className="absolute top-full right-0 z-30 mt-1.5 w-64 rounded-panel border border-border bg-surface p-3 text-left shadow-float"
    >
      {children}
    </div>
  );
}
