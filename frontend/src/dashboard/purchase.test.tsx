import { screen, waitFor, within } from '@testing-library/react';
import { ApiError } from '../api/client';
import type { Vehicle } from '../api/types';
import { fakeApi, priya, vehicle } from '../test/fake-api';
import { renderApp } from '../test/render';

const camry = vehicle({ id: 'v-camry', model: 'Camry', price: 28400, quantity: 6 });
const rav4 = vehicle({ id: 'v-rav4', model: 'RAV4', price: 31900, quantity: 2 });
const crv = vehicle({ id: 'v-crv', make: 'Honda', model: 'CR-V', price: 32450, quantity: 0 });

function apiWith(vehicles: Vehicle[] = [camry, rav4, crv]) {
  const api = fakeApi();
  api.auth.me.mockResolvedValue(priya);
  api.vehicles.search.mockResolvedValue({ data: vehicles, count: vehicles.length });
  return api;
}

async function rowFor(name: string) {
  const table = await screen.findByRole('table', { name: 'Vehicles' });
  return (await within(table).findByText(name)).closest('tr')!;
}

describe('purchase', () => {
  it('confirms a quantity and total before buying, then reports the sale', async () => {
    const api = apiWith();
    api.vehicles.purchase.mockResolvedValue({ ...camry, quantity: 4 });
    const { user } = renderApp({ api });

    await user.click(within(await rowFor('Toyota Camry')).getByRole('button', { name: 'Purchase' }));
    const dialog = screen.getByRole('dialog', { name: 'Purchase Toyota Camry' });
    expect(within(dialog).getByText('$28,400')).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Increase quantity' }));
    expect(within(dialog).getByText('$56,800')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Confirm purchase' }));

    expect(api.vehicles.purchase).toHaveBeenCalledWith('v-camry', 2);
    expect(await screen.findByText('Purchased 2 × Toyota Camry')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => expect(api.vehicles.search.mock.calls.length).toBeGreaterThan(1));
  });

  it('never offers more than is in stock', async () => {
    const { user } = renderApp({ api: apiWith() });

    await user.click(within(await rowFor('Toyota RAV4')).getByRole('button', { name: 'Purchase' }));
    const dialog = screen.getByRole('dialog', { name: 'Purchase Toyota RAV4' });
    await user.click(within(dialog).getByRole('button', { name: 'Increase quantity' }));

    expect(within(dialog).getByRole('spinbutton', { name: 'Quantity' })).toHaveValue(2);
    expect(within(dialog).getByRole('button', { name: 'Increase quantity' })).toBeDisabled();
  });

  it('shows the server’s reason when stock ran out in the meantime', async () => {
    const api = apiWith();
    api.vehicles.purchase.mockRejectedValue(new ApiError(409, 'OUT_OF_STOCK', 'Only 1 left in stock'));
    const { user } = renderApp({ api });

    await user.click(within(await rowFor('Toyota RAV4')).getByRole('button', { name: 'Purchase' }));
    await user.click(screen.getByRole('button', { name: 'Increase quantity' }));
    await user.click(screen.getByRole('button', { name: 'Confirm purchase' }));

    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't complete the purchase: Only 1 left in stock");
  });

  it('closes on Escape without buying', async () => {
    const api = apiWith();
    const { user } = renderApp({ api });

    await user.click(within(await rowFor('Toyota Camry')).getByRole('button', { name: 'Purchase' }));
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(api.vehicles.purchase).not.toHaveBeenCalled();
  });
});

describe('notify me', () => {
  it('is offered only on sold-out vehicles', async () => {
    renderApp({ api: apiWith() });

    expect(within(await rowFor('Honda CR-V')).getByRole('button', { name: 'Notify me' })).toBeInTheDocument();
    expect(within(await rowFor('Toyota Camry')).queryByRole('button', { name: 'Notify me' })).toBeNull();
  });

  it('subscribes and switches to Watching', async () => {
    const api = apiWith();
    api.vehicles.watch.mockResolvedValue({ watching: true });
    const { user } = renderApp({ api });

    await user.click(within(await rowFor('Honda CR-V')).getByRole('button', { name: 'Notify me' }));

    expect(api.vehicles.watch).toHaveBeenCalledWith('v-crv');
    expect(await screen.findByText("You'll be notified when Honda CR-V is back in stock")).toBeInTheDocument();
    expect(within(await rowFor('Honda CR-V')).getByRole('button', { name: 'Watching' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('stops watching from the Watching button', async () => {
    const api = apiWith([{ ...crv, isWatching: true }]);
    api.vehicles.unwatch.mockResolvedValue(undefined);
    const { user } = renderApp({ api });

    await user.click(within(await rowFor('Honda CR-V')).getByRole('button', { name: 'Watching' }));

    expect(api.vehicles.unwatch).toHaveBeenCalledWith('v-crv');
    expect(await within(await rowFor('Honda CR-V')).findByRole('button', { name: 'Notify me' })).toBeInTheDocument();
  });
});
