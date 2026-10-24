import { screen, waitFor, within } from '@testing-library/react';
import type { User, Vehicle } from '../api/types';
import { dana, fakeApi, priya, vehicle } from '../test/fake-api';
import { renderApp } from '../test/render';

const camry = vehicle({
  id: 'v-camry',
  colours: [
    { id: 'c-red', name: 'Supersonic Red', hex: '#a3161a', quantity: 1 },
    { id: 'c-white', name: 'Wind Chill Pearl', hex: '#edede8', quantity: 4 },
    { id: 'c-black', name: 'Midnight Black Metallic', hex: '#1c1d21', quantity: 0 },
  ],
});

function apiFor(user: User = priya, vehicles: Vehicle[] = [camry]) {
  const api = fakeApi();
  api.auth.me.mockResolvedValue(user);
  api.vehicles.search.mockResolvedValue({ data: vehicles, count: vehicles.length });
  api.vehicles.forecast.mockResolvedValue({ windowDays: 30, atRiskDays: 7, data: [] });
  return api;
}

async function rowFor(name: string) {
  const table = await screen.findByRole('table', { name: 'Vehicles' });
  return (await within(table).findByText(name, { selector: 'button, span' })).closest('tr')!;
}

describe('colours in the table', () => {
  it('shows the SKU and a swatch per colour with its stock', async () => {
    renderApp({ api: apiFor() });

    const row = await rowFor('Toyota Camry');
    expect(within(row).getByText('TOY-CAMRY')).toBeInTheDocument();
    const swatches = within(row).getByRole('list', { name: 'Colours of Toyota Camry' });
    expect(within(swatches).getAllByRole('listitem')).toHaveLength(3);
    expect(within(swatches).getByText('Supersonic Red, 1 in stock')).toBeInTheDocument();
    expect(within(swatches).getByText('Midnight Black Metallic, sold out')).toBeInTheDocument();
  });
});

describe('vehicle detail', () => {
  it('opens from the vehicle name and shows the car in each colour', async () => {
    const { user } = renderApp({ api: apiFor() });

    await user.click(within(await rowFor('Toyota Camry')).getByRole('button', { name: 'Toyota Camry' }));
    const drawer = screen.getByRole('dialog', { name: 'Toyota Camry' });

    expect(within(drawer).getByText('TOY-CAMRY')).toBeInTheDocument();
    expect(within(drawer).getByText('$28,400')).toBeInTheDocument();
    expect(within(drawer).getByRole('img', { name: 'Toyota Camry in Wind Chill Pearl' })).toBeInTheDocument();

    const colours = within(drawer).getByRole('radiogroup', { name: 'Colour' });
    await user.click(within(colours).getByRole('radio', { name: 'Supersonic Red, 1 in stock' }));

    expect(within(drawer).getByRole('img', { name: 'Toyota Camry in Supersonic Red' })).toBeInTheDocument();
    expect(within(colours).getByRole('radio', { name: 'Midnight Black Metallic, sold out' })).toBeInTheDocument();
  });
});

describe('purchasing a colour', () => {
  it('defaults to the best-stocked colour, disables sold-out ones and buys the chosen colour', async () => {
    const api = apiFor();
    api.vehicles.purchase.mockResolvedValue(camry);
    const { user } = renderApp({ api });

    await user.click(within(await rowFor('Toyota Camry')).getByRole('button', { name: 'Purchase' }));
    const dialog = screen.getByRole('dialog', { name: 'Purchase Toyota Camry' });
    const colours = within(dialog).getByRole('radiogroup', { name: 'Colour' });

    expect(within(colours).getByRole('radio', { name: /Wind Chill Pearl/ })).toBeChecked();
    expect(within(colours).getByRole('radio', { name: /Midnight Black Metallic/ })).toBeDisabled();

    await user.click(within(colours).getByRole('radio', { name: /Supersonic Red/ }));
    expect(within(dialog).getByRole('button', { name: 'Increase quantity' })).toBeDisabled();
    await user.click(within(dialog).getByRole('button', { name: 'Confirm purchase' }));

    expect(api.vehicles.purchase).toHaveBeenCalledWith('v-camry', 1, 'c-red');
    expect(await screen.findByText('Purchased 1 × Toyota Camry in Supersonic Red')).toBeInTheDocument();
  });
});

describe('restocking a colour (admins)', () => {
  it('asks which colour when the model has several, starting with a sold-out one', async () => {
    const api = apiFor(dana);
    api.vehicles.restock.mockResolvedValue(camry);
    const { user } = renderApp({ api });

    const row = await rowFor('Toyota Camry');
    await user.click(within(row).getByRole('button', { name: 'More actions for Toyota Camry' }));
    await user.click(screen.getByRole('menuitem', { name: 'Restock' }));
    const drawer = screen.getByRole('dialog', { name: 'Restock Toyota Camry' });
    const colours = within(drawer).getByRole('radiogroup', { name: 'Colour' });

    expect(within(colours).getByRole('radio', { name: /Midnight Black Metallic/ })).toBeChecked();
    await user.click(within(colours).getByRole('radio', { name: /Supersonic Red/ }));
    await user.type(within(drawer).getByLabelText('Units to add'), '3');
    await user.click(within(drawer).getByRole('button', { name: 'Restock' }));

    expect(api.vehicles.restock).toHaveBeenCalledWith('v-camry', 3, 'c-red');
  });

  it('does not ask for a colour when there is only one', async () => {
    const { user } = renderApp({ api: apiFor(dana, [vehicle({ id: 'v-civic', make: 'Honda', model: 'Civic' })]) });

    const row = await rowFor('Honda Civic');
    await user.click(within(row).getByRole('button', { name: 'More actions for Honda Civic' }));
    await user.click(screen.getByRole('menuitem', { name: 'Restock' }));

    expect(within(screen.getByRole('dialog')).queryByRole('radiogroup', { name: 'Colour' })).toBeNull();
  });
});

describe('adding a colour', () => {
  async function openAdd(user: ReturnType<typeof renderApp>['user']) {
    await user.click(await screen.findByRole('button', { name: 'Add vehicle' }));
    return screen.getByRole('dialog', { name: 'Add vehicle' });
  }

  it('fills the colour from a paint preset and sends it with the vehicle', async () => {
    const api = apiFor(priya, []);
    api.vehicles.create.mockResolvedValue({ vehicle: camry, merged: false });
    const { user } = renderApp({ api });

    const drawer = await openAdd(user);
    await user.type(within(drawer).getByLabelText('Make'), 'Mazda');
    await user.type(within(drawer).getByLabelText('Model'), 'MX-5 Miata');
    await user.selectOptions(within(drawer).getByLabelText('Category'), 'Convertible');
    await user.type(within(drawer).getByLabelText('Price'), '28985');
    await user.type(within(drawer).getByLabelText('Quantity'), '2');
    await user.click(within(drawer).getByRole('button', { name: 'Red' }));

    expect(within(drawer).getByLabelText('Colour name')).toHaveValue('Red');
    await user.clear(within(drawer).getByLabelText('Colour name'));
    await user.type(within(drawer).getByLabelText('Colour name'), 'Soul Red Crystal Metallic');
    await user.click(within(drawer).getByRole('button', { name: 'Add vehicle' }));

    expect(api.vehicles.create).toHaveBeenCalledWith({
      make: 'Mazda',
      model: 'MX-5 Miata',
      category: 'Convertible',
      price: 28985,
      quantity: 2,
      colour: { name: 'Soul Red Crystal Metallic', hex: '#a3161a' },
    });
  });

  it('recognises an existing model, locks its price and category, and adds the colour to it', async () => {
    const api = apiFor(priya, [camry]);
    api.vehicles.create.mockResolvedValue({ vehicle: camry, merged: true });
    const { user } = renderApp({ api });

    const drawer = await openAdd(user);
    await user.type(within(drawer).getByLabelText('Make'), 'toyota');
    await user.type(within(drawer).getByLabelText('Model'), 'camry');

    expect(await within(drawer).findByText('Toyota Camry is already listed as TOY-CAMRY.')).toBeInTheDocument();
    await waitFor(() => expect(within(drawer).getByLabelText('Price')).toBeDisabled());
    expect(within(drawer).getByLabelText('Price')).toHaveValue(28400);
    expect(within(drawer).getByLabelText('Category')).toHaveValue('Sedan');

    await user.type(within(drawer).getByLabelText('Quantity'), '2');
    await user.click(within(drawer).getByRole('button', { name: 'Blue' }));
    await user.click(within(drawer).getByRole('button', { name: 'Add colour' }));

    expect(api.vehicles.create).toHaveBeenCalledWith(
      expect.objectContaining({ make: 'toyota', model: 'camry', price: 28400, category: 'Sedan', quantity: 2 }),
    );
    expect(await screen.findByText('Added 2 × Blue to Toyota Camry')).toBeInTheDocument();
  });
});

describe('editing a multi-colour model', () => {
  it('leaves stock to the colours instead of offering a single total', async () => {
    const { user } = renderApp({ api: apiFor(priya) });

    const row = await rowFor('Toyota Camry');
    await user.click(within(row).getByRole('button', { name: 'More actions for Toyota Camry' }));
    await user.click(screen.getByRole('menuitem', { name: 'Edit' }));
    const drawer = screen.getByRole('dialog', { name: 'Edit Toyota Camry' });

    expect(within(drawer).queryByLabelText('Quantity')).toBeNull();
    expect(within(drawer).getByText(/Stock is kept per colour/)).toBeInTheDocument();
  });
});

describe('colour filter', () => {
  it('finds vehicles by colour name', async () => {
    const api = apiFor();
    const { user } = renderApp({ api });

    await user.type(await screen.findByLabelText('Colour', { selector: 'input' }), 'red');

    await waitFor(() => expect(api.vehicles.search.mock.lastCall?.[0]).toMatchObject({ colour: 'red' }));
  });
});
