import { screen, within } from '@testing-library/react';
import { ApiError } from '../api/client';
import type { Purchase, PurchaseFeed } from '../api/types';
import { dana, fakeApi, priya } from '../test/fake-api';
import { renderApp } from '../test/render';

const HOUR = 3_600_000;

function sale(overrides: Partial<Purchase> = {}): Purchase {
  return {
    id: 'p-1',
    quantity: 2,
    unitPrice: 27999.5,
    total: 55999,
    createdAt: new Date(Date.now() - 3 * HOUR).toISOString(),
    vehicle: { id: 'v-camry', make: 'Toyota', model: 'Camry', sku: 'TOY-CAMRY', category: 'Sedan' },
    colour: { name: 'Supersonic Red', hex: '#a3161a' },
    buyer: { id: priya.id, name: priya.name, email: priya.email },
    ...overrides,
  };
}

function feed(data: Purchase[] = [sale()], overrides: Partial<PurchaseFeed> = {}): PurchaseFeed {
  return {
    data,
    count: data.length,
    summary: { orders: 2, units: 3, revenue: 84400 },
    days: 30,
    ...overrides,
  };
}

function apiFor(user = dana, result = feed()) {
  const api = fakeApi();
  api.auth.me.mockResolvedValue(user);
  api.purchases.list.mockResolvedValue(result);
  return api;
}

async function rowFor(name: string) {
  const table = await screen.findByRole('table', { name: 'Purchases' });
  const row = (await within(table).findByText(name)).closest('tr');
  if (!row) throw new Error(`no row for ${name}`);
  return row;
}

describe('purchases page', () => {
  it('is linked from the navigation for admins', async () => {
    const { user } = renderApp({ api: apiFor() });

    await user.click(await screen.findByRole('link', { name: 'Purchases' }));

    expect(await screen.findByRole('heading', { name: 'Purchases' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Purchases' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'All vehicles' })).not.toHaveAttribute('aria-current');
    expect(screen.getByText('Purchases', { selector: 'header span' })).toBeInTheDocument();
  });

  it('is hidden from regular users, and sends them back to the inventory without asking for sales data', async () => {
    const api = apiFor(priya);
    renderApp({ api, route: '/purchases' });

    expect(await screen.findByRole('heading', { name: 'Inventory' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Purchases' })).toBeNull();
    expect(api.purchases.list).not.toHaveBeenCalled();
  });

  it('lists each sale with when, what, which colour, who bought it and the money', async () => {
    renderApp({ api: apiFor(), route: '/purchases' });

    const row = await rowFor('Toyota Camry');
    expect(within(row).getByText('3 hr. ago')).toBeInTheDocument();
    expect(within(row).getByText('TOY-CAMRY')).toBeInTheDocument();
    expect(within(row).getByText('Supersonic Red')).toBeInTheDocument();
    expect(within(row).getByText('Priya Nair')).toBeInTheDocument();
    expect(within(row).getByText('priya.nair@example.com')).toBeInTheDocument();
    expect(within(row).getByText('2')).toBeInTheDocument();
    expect(within(row).getByText('$27,999.50')).toBeInTheDocument();
    expect(within(row).getByText('$55,999')).toBeInTheDocument();
  });

  it('gives the exact time of each sale', async () => {
    const createdAt = '2026-10-24T09:30:00.000Z';
    renderApp({ api: apiFor(dana, feed([sale({ createdAt })])), route: '/purchases' });

    const row = await rowFor('Toyota Camry');
    const time = row.querySelector('time');
    expect(time).toHaveAttribute('dateTime', createdAt);
  });

  it('links each vehicle to its row in the inventory', async () => {
    renderApp({ api: apiFor(), route: '/purchases' });

    const row = await rowFor('Toyota Camry');
    expect(within(row).getByRole('link', { name: 'Toyota Camry' })).toHaveAttribute(
      'href',
      '/?make=Toyota&model=Camry',
    );
  });

  it('says when a sale has no recorded colour', async () => {
    renderApp({ api: apiFor(dana, feed([sale({ colour: null })])), route: '/purchases' });

    const row = await rowFor('Toyota Camry');
    expect(within(row).getByText('Not recorded')).toBeInTheDocument();
  });

  it('summarises the period: orders, units, revenue and the average order', async () => {
    renderApp({ api: apiFor(), route: '/purchases' });

    const summary = await screen.findByRole('region', { name: 'Sales summary' });
    const value = (label: string) => within(summary).getByText(label).closest('div')!.querySelector('dd')!.textContent;
    await within(summary).findByText('$84,400');
    expect(value('Orders')).toBe('2');
    expect(value('Units sold')).toBe('3');
    expect(value('Revenue')).toBe('$84,400');
    expect(value('Average order')).toBe('$42,200');
  });

  it('loads the last 30 days by default and switches period', async () => {
    const api = apiFor();
    const { user } = renderApp({ api, route: '/purchases' });

    await rowFor('Toyota Camry');
    expect(api.purchases.list).toHaveBeenLastCalledWith({ days: 30, limit: 25, offset: 0 });
    expect(screen.getByRole('radio', { name: '30 days' })).toBeChecked();

    await user.click(screen.getByRole('radio', { name: '7 days' }));

    expect(api.purchases.list).toHaveBeenLastCalledWith({ days: 7, limit: 25, offset: 0 });
    expect(screen.getByRole('radio', { name: '7 days' })).toBeChecked();
  });

  it('opens a period from the URL', async () => {
    const api = apiFor();
    renderApp({ api, route: '/purchases?days=90' });

    await rowFor('Toyota Camry');
    expect(api.purchases.list).toHaveBeenLastCalledWith({ days: 90, limit: 25, offset: 0 });
  });

  it('pages through older sales, and starts again from the first page on a new period', async () => {
    const api = apiFor(dana, feed([sale()], { count: 60 }));
    const { user } = renderApp({ api, route: '/purchases' });

    await rowFor('Toyota Camry');
    await user.click(screen.getByRole('button', { name: 'Next page' }));
    expect(api.purchases.list).toHaveBeenLastCalledWith({ days: 30, limit: 25, offset: 25 });

    await user.click(screen.getByRole('radio', { name: '90 days' }));
    expect(api.purchases.list).toHaveBeenLastCalledWith({ days: 90, limit: 25, offset: 0 });
  });

  it('says so when nothing sold in the period', async () => {
    renderApp({
      api: apiFor(dana, feed([], { summary: { orders: 0, units: 0, revenue: 0 } })),
      route: '/purchases',
    });

    expect(await screen.findByText('No purchases in the last 30 days')).toBeInTheDocument();
  });

  it('shows an error with a retry when the feed fails to load', async () => {
    const api = apiFor();
    api.purchases.list.mockRejectedValueOnce(new ApiError(500, 'INTERNAL', 'Something went wrong'));
    const { user } = renderApp({ api, route: '/purchases' });

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent("Couldn't load purchases.");

    await user.click(within(alert).getByRole('button', { name: 'Retry' }));

    expect(await rowFor('Toyota Camry')).toBeInTheDocument();
  });
});
