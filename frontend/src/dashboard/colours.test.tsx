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

describe('restocking colours (admins)', () => {
  async function openRestock(user: ReturnType<typeof renderApp>['user'], name: string) {
    const row = await rowFor(name);
    await user.click(within(row).getByRole('button', { name: `More actions for ${name}` }));
    await user.click(screen.getByRole('menuitem', { name: 'Restock' }));
    return screen.getByRole('dialog', { name: `Restock ${name}` });
  }

  it('restocks several colours at once, each with its own units', async () => {
    const api = apiFor(dana);
    api.vehicles.restock.mockResolvedValue(camry);
    const { user } = renderApp({ api });

    const drawer = await openRestock(user, 'Toyota Camry');
    const black = within(drawer).getByLabelText('Midnight Black Metallic units to add');
    expect(black).toHaveAccessibleDescription('0 in stock');
    await user.type(within(drawer).getByLabelText('Supersonic Red units to add'), '2');
    await user.type(black, '3');

    expect(within(drawer).getByText('5 units across 2 colours')).toBeInTheDocument();
    await user.click(within(drawer).getByRole('button', { name: 'Restock' }));

    expect(api.vehicles.restock).toHaveBeenCalledWith('v-camry', [
      { colourId: 'c-red', quantity: 2 },
      { colourId: 'c-black', quantity: 3 },
    ]);
  });

  it('needs at least one unit somewhere, and whole units everywhere', async () => {
    const api = apiFor(dana);
    const { user } = renderApp({ api });

    const drawer = await openRestock(user, 'Toyota Camry');
    await user.click(within(drawer).getByRole('button', { name: 'Restock' }));
    expect(within(drawer).getByText('Enter at least 1 unit')).toBeInTheDocument();

    await user.type(within(drawer).getByLabelText('Wind Chill Pearl units to add'), '1.5');
    await user.click(within(drawer).getByRole('button', { name: 'Restock' }));
    expect(within(drawer).getByLabelText('Wind Chill Pearl units to add')).toHaveAccessibleDescription(
      'Use whole units, 0 or more',
    );
    expect(api.vehicles.restock).not.toHaveBeenCalled();
  });

  it('keeps a single field for a single-colour model', async () => {
    const api = apiFor(dana, [vehicle({ id: 'v-civic', make: 'Honda', model: 'Civic' })]);
    api.vehicles.restock.mockResolvedValue(vehicle({ id: 'v-civic', make: 'Honda', model: 'Civic', quantity: 9 }));
    const { user } = renderApp({ api });

    const drawer = await openRestock(user, 'Honda Civic');
    await user.type(within(drawer).getByLabelText('Units to add'), '3');
    await user.click(within(drawer).getByRole('button', { name: 'Restock' }));

    expect(api.vehicles.restock).toHaveBeenCalledWith('v-civic', [{ colourId: 'v-civic-standard', quantity: 3 }]);
  });
});

describe('adding colours', () => {
  async function openAdd(user: ReturnType<typeof renderApp>['user']) {
    await user.click(await screen.findByRole('button', { name: 'Add vehicle' }));
    return screen.getByRole('dialog', { name: 'Add vehicle' });
  }

  async function fillModel(user: ReturnType<typeof renderApp>['user'], drawer: HTMLElement) {
    await user.type(within(drawer).getByLabelText('Make'), 'Mazda');
    await user.type(within(drawer).getByLabelText('Model'), 'MX-5 Miata');
    await user.selectOptions(within(drawer).getByLabelText('Category'), 'Convertible');
    await user.type(within(drawer).getByLabelText('Price'), '28985');
  }

  it('adds a new model in several colours, each with its own units, totalled for you', async () => {
    const api = apiFor(priya, []);
    api.vehicles.create.mockResolvedValue({ vehicle: camry, merged: false });
    const { user } = renderApp({ api });

    const drawer = await openAdd(user);
    await fillModel(user, drawer);
    await user.click(within(drawer).getByRole('button', { name: 'Red' }));
    expect(within(drawer).getByLabelText('Colour 1 name')).toHaveValue('Red');
    await user.clear(within(drawer).getByLabelText('Colour 1 name'));
    await user.type(within(drawer).getByLabelText('Colour 1 name'), 'Soul Red Crystal Metallic');
    await user.type(within(drawer).getByLabelText('Colour 1 units'), '2');
    await user.click(within(drawer).getByRole('button', { name: 'Add colour' }));
    await user.type(within(drawer).getByLabelText('Colour 2 name'), 'Snowflake White Pearl');
    await user.type(within(drawer).getByLabelText('Colour 2 units'), '3');

    expect(within(drawer).queryByLabelText('Quantity')).toBeNull();
    expect(within(drawer).getByText('5 units in 2 colours')).toBeInTheDocument();
    await user.click(within(drawer).getByRole('button', { name: 'Add vehicle' }));

    expect(api.vehicles.create).toHaveBeenCalledWith({
      make: 'Mazda',
      model: 'MX-5 Miata',
      category: 'Convertible',
      price: 28985,
      quantity: 5,
      colours: [
        { name: 'Soul Red Crystal Metallic', hex: '#a3161a', quantity: 2 },
        { name: 'Snowflake White Pearl', hex: '#8a8f98', quantity: 3 },
      ],
    });
  });

  it('removes a colour row and returns to a single total when none are left', async () => {
    const { user } = renderApp({ api: apiFor(priya, []) });

    const drawer = await openAdd(user);
    await user.click(within(drawer).getByRole('button', { name: 'Black' }));
    await user.click(within(drawer).getByRole('button', { name: 'White' }));
    await user.click(within(drawer).getByRole('button', { name: 'Remove colour 1' }));

    expect(within(drawer).getByLabelText('Colour 1 name')).toHaveValue('White');
    await user.click(within(drawer).getByRole('button', { name: 'Remove colour 1' }));
    expect(within(drawer).getByLabelText('Quantity')).toBeInTheDocument();
  });

  it('checks every colour row before sending', async () => {
    const api = apiFor(priya, []);
    const { user } = renderApp({ api });

    const drawer = await openAdd(user);
    await fillModel(user, drawer);
    await user.click(within(drawer).getByRole('button', { name: 'Add colour' }));
    await user.type(within(drawer).getByLabelText('Colour 1 units'), '1.5');
    await user.click(within(drawer).getByRole('button', { name: 'Red' }));
    await user.click(within(drawer).getByRole('button', { name: 'Add colour' }));
    await user.type(within(drawer).getByLabelText('Colour 3 name'), 'red');
    await user.click(within(drawer).getByRole('button', { name: 'Add vehicle' }));

    expect(within(drawer).getByLabelText('Colour 1 name')).toHaveAccessibleDescription('Enter a colour name');
    expect(within(drawer).getByLabelText('Colour 1 units')).toHaveAccessibleDescription('Use whole units, 0 or more');
    expect(within(drawer).getByLabelText('Colour 3 name')).toHaveAccessibleDescription('Already listed above');
    expect(api.vehicles.create).not.toHaveBeenCalled();
  });

  it('keeps the paint, name and units of a row on one line', async () => {
    const { user } = renderApp({ api: apiFor(priya, []) });

    const drawer = await openAdd(user);
    await user.click(within(drawer).getByRole('button', { name: 'Blue' }));

    const row = within(drawer).getByLabelText('Colour 1 name').closest('[data-colour-row]')!;
    expect(within(row as HTMLElement).getByLabelText('Colour 1 paint')).toHaveValue('#1f3a5f');
    expect(within(row as HTMLElement).getByLabelText('Colour 1 units')).toBeInTheDocument();
  });

  it('recognises an existing model, locks its price and category, and adds the colours to it', async () => {
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

    await user.click(within(drawer).getByRole('button', { name: 'Blue' }));
    await user.type(within(drawer).getByLabelText('Colour 1 units'), '2');
    await user.click(within(drawer).getByRole('button', { name: 'Add colours' }));

    expect(api.vehicles.create).toHaveBeenCalledWith(
      expect.objectContaining({
        make: 'toyota',
        model: 'camry',
        price: 28400,
        category: 'Sedan',
        quantity: 2,
        colours: [{ name: 'Blue', hex: '#1f3a5f', quantity: 2 }],
      }),
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
