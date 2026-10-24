import { Bell, BellRing, Minus, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Vehicle } from '../api/types';
import { Button } from '../components/ui/Button';
import { Popover } from '../components/ui/Popover';
import { useToast } from '../components/ui/Toast';
import { formatPrice } from '../lib/format';
import { errorMessage, usePurchase, useWatchToggle } from './mutations';
import { vehicleName } from './VehicleTable';

const MAX_PER_PURCHASE = 10;

function PurchaseControl({ vehicle }: { vehicle: Vehicle }) {
  const [open, setOpen] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const purchase = usePurchase();
  const toast = useToast();
  const name = vehicleName(vehicle);
  const max = Math.min(MAX_PER_PURCHASE, vehicle.quantity);
  const soldOut = vehicle.quantity === 0;

  function confirm() {
    purchase.mutate(
      { id: vehicle.id, quantity },
      {
        onSuccess: () => {
          toast.success(`Purchased ${quantity} × ${name}`);
          setOpen(false);
        },
        onError: (err) => toast.error(`Couldn't complete the purchase: ${errorMessage(err)}`),
      },
    );
  }

  return (
    <span className="relative inline-flex">
      <Button
        size="sm"
        disabled={soldOut}
        title={soldOut ? 'Out of stock' : undefined}
        aria-expanded={open}
        onClick={() => {
          setQuantity(1);
          setOpen((o) => !o);
        }}
      >
        Purchase
      </Button>
      {open && (
        <Popover label={`Purchase ${name}`} onClose={() => setOpen(false)}>
          <p className="mb-2.5 truncate font-medium">{name}</p>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="inline-flex items-center rounded-control border border-border-strong">
              <button
                type="button"
                aria-label="Decrease quantity"
                disabled={quantity <= 1}
                onClick={() => setQuantity((q) => q - 1)}
                className="inline-flex size-7 items-center justify-center text-text disabled:opacity-40"
              >
                <Minus aria-hidden="true" className="size-3.5" strokeWidth={1.75} />
              </button>
              <input
                type="number"
                aria-label="Quantity"
                min={1}
                max={max}
                value={quantity}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (Number.isInteger(n)) setQuantity(Math.min(Math.max(n, 1), max));
                }}
                className="h-7 w-10 border-x border-border-strong bg-surface text-center tabular-nums [appearance:textfield]"
              />
              <button
                type="button"
                aria-label="Increase quantity"
                disabled={quantity >= max}
                onClick={() => setQuantity((q) => q + 1)}
                className="inline-flex size-7 items-center justify-center text-text disabled:opacity-40"
              >
                <Plus aria-hidden="true" className="size-3.5" strokeWidth={1.75} />
              </button>
            </div>
            <span className="text-right">
              <span className="block text-xs text-muted">Total</span>
              <span className="font-semibold tabular-nums">{formatPrice(vehicle.price * quantity)}</span>
            </span>
          </div>
          <Button variant="primary" className="w-full" disabled={purchase.isPending} onClick={confirm}>
            {purchase.isPending ? 'Purchasing…' : 'Confirm purchase'}
          </Button>
          <p className="mt-2 text-xs text-muted">{vehicle.quantity} in stock</p>
        </Popover>
      )}
    </span>
  );
}

function WatchControl({ vehicle }: { vehicle: Vehicle }) {
  const [override, setOverride] = useState<boolean | null>(null);
  const toggle = useWatchToggle();
  const toast = useToast();
  const name = vehicleName(vehicle);
  const watching = override ?? vehicle.isWatching ?? false;

  useEffect(() => setOverride(null), [vehicle.isWatching]);

  function onClick() {
    const watch = !watching;
    toggle.mutate(
      { id: vehicle.id, watch },
      {
        onSuccess: () => {
          setOverride(watch);
          toast.success(watch ? `You'll be notified when ${name} is back in stock` : `Stopped watching ${name}`);
        },
        onError: (err) => toast.error(`Couldn't update notifications: ${errorMessage(err)}`),
      },
    );
  }

  const Icon = watching ? BellRing : Bell;
  return (
    <Button
      size="sm"
      variant={watching ? 'ghost' : 'secondary'}
      aria-pressed={watching}
      disabled={toggle.isPending}
      onClick={onClick}
    >
      <Icon aria-hidden="true" className="size-3.5" strokeWidth={1.75} />
      {watching ? 'Watching' : 'Notify me'}
    </Button>
  );
}

/** Purchase for everyone; on sold-out rows a Notify me / Watching toggle sits beside the disabled button. */
export function RowControls({ vehicle }: { vehicle: Vehicle }) {
  return (
    <>
      {vehicle.quantity === 0 && <WatchControl vehicle={vehicle} />}
      <PurchaseControl vehicle={vehicle} />
    </>
  );
}
