import type { Vehicle, VehicleForecast } from '../api/types';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Drawer } from '../components/ui/Drawer';
import { useToast } from '../components/ui/Toast';
import { errorMessage, useCreateVehicle, useDeleteVehicle, useRestock, useUpdateVehicle } from './mutations';
import { RestockForm } from './RestockForm';
import { changedFields, VehicleForm } from './VehicleForm';
import { vehicleName } from './VehicleTable';

export type Panel =
  | { kind: 'add' }
  | { kind: 'edit'; vehicle: Vehicle }
  | { kind: 'restock'; vehicle: Vehicle }
  | { kind: 'delete'; vehicle: Vehicle };

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
      <Drawer title="Add vehicle" description="It appears in the inventory straight away." onClose={onClose}>
        <VehicleForm
          submitLabel="Add vehicle"
          onCancel={onClose}
          onSubmit={async (input) => {
            const created = await create.mutateAsync(input);
            toast.success(`Added ${vehicleName(created)}`);
            onClose();
          }}
        />
      </Drawer>
    );
  }

  const { vehicle } = panel;
  const name = vehicleName(vehicle);

  if (panel.kind === 'edit') {
    return (
      <Drawer title={`Edit ${name}`} onClose={onClose}>
        <VehicleForm
          initial={vehicle}
          submitLabel="Save changes"
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
          onSubmit={async (quantity) => {
            const updated = await restock.mutateAsync({ id: vehicle.id, quantity });
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
