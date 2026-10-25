import { screen, within } from '@testing-library/react';
import axe from 'axe-core';
import { ApiError } from './api/client';
import { dana, fakeApi, priya, vehicle } from './test/fake-api';
import { renderApp } from './test/render';

/**
 * axe-core over the rendered DOM. Colour contrast cannot be computed in jsdom (no layout or CSS), so that rule is
 * off here; the token pairs were checked by hand against WCAG AA (see README).
 */
async function violations() {
  const results = await axe.run(document.body, { rules: { 'color-contrast': { enabled: false } } });
  return results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`);
}

function signedOut() {
  const api = fakeApi();
  api.auth.me.mockRejectedValue(new ApiError(401, 'UNAUTHENTICATED', 'Authentication required'));
  return api;
}

function signedIn(user = priya) {
  const api = fakeApi();
  api.auth.me.mockResolvedValue(user);
  api.vehicles.search.mockResolvedValue({
    data: [vehicle(), vehicle({ id: 'v-crv', make: 'Honda', model: 'CR-V', quantity: 0 })],
    count: 2,
  });
  api.vehicles.forecast.mockResolvedValue({
    windowDays: 30,
    atRiskDays: 7,
    data: [{ vehicleId: 'v-camry', avgDailySales: 1, daysOfStockLeft: 6, atRisk: true, suggestedRestock: 24 }],
  });
  return api;
}

describe('accessibility (axe)', () => {
  it('sign-in page has no violations', async () => {
    renderApp({ api: signedOut(), route: '/login' });
    await screen.findByRole('heading', { name: 'Sign in' });

    expect(await violations()).toEqual([]);
  });

  it('sign-in page with demo access has no violations', async () => {
    vi.stubEnv('VITE_DEMO_ADMIN_EMAIL', 'demo.admin@example.com');
    vi.stubEnv('VITE_DEMO_ADMIN_PASSWORD', 'not-a-real-secret');
    renderApp({ api: signedOut(), route: '/login' });
    await screen.findByRole('region', { name: 'Demo access' });

    expect(await violations()).toEqual([]);
    vi.unstubAllEnvs();
  });

  it('registration page with field errors has no violations', async () => {
    const { user } = renderApp({ api: signedOut(), route: '/register' });
    await user.click(await screen.findByRole('button', { name: 'Create account' }));

    expect(await violations()).toEqual([]);
  });

  it('dashboard has no violations for a regular user', async () => {
    renderApp({ api: signedIn(priya) });
    await screen.findByText('Toyota Camry');

    expect(await violations()).toEqual([]);
  });

  it('dashboard has no violations for an admin', async () => {
    renderApp({ api: signedIn(dana) });
    await screen.findByText('Toyota Camry');
    await screen.findByText('At risk', { selector: 'dt' });

    expect(await violations()).toEqual([]);
  });

  it('add-vehicle drawer has no violations', async () => {
    const { user } = renderApp({ api: signedIn(priya) });
    await user.click(await screen.findByRole('button', { name: 'Add vehicle' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Add vehicle' }));

    expect(await violations()).toEqual([]);
  });

  it('purchase popover and notifications panel have no violations', async () => {
    const { user } = renderApp({ api: signedIn(priya) });
    const row = (await screen.findByText('Toyota Camry')).closest('tr')!;
    await user.click(within(row).getByRole('button', { name: 'Purchase' }));
    expect(await violations()).toEqual([]);

    await user.click(screen.getByRole('button', { name: 'Notifications' }));
    expect(await violations()).toEqual([]);
  });

  it('purchases page has no violations', async () => {
    const api = signedIn(dana);
    api.purchases.list.mockResolvedValue({
      data: [
        {
          id: 'p-1',
          quantity: 1,
          unitPrice: 28400,
          total: 28400,
          createdAt: '2026-10-24T09:30:00Z',
          vehicle: { id: 'v-camry', make: 'Toyota', model: 'Camry', sku: 'TOY-CAMRY', category: 'Sedan' },
          colour: { name: 'Supersonic Red', hex: '#a3161a' },
          buyer: { id: priya.id, name: priya.name, email: priya.email },
        },
      ],
      count: 1,
      summary: { orders: 1, units: 1, revenue: 28400 },
      days: 30,
    });
    renderApp({ api, route: '/purchases' });
    await screen.findByRole('link', { name: 'Toyota Camry' });

    expect(await violations()).toEqual([]);
  });

  it('delete confirmation has no violations', async () => {
    const { user } = renderApp({ api: signedIn(dana) });
    const row = (await screen.findByText('Toyota Camry')).closest('tr')!;
    await user.click(within(row).getByRole('button', { name: 'More actions for Toyota Camry' }));
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));

    expect(await violations()).toEqual([]);
  });
});
