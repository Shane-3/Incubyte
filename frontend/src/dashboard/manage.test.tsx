import { screen, waitFor, within } from '@testing-library/react';
import { ApiError } from '../api/client';
import type { User, Vehicle } from '../api/types';
import { dana, fakeApi, priya, vehicle } from '../test/fake-api';
import { renderApp } from '../test/render';

const camry = vehicle({ id: 'v-camry', model: 'Camry', category: 'Sedan', price: 28400, quantity: 6 });
const rav4 = vehicle({ id: 'v-rav4', model: 'RAV4', category: 'SUV', price: 31900, quantity: 2 });

function apiFor(user: User = priya, vehicles: Vehicle[] = [camry, rav4]) {
  const api = fakeApi();
  api.auth.me.mockResolvedValue(user);
  api.vehicles.search.mockResolvedValue({ data: vehicles, count: vehicles.length });
  api.vehicles.forecast.mockResolvedValue({
    windowDays: 30,
    atRiskDays: 7,
    data: [
      { vehicleId: 'v-rav4', avgDailySales: 0.6, daysOfStockLeft: 3.3, atRisk: true, suggestedRestock: 16 },
      { vehicleId: 'v-camry', avgDailySales: 0, daysOfStockLeft: null, atRisk: false, suggestedRestock: 0 },
    ],
  });
  return api;
}

async function openRowAction(user: ReturnType<typeof renderApp>['user'], name: string, action: string) {
  const table = await screen.findByRole('table', { name: 'Vehicles' });
  const row = (await within(table).findByText(name)).closest('tr')!;
  await user.click(within(row).getByRole('button', { name: `More actions for ${name}` }));
  await user.click(screen.getByRole('menuitem', { name: action }));
}

describe('add vehicle', () => {
  it('adds a vehicle from the drawer', async () => {
    const api = apiFor();
    api.vehicles.create.mockResolvedValue({ vehicle: rav4, merged: false });
    const { user } = renderApp({ api });

    await user.click(await screen.findByRole('button', { name: 'Add vehicle' }));
    const drawer = screen.getByRole('dialog', { name: 'Add vehicle' });
    await user.type(within(drawer).getByLabelText('Make'), 'Toyota');
    await user.type(within(drawer).getByLabelText('Model'), 'RAV4');
    await user.selectOptions(within(drawer).getByLabelText('Category'), 'SUV');
    await user.type(within(drawer).getByLabelText('Price'), '31900');
    await user.type(within(drawer).getByLabelText('Quantity'), '3');
    await user.click(within(drawer).getByRole('button', { name: 'Add vehicle' }));

    expect(api.vehicles.create).toHaveBeenCalledWith({
      make: 'Toyota',
      model: 'RAV4',
      category: 'SUV',
      price: 31900,
      quantity: 3,
    });
    expect(await screen.findByText('Added Toyota RAV4')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('checks the fields before sending', async () => {
    const api = apiFor();
    const { user } = renderApp({ api });

    await user.click(await screen.findByRole('button', { name: 'Add vehicle' }));
    const drawer = screen.getByRole('dialog', { name: 'Add vehicle' });
    await user.type(within(drawer).getByLabelText('Price'), '-5');
    await user.type(within(drawer).getByLabelText('Quantity'), '1.5');
    await user.click(within(drawer).getByRole('button', { name: 'Add vehicle' }));

    expect(within(drawer).getByLabelText('Make')).toHaveAccessibleDescription('Enter a make');
    expect(within(drawer).getByLabelText('Category')).toHaveAccessibleDescription('Choose a category');
    expect(within(drawer).getByLabelText('Price')).toHaveAccessibleDescription('Price must be 0 or more');
    expect(within(drawer).getByLabelText('Quantity')).toHaveAccessibleDescription('Quantity must be a whole number');
    expect(api.vehicles.create).not.toHaveBeenCalled();
  });

  it('shows server field errors on the right field', async () => {
    const api = apiFor();
    api.vehicles.create.mockRejectedValue(
      new ApiError(400, 'VALIDATION_ERROR', 'Request validation failed', [
        { field: 'make', message: 'contains characters that are not allowed' },
      ]),
    );
    const { user } = renderApp({ api });

    await user.click(await screen.findByRole('button', { name: 'Add vehicle' }));
    const drawer = screen.getByRole('dialog', { name: 'Add vehicle' });
    await user.type(within(drawer).getByLabelText('Make'), 'Toyota™');
    await user.type(within(drawer).getByLabelText('Model'), 'RAV4');
    await user.selectOptions(within(drawer).getByLabelText('Category'), 'SUV');
    await user.type(within(drawer).getByLabelText('Price'), '31900');
    await user.type(within(drawer).getByLabelText('Quantity'), '3');
    await user.click(within(drawer).getByRole('button', { name: 'Add vehicle' }));

    await waitFor(() =>
      expect(within(drawer).getByLabelText('Make')).toHaveAccessibleDescription(
        'Make contains characters that are not allowed',
      ),
    );
  });

  it('closes on Escape', async () => {
    const { user } = renderApp({ api: apiFor() });

    await user.click(await screen.findByRole('button', { name: 'Add vehicle' }));
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('edit vehicle', () => {
  it('prefills the drawer and sends only what changed', async () => {
    const api = apiFor(priya);
    api.vehicles.update.mockResolvedValue({ ...camry, price: 27999 });
    const { user } = renderApp({ api });

    await openRowAction(user, 'Toyota Camry', 'Edit');
    const drawer = screen.getByRole('dialog', { name: 'Edit Toyota Camry' });
    expect(within(drawer).getByLabelText('Model')).toHaveValue('Camry');
    const price = within(drawer).getByLabelText('Price');
    await user.clear(price);
    await user.type(price, '27999');
    await user.click(within(drawer).getByRole('button', { name: 'Save changes' }));

    expect(api.vehicles.update).toHaveBeenCalledWith('v-camry', { price: 27999 });
    expect(await screen.findByText('Saved Toyota Camry')).toBeInTheDocument();
  });
});

describe('sold-out rows', () => {
  const crv = vehicle({ id: 'v-crv', make: 'Honda', model: 'CR-V', category: 'SUV', price: 32450, quantity: 0 });

  it('offer admins Restock instead of Notify me, next to a disabled Purchase', async () => {
    const api = apiFor(dana, [camry, crv]);
    const { user } = renderApp({ api });

    const row = (await within(await screen.findByRole('table', { name: 'Vehicles' })).findByText('Honda CR-V')).closest(
      'tr',
    )!;
    expect(within(row).queryByRole('button', { name: 'Notify me' })).toBeNull();
    expect(within(row).getByRole('button', { name: 'Purchase' })).toBeDisabled();
    await user.click(within(row).getByRole('button', { name: 'Restock' }));

    expect(screen.getByRole('dialog', { name: 'Restock Honda CR-V' })).toBeInTheDocument();
  });

  it('keep Notify me for regular users, with no Restock button', async () => {
    renderApp({ api: apiFor(priya, [crv]) });

    const row = (await within(await screen.findByRole('table', { name: 'Vehicles' })).findByText('Honda CR-V')).closest(
      'tr',
    )!;
    expect(within(row).getByRole('button', { name: 'Notify me' })).toBeInTheDocument();
    expect(within(row).queryByRole('button', { name: 'Restock' })).toBeNull();
  });

  it('show no row-level Restock button for admins while there is stock', async () => {
    renderApp({ api: apiFor(dana, [camry]) });

    const row = (
      await within(await screen.findByRole('table', { name: 'Vehicles' })).findByText('Toyota Camry')
    ).closest('tr')!;
    expect(within(row).queryByRole('button', { name: 'Restock' })).toBeNull();
    expect(within(row).getByRole('button', { name: 'Purchase' })).toBeEnabled();
  });
});

describe('restock (admins)', () => {
  it('prefills the suggested quantity from the forecast', async () => {
    const api = apiFor(dana);
    api.vehicles.restock.mockResolvedValue({ ...rav4, quantity: 18 });
    const { user } = renderApp({ api });

    await openRowAction(user, 'Toyota RAV4', 'Restock');
    const drawer = screen.getByRole('dialog', { name: 'Restock Toyota RAV4' });
    const quantity = within(drawer).getByLabelText('Units to add');
    await waitFor(() => expect(quantity).toHaveValue(16));
    expect(quantity).toHaveAccessibleDescription('Suggested: 16 (covers 30 days of sales)');
    await user.click(within(drawer).getByRole('button', { name: 'Restock' }));

    expect(api.vehicles.restock).toHaveBeenCalledWith('v-rav4', 16, 'v-rav4-standard');
    expect(await screen.findByText('Restocked Toyota RAV4: 18 in stock')).toBeInTheDocument();
  });

  it('leaves the field empty when there is nothing to suggest, and requires at least one unit', async () => {
    const api = apiFor(dana);
    const { user } = renderApp({ api });

    await openRowAction(user, 'Toyota Camry', 'Restock');
    const drawer = screen.getByRole('dialog', { name: 'Restock Toyota Camry' });
    expect(within(drawer).getByLabelText('Units to add')).toHaveValue(null);
    await user.click(within(drawer).getByRole('button', { name: 'Restock' }));

    expect(within(drawer).getByLabelText('Units to add')).toHaveAccessibleDescription('Enter at least 1 unit');
    expect(api.vehicles.restock).not.toHaveBeenCalled();
  });
});

describe('delete (admins)', () => {
  it('asks for confirmation naming the vehicle', async () => {
    const api = apiFor(dana);
    api.vehicles.remove.mockResolvedValue(undefined);
    const { user } = renderApp({ api });

    await openRowAction(user, 'Toyota Camry', 'Delete');
    const confirm = screen.getByRole('alertdialog', { name: 'Delete Toyota Camry?' });
    await user.click(within(confirm).getByRole('button', { name: 'Delete' }));

    expect(api.vehicles.remove).toHaveBeenCalledWith('v-camry');
    expect(await screen.findByText('Deleted Toyota Camry')).toBeInTheDocument();
  });

  it('does nothing on cancel', async () => {
    const api = apiFor(dana);
    const { user } = renderApp({ api });

    await openRowAction(user, 'Toyota Camry', 'Delete');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(api.vehicles.remove).not.toHaveBeenCalled();
  });
});
