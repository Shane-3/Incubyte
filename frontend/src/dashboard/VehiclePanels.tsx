import type { NewVehicleInput, Vehicle, VehicleForecast } from '../api/types';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Drawer } from '../components/ui/Drawer';
import { useToast } from '../components/ui/Toast';
import { pluralise } from '../lib/format';
import { errorMessage, useCreateVehicle, useDeleteVehicle, useRestock, useUpdateVehicle } from './mutations';
import { RestockForm } from './RestockForm';
import { VehicleDetail } from './VehicleDetail';
import { changedFields, VehicleForm } from './VehicleForm';
import { vehicleName } from './VehicleTable';

export type Panel =
  | { kind: 'add' }
  | { kind: 'detail'; vehicle: Vehicle }
  | { kind: 'edit'; vehicle: Vehicle }
  | { kind: 'restock'; vehicle: Vehicle }
  | { kind: 'delete'; vehicle: Vehicle };

/** "2 × Blue", or "5 units in 2 colours" when several were received at once. */
function receivedText(input: NewVehicleInput): string {
  const colours = input.colours ?? [{ name: input.colour?.name ?? 'Standard', quantity: input.quantity }];
  if (colours.length === 1) return `${colours[0]!.quantity} × ${colours[0]!.name}`;
  return `${pluralise(input.quantity, 'unit')} in ${colours.length} colours`;
}

interface VehiclePanelsProps {
  panel: Panel | null;
  onClose: () => void;
  forecastById?: Map<string, VehicleForecast>;
  windowDays?: number;
}

/** The add/edit/restock drawers and the delete confirmation, one at a time. */
export function VehiclePanels({ panel, onClose, forecastById, windowDays }: VehiclePanelsProps) {
  const toast = useToast();
  const create = useCreateVehicle();
  const update = useUpdateVehicle();
  const restock = useRestock();
  const remove = useDeleteVehicle();

  if (!panel) return null;

  if (panel.kind === 'add') {
    return (
      <Drawer title="Add vehicle" description="Already listed? The colours are added to that model." onClose={onClose}>
        <VehicleForm
          mode="add"
          onCancel={onClose}
          onSubmit={async (input) => {
            const { vehicle, merged } = await create.mutateAsync(input);
            toast.success(
              merged ? `Added ${receivedText(input)} to ${vehicleName(vehicle)}` : `Added ${vehicleName(vehicle)}`,
            );
            onClose();
          }}
        />
      </Drawer>
    );
  }

  const { vehicle } = panel;
  const name = vehicleName(vehicle);

  if (panel.kind === 'detail') {
    return <VehicleDetail vehicle={vehicle} onClose={onClose} />;
  }

  if (panel.kind === 'edit') {
    return (
      <Drawer title={`Edit ${name}`} onClose={onClose}>
        <VehicleForm
          mode="edit"
          initial={vehicle}
          onCancel={onClose}
          onSubmit={async (input) => {
            const changes = changedFields(vehicle, input);
            if (Object.keys(changes).length > 0) {
              const saved = await update.mutateAsync({ id: vehicle.id, changes });
              toast.success(`Saved ${vehicleName(saved)}`);
            }
            onClose();
          }}
        />
      </Drawer>
    );
  }

  if (panel.kind === 'restock') {
    const suggestion = forecastById?.get(vehicle.id)?.suggestedRestock;
    return (
      <Drawer title={`Restock ${name}`} onClose={onClose}>
        <RestockForm
          vehicle={vehicle}
          suggested={suggestion || undefined}
          windowDays={windowDays}
          onCancel={onClose}
          onSubmit={async (colours) => {
            const updated = await restock.mutateAsync({ id: vehicle.id, colours });
            toast.success(`Restocked ${name}: ${updated.quantity} in stock`);
            onClose();
          }}
        />
      </Drawer>
    );
  }

  return (
    <ConfirmDialog
      title={`Delete ${name}?`}
      confirmLabel="Delete"
      busy={remove.isPending}
      onCancel={onClose}
      onConfirm={() =>
        remove.mutate(vehicle.id, {
          onSuccess: () => {
            toast.success(`Deleted ${name}`);
            onClose();
          },
          onError: (err) => toast.error(`Couldn't delete ${name}: ${errorMessage(err)}`),
        })
      }
    >
      This removes it from inventory together with its sales history and alerts. You can&apos;t undo this.
    </ConfirmDialog>
  );
}
