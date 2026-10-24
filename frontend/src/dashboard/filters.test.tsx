import { screen, waitFor, within } from '@testing-library/react';
import type { Vehicle } from '../api/types';
import { dana, fakeApi, priya, vehicle } from '../test/fake-api';
import { renderApp } from '../test/render';

function apiWith(count = 4, user = priya, data: Vehicle[] = [vehicle()]) {
  const api = fakeApi();
  api.auth.me.mockResolvedValue(user);
  api.vehicles.search.mockResolvedValue({ data, count });
  return api;
}

function lastQuery(api: ReturnType<typeof fakeApi>) {
  return api.vehicles.search.mock.lastCall?.[0];
}

describe('filters', () => {
  it('searches by make as you type', async () => {
    const api = apiWith();
    const { user } = renderApp({ api });

    await user.type(await screen.findByLabelText('Make'), 'Toyota');

    await waitFor(() => expect(lastQuery(api)).toMatchObject({ make: 'Toyota', offset: 0 }));
  });

  it('filters by model, category and price range', async () => {
    const api = apiWith();
    const { user } = renderApp({ api });

    await user.type(await screen.findByLabelText('Model'), 'RAV');
    await user.selectOptions(screen.getByLabelText('Category'), 'SUV');
    await user.type(screen.getByLabelText('Min price'), '10000');
    await user.type(screen.getByLabelText('Max price'), '30000');

    await waitFor(() =>
      expect(lastQuery(api)).toMatchObject({ model: 'RAV', category: 'SUV', minPrice: 10000, maxPrice: 30000 }),
    );
  });

  it('flags a minimum above the maximum instead of searching with it', async () => {
    const api = apiWith();
    const { user } = renderApp({ api });

    await user.type(await screen.findByLabelText('Min price'), '50000');
    await user.type(screen.getByLabelText('Max price'), '100');

    expect(await screen.findByText('Min price must not be above max price')).toBeInTheDocument();
    expect(lastQuery(api)).not.toMatchObject({ maxPrice: 100 });
  });

  it('restores filters from the URL', async () => {
    const api = apiWith();
    renderApp({ api, route: '/?make=Honda&category=SUV&maxPrice=40000' });

    expect(await screen.findByLabelText('Make')).toHaveValue('Honda');
    expect(screen.getByLabelText('Category')).toHaveValue('SUV');
    await waitFor(() => expect(lastQuery(api)).toMatchObject({ make: 'Honda', category: 'SUV', maxPrice: 40000 }));
  });

  it('shows active filters as removable chips', async () => {
    const api = apiWith();
    const { user } = renderApp({ api, route: '/?make=Honda&category=SUV' });

    await user.click(await screen.findByRole('button', { name: 'Remove filter Category: SUV' }));

    await waitFor(() => expect(lastQuery(api)?.category).toBeUndefined());
    expect(lastQuery(api)).toMatchObject({ make: 'Honda' });
  });

  it('clears every filter at once', async () => {
    const api = apiWith();
    const { user } = renderApp({ api, route: '/?make=Honda&category=SUV&minPrice=1000' });

    await user.click(await screen.findByRole('button', { name: 'Clear' }));

    await waitFor(() => expect(lastQuery(api)).toEqual(expect.not.objectContaining({ make: 'Honda' })));
    expect(screen.getByLabelText('Make')).toHaveValue('');
  });
});

describe('sorting', () => {
  it('sorts by a column, then reverses on a second click', async () => {
    const api = apiWith();
    const { user } = renderApp({ api });

    await user.click(await screen.findByRole('button', { name: 'Price' }));
    await waitFor(() => expect(lastQuery(api)).toMatchObject({ sort: 'price', order: 'asc' }));
    expect(screen.getByRole('columnheader', { name: 'Price' })).toHaveAttribute('aria-sort', 'ascending');

    await user.click(screen.getByRole('button', { name: 'Price' }));
    await waitFor(() => expect(lastQuery(api)).toMatchObject({ sort: 'price', order: 'desc' }));
  });

  it('offers a Sort by select for small screens, where column headers are hidden', async () => {
    const api = apiWith();
    const { user } = renderApp({ api });

    await user.selectOptions(await screen.findByLabelText('Sort by'), 'Price, high to low');

    await waitFor(() => expect(lastQuery(api)).toMatchObject({ sort: 'price', order: 'desc' }));
  });
});

describe('pagination', () => {
  it('shows the range and pages through results', async () => {
    const api = apiWith(60);
    const { user } = renderApp({ api });

    expect(await screen.findByText('1–25 of 60')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next page' }));

    await waitFor(() => expect(lastQuery(api)).toMatchObject({ limit: 25, offset: 25 }));
    expect(await screen.findByText('26–50 of 60')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeEnabled();
  });

  it('changes rows per page and returns to the first page', async () => {
    const api = apiWith(60);
    const { user } = renderApp({ api, route: '/?page=2' });

    await user.selectOptions(await screen.findByLabelText('Rows per page'), '50');

    await waitFor(() => expect(lastQuery(api)).toMatchObject({ limit: 50, offset: 0 }));
  });

  it('disables Next on the last page', async () => {
    const api = apiWith(4);
    renderApp({ api });

    expect(await screen.findByRole('button', { name: 'Next page' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
  });
});

describe('sidebar views', () => {
  it('shows low-stock vehicles', async () => {
    const api = apiWith();
    const { user } = renderApp({ api });

    const nav = await screen.findByRole('navigation', { name: 'Inventory views' });
    await user.click(within(nav).getByRole('link', { name: 'Low stock' }));

    await waitFor(() => expect(lastQuery(api)).toMatchObject({ stock: 'low' }));
    expect(within(nav).getByRole('link', { name: 'Low stock' })).toHaveAttribute('aria-current', 'page');
  });

  it('lists only at-risk vehicles in the admin At risk view', async () => {
    const api = apiWith(2, dana, [
      vehicle({ id: 'v-rav4', model: 'RAV4', quantity: 2 }),
      vehicle({ id: 'v-camry', model: 'Camry', quantity: 9 }),
    ]);
    api.vehicles.forecast.mockResolvedValue({
      windowDays: 30,
      atRiskDays: 7,
      data: [
        { vehicleId: 'v-rav4', avgDailySales: 0.6, daysOfStockLeft: 3.3, atRisk: true, suggestedRestock: 16 },
        { vehicleId: 'v-camry', avgDailySales: 0.1, daysOfStockLeft: 90, atRisk: false, suggestedRestock: 0 },
      ],
    });
    renderApp({ api, route: '/?view=at-risk' });

    const table = await screen.findByRole('table', { name: 'Vehicles' });
    expect(await within(table).findByText('Toyota RAV4')).toBeInTheDocument();
    expect(within(table).queryByText('Toyota Camry')).toBeNull();
  });

  it('does not offer the At risk view to regular users', async () => {
    renderApp({ api: apiWith() });

    const nav = await screen.findByRole('navigation', { name: 'Inventory views' });
    expect(within(nav).queryByRole('link', { name: 'At risk' })).toBeNull();
  });
});
