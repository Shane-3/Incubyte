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

  it('delete confirmation has no violations', async () => {
    const { user } = renderApp({ api: signedIn(dana) });
    const row = (await screen.findByText('Toyota Camry')).closest('tr')!;
    await user.click(within(row).getByRole('button', { name: 'More actions for Toyota Camry' }));
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));

    expect(await violations()).toEqual([]);
  });
});
