import { type KeyboardEvent, type ReactNode, useEffect, useId, useRef, useState } from 'react';

export interface MenuItem {
  label: string;
  onSelect: () => void;
  tone?: 'default' | 'danger';
}

interface MenuProps {
  /** Accessible name for the trigger, e.g. "More actions for Toyota Camry". */
  label: string;
  trigger: ReactNode;
  items: MenuItem[];
  align?: 'start' | 'end';
}

/** WAI-ARIA menu button: arrow keys move, Esc closes and returns focus, outside click closes. */
export function Menu({ label, trigger, items, align = 'end' }: MenuProps) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    itemRefs.current[0]?.focus();
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  function close(returnFocus = true) {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }

  function onMenuKeyDown(event: KeyboardEvent) {
    const index = itemRefs.current.findIndex((el) => el === document.activeElement);
    const move = (to: number) => itemRefs.current[(to + items.length) % items.length]?.focus();
    if (event.key === 'ArrowDown') move(index + 1);
    else if (event.key === 'ArrowUp') move(index - 1);
    else if (event.key === 'Home') move(0);
    else if (event.key === 'End') move(items.length - 1);
    else if (event.key === 'Escape') close();
    else if (event.key === 'Tab') close(false);
    else return;
    event.preventDefault();
  }

  return (
    <div ref={rootRef} className="relative inline-flex">
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className="inline-flex size-7 items-center justify-center rounded-control text-muted hover:bg-surface-hover hover:text-text"
      >
        {trigger}
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label={label}
          tabIndex={-1}
          onKeyDown={onMenuKeyDown}
          className={`absolute top-full z-30 mt-1 min-w-36 rounded-panel border border-border bg-surface py-1 shadow-float ${
            align === 'end' ? 'right-0' : 'left-0'
          }`}
        >
          {items.map((item, i) => (
            <button
              key={item.label}
              ref={(el) => {
                itemRefs.current[i] = el;
              }}
              type="button"
              role="menuitem"
              tabIndex={-1}
              onClick={() => {
                close(false);
                item.onSelect();
              }}
              className={`flex w-full items-center px-3 py-1.5 text-left text-base hover:bg-surface-hover focus-visible:bg-surface-hover focus-visible:outline-none ${
                item.tone === 'danger' ? 'text-out' : 'text-text'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
