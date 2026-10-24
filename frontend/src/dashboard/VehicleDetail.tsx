import { useState } from 'react';
import type { Vehicle } from '../api/types';
import { CarIllustration } from '../components/CarIllustration';
import { bestStocked, ColourPicker, stockText } from '../components/ColourSwatches';
import { Drawer } from '../components/ui/Drawer';
import { formatPrice } from '../lib/format';
import { StockPill } from './StockStatus';
import { vehicleName } from './VehicleTable';

/** The model up close: the car repainted in whichever colour is chosen, with that colour's stock. */
export function VehicleDetail({ vehicle, onClose }: { vehicle: Vehicle; onClose: () => void }) {
  const name = vehicleName(vehicle);
  const [colourId, setColourId] = useState(() => bestStocked(vehicle.colours)?.id ?? '');
  const colour = vehicle.colours.find((c) => c.id === colourId) ?? vehicle.colours[0];

  return (
    <Drawer title={name} description={vehicle.category} onClose={onClose}>
      <div className="flex flex-col gap-5">
        <div className="rounded-panel border border-border bg-page px-4 pt-6 pb-3">
          {colour && (
            <CarIllustration
              category={vehicle.category}
              hex={colour.hex}
              label={`${name} in ${colour.name}`}
              className="w-full"
            />
          )}
          <p className="mt-2 text-center text-sm text-muted">
            {colour ? `${colour.name} · ${stockText(colour)}` : 'No colours yet'}
          </p>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-base">
          <div>
            <dt className="text-xs text-muted">SKU</dt>
            <dd className="font-mono">{vehicle.sku}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Price</dt>
            <dd className="tabular-nums">{formatPrice(vehicle.price)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Category</dt>
            <dd>{vehicle.category}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Stock, all colours</dt>
            <dd className="flex items-center gap-2">
              <span className="tabular-nums">{vehicle.quantity}</span>
              <StockPill quantity={vehicle.quantity} />
            </dd>
          </div>
        </dl>

        <section>
          <h3 className="mb-2 text-sm font-medium">
            {vehicle.colours.length === 1 ? '1 colour' : `${vehicle.colours.length} colours`}
          </h3>
          <ColourPicker colours={vehicle.colours} value={colour?.id ?? ''} onChange={setColourId} />
        </section>
      </div>
    </Drawer>
  );
}
