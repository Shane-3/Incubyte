import { screen, within } from '@testing-library/react';
import { ApiError } from '../api/client';
import type { Vehicle } from '../api/types';
import { dana, fakeApi, priya, vehicle } from '../test/fake-api';
import { renderApp } from '../test/render';

const camry = vehicle({ id: 'v-camry', make: 'Toyota', model: 'Camry', category: 'Sedan', price: 28400, quantity: 6 });
const rav4 = vehicle({ id: 'v-rav4', make: 'Toyota', model: 'RAV4', category: 'SUV', price: 31900, quantity: 2 });
const crv = vehicle({ id: 'v-crv', make: 'Honda', model: 'CR-V', category: 'SUV', price: 32450, quantity: 0 });
const f150 = vehicle({ id: 'v-f150', make: 'Ford', model: 'F-150', category: 'Truck', price: 38999.99, quantity: 4 });

function apiFor(user = priya, vehicles: Vehicle[] = [camry, rav4, crv, f150]) {
  const api = fakeApi();
  api.auth.me.mockResolvedValue(user);
  api.vehicles.search.mockResolvedValue({ data: vehicles, count: vehicles.length });
  api.vehicles.stats.mockResolvedValue({
    models: 32,
    units: 151,
    inventoryValue: 5123456.5,
    outOfStock: 3,
    lowStock: 7,
  });
  api.vehicles.forecast.mockResolvedValue({
    windowDays: 30,
    atRiskDays: 7,
    data: [
      { vehicleId: 'v-camry', avgDailySales: 0.47, daysOfStockLeft: 12.9, atRisk: false, suggestedRestock: 8 },
      { vehicleId: 'v-rav4', avgDailySales: 0.6, daysOfStockLeft: 3.3, atRisk: true, suggestedRestock: 16 },
      { vehicleId: 'v-crv', avgDailySales: 0.3, daysOfStockLeft: 0, atRisk: true, suggestedRestock: 9 },
      { vehicleId: 'v-f150', avgDailySales: 0, daysOfStockLeft: null, atRisk: false, suggestedRestock: 0 },
    ],
  });
  return api;
}

async function rowFor(name: string) {
  const table = await screen.findByRole('table', { name: 'Vehicles' });
  const row = within(table)
    .getAllByRole('row')
    .find((r) => within(r).queryByText(name));
  if (!row) throw new Error(`no row for ${name}`);
  return row;
}

describe('inventory table', () => {
  it('lists each vehicle with category, formatted price and stock status', async () => {
    renderApp({ api: apiFor() });

    const row = await rowFor('Toyota Camry');
    expect(within(row).getByText('Sedan')).toBeInTheDocument();
    expect(within(row).getByText('$28,400')).toBeInTheDocument();
    expect(within(row).getByText('6')).toBeInTheDocument();
    expect(within(row).getByText('In stock')).toBeInTheDocument();
    expect(within(await rowFor('Ford F-150')).getByText('$38,999.99')).toBeInTheDocument();
    expect(within(await rowFor('Toyota RAV4')).getByText('Low')).toBeInTheDocument();
    expect(within(await rowFor('Honda CR-V')).getByText('Out of stock')).toBeInTheDocument();
  });

  it('shows the total count in the page header', async () => {
    renderApp({ api: apiFor() });

    expect(await screen.findByText('4 vehicles')).toBeInTheDocument();
  });

  it('disables Purchase on a sold-out vehicle and enables it otherwise', async () => {
    renderApp({ api: apiFor() });

    expect(within(await rowFor('Honda CR-V')).getByRole('button', { name: 'Purchase' })).toBeDisabled();
    expect(within(await rowFor('Toyota Camry')).getByRole('button', { name: 'Purchase' })).toBeEnabled();
  });

  it('renders markup in vehicle names as plain text', async () => {
    const hostile = vehicle({ id: 'v-x', make: '<img src=x onerror=alert(1)>', model: '<script>alert(2)</script>' });
    renderApp({ api: apiFor(priya, [hostile]) });

    expect(await screen.findByText('<img src=x onerror=alert(1)> <script>alert(2)</script>')).toBeInTheDocument();
    expect(document.querySelector('img')).toBeNull();
    expect(document.querySelector('table script')).toBeNull();
  });

  it('shows skeleton rows while loading', async () => {
    const api = apiFor();
    api.vehicles.search.mockReturnValue(new Promise(() => undefined));
    renderApp({ api });

    expect(await screen.findByRole('table', { name: 'Vehicles' })).toHaveAttribute('aria-busy', 'true');
  });

  it('offers to clear filters when nothing matches', async () => {
    renderApp({ api: apiFor(priya, []), route: '/?make=Lada' });

    expect(await screen.findByText('No vehicles match your filters')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeInTheDocument();
  });

  it('shows an error with a retry', async () => {
    const api = apiFor();
    api.vehicles.search.mockRejectedValueOnce(new ApiError(0, 'NETWORK_ERROR', "Couldn't reach the server."));
    const { user } = renderApp({ api });

    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't load vehicles");
    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await rowFor('Toyota Camry')).toBeInTheDocument();
  });
});

describe('role-based controls', () => {
  it('gives regular users Edit but not Restock or Delete', async () => {
    const { user } = renderApp({ api: apiFor(priya) });

    await user.click(within(await rowFor('Toyota Camry')).getByRole('button', { name: 'More actions for Toyota Camry' }));

    const menu = screen.getByRole('menu');
    expect(within(menu).getByRole('menuitem', { name: 'Edit' })).toBeInTheDocument();
    expect(within(menu).queryByRole('menuitem', { name: 'Restock' })).toBeNull();
    expect(within(menu).queryByRole('menuitem', { name: 'Delete' })).toBeNull();
  });

  it('gives admins Edit, Restock and Delete', async () => {
    const { user } = renderApp({ api: apiFor(dana) });

    await user.click(within(await rowFor('Toyota Camry')).getByRole('button', { name: 'More actions for Toyota Camry' }));

    const menu = screen.getByRole('menu');
    expect(within(menu).getAllByRole('menuitem').map((i) => i.textContent)).toEqual(['Edit', 'Restock', 'Delete']);
  });

  it('lets anyone add a vehicle', async () => {
    renderApp({ api: apiFor(priya) });

    expect(await screen.findByRole('button', { name: 'Add vehicle' })).toBeInTheDocument();
  });
});

describe('KPI strip', () => {
  it('shows inventory totals from the stats endpoint', async () => {
    renderApp({ api: apiFor(priya) });

    const kpis = await screen.findByRole('region', { name: 'Inventory summary' });
    expect(await within(kpis).findByText('32')).toBeInTheDocument();
    expect(within(kpis).getByText('151')).toBeInTheDocument();
    expect(within(kpis).getByText('$5,123,457')).toBeInTheDocument();
    expect(within(kpis).getByText('Out of stock').parentElement).toHaveTextContent('3');
  });

  it('adds an At risk tile for admins only', async () => {
    renderApp({ api: apiFor(dana) });

    const kpis = await screen.findByRole('region', { name: 'Inventory summary' });
    expect((await within(kpis).findByText('At risk')).parentElement).toHaveTextContent('2');
  });

  it('never asks for forecast data as a regular user', async () => {
    const api = apiFor(priya);
    renderApp({ api });

    await rowFor('Toyota Camry');
    expect(within(screen.getByRole('region', { name: 'Inventory summary' })).queryByText('At risk')).toBeNull();
    expect(api.vehicles.forecast).not.toHaveBeenCalled();
  });
});

describe('days left (admins)', () => {
  it('shows days of stock left with an at-risk marker, and a dash without recent sales', async () => {
    renderApp({ api: apiFor(dana) });

    expect(await screen.findByRole('columnheader', { name: /Days left/ })).toBeInTheDocument();
    expect(await within(await rowFor('Toyota RAV4')).findByText('3.3')).toBeInTheDocument();
    expect(within(await rowFor('Toyota RAV4')).getByText('At risk')).toBeInTheDocument();
    expect(within(await rowFor('Toyota Camry')).getByText('12.9')).toBeInTheDocument();
    expect(within(await rowFor('Toyota Camry')).queryByText('At risk')).toBeNull();
    expect(within(await rowFor('Ford F-150')).getByText('—')).toBeInTheDocument();
  });

  it('is not shown to regular users', async () => {
    renderApp({ api: apiFor(priya) });

    await rowFor('Toyota Camry');
    expect(screen.queryByRole('columnheader', { name: /Days left/ })).toBeNull();
  });
});
