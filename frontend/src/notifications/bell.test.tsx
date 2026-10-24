import { act, screen, waitFor, within } from '@testing-library/react';
import type { AppNotification, Inbox } from '../api/types';
import { dana, fakeApi, priya } from '../test/fake-api';
import { renderApp } from '../test/render';

function notice(overrides: Partial<AppNotification> = {}): AppNotification {
  return {
    id: 'n1',
    type: 'LOW_STOCK',
    vehicle: { id: 'v-camry', make: 'Toyota', model: 'Camry' },
    quantity: 2,
    readAt: null,
    resolvedAt: null,
    createdAt: new Date(Date.now() - 5 * 60_000).toISOString(),
    ...overrides,
  };
}

function apiWithInbox(inbox: Inbox, user = dana) {
  const api = fakeApi();
  api.auth.me.mockResolvedValue(user);
  api.vehicles.forecast.mockResolvedValue({ windowDays: 30, atRiskDays: 7, data: [] });
  api.notifications.list.mockResolvedValue(inbox);
  return api;
}

const inbox: Inbox = {
  unreadCount: 2,
  data: [
    notice({ id: 'n-low', type: 'LOW_STOCK', quantity: 2 }),
    notice({ id: 'n-out', type: 'OUT_OF_STOCK', quantity: 0, vehicle: { id: 'v-crv', make: 'Honda', model: 'CR-V' } }),
    notice({
      id: 'n-old',
      type: 'LOW_STOCK',
      quantity: 3,
      readAt: '2026-10-20T09:00:00Z',
      resolvedAt: '2026-10-21T09:00:00Z',
      vehicle: { id: 'v-f150', make: 'Ford', model: 'F-150' },
    }),
  ],
};

describe('notification bell', () => {
  it('shows the unread count', async () => {
    renderApp({ api: apiWithInbox(inbox) });

    expect(await screen.findByRole('button', { name: 'Notifications, 2 unread' })).toBeInTheDocument();
  });

  it('hides the badge when everything is read', async () => {
    renderApp({ api: apiWithInbox({ unreadCount: 0, data: [] }) });

    expect(await screen.findByRole('button', { name: 'Notifications' })).toBeInTheDocument();
  });

  it('caps the badge at 9+', async () => {
    renderApp({ api: apiWithInbox({ unreadCount: 14, data: [] }) });

    const bell = await screen.findByRole('button', { name: 'Notifications, 14 unread' });
    expect(within(bell).getByText('9+')).toBeInTheDocument();
  });

  it('lists notices in plain words, with resolved alerts tagged', async () => {
    const { user } = renderApp({ api: apiWithInbox(inbox) });

    await user.click(await screen.findByRole('button', { name: 'Notifications, 2 unread' }));
    const panel = screen.getByRole('dialog', { name: 'Notifications' });

    const items = within(panel).getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Toyota Camry: 2 left');
    expect(items[0]).toHaveTextContent('5 min. ago');
    expect(items[1]).toHaveTextContent('Honda CR-V is out of stock');
    expect(items[2]).toHaveTextContent('Ford F-150: 3 left');
    expect(within(items[2]!).getByText('Restocked')).toBeInTheDocument();
  });

  it('words back-in-stock notices for the watcher', async () => {
    const { user } = renderApp({
      api: apiWithInbox(
        {
          unreadCount: 1,
          data: [notice({ type: 'BACK_IN_STOCK', quantity: 4, vehicle: { id: 'v', make: 'Honda', model: 'CR-V' } })],
        },
        priya,
      ),
    });

    await user.click(await screen.findByRole('button', { name: 'Notifications, 1 unread' }));

    expect(screen.getByRole('dialog', { name: 'Notifications' })).toHaveTextContent('Honda CR-V is back in stock');
  });

  it('marks a notice read and filters the table to that vehicle', async () => {
    const api = apiWithInbox(inbox);
    api.notifications.markRead.mockResolvedValue({});
    const { user } = renderApp({ api });

    await user.click(await screen.findByRole('button', { name: 'Notifications, 2 unread' }));
    await user.click(screen.getByRole('button', { name: /Toyota Camry: 2 left/ }));

    expect(api.notifications.markRead).toHaveBeenCalledWith('n-low');
    await waitFor(() =>
      expect(api.vehicles.search.mock.lastCall?.[0]).toMatchObject({ make: 'Toyota', model: 'Camry' }),
    );
    expect(screen.queryByRole('dialog', { name: 'Notifications' })).toBeNull();
  });

  it('marks everything read', async () => {
    const api = apiWithInbox(inbox);
    api.notifications.markAllRead.mockResolvedValue({ updated: 2 });
    const { user } = renderApp({ api });

    await user.click(await screen.findByRole('button', { name: 'Notifications, 2 unread' }));
    api.notifications.list.mockResolvedValue({ ...inbox, unreadCount: 0 });
    await user.click(screen.getByRole('button', { name: 'Mark all read' }));

    expect(api.notifications.markAllRead).toHaveBeenCalled();
    expect(await screen.findByRole('button', { name: 'Notifications' })).toBeInTheDocument();
  });

  it('says so when there is nothing to show', async () => {
    const { user } = renderApp({ api: apiWithInbox({ unreadCount: 0, data: [] }) });

    await user.click(await screen.findByRole('button', { name: 'Notifications' }));

    expect(screen.getByRole('dialog', { name: 'Notifications' })).toHaveTextContent('No notifications');
  });

  it('closes on Escape', async () => {
    const { user } = renderApp({ api: apiWithInbox(inbox) });

    await user.click(await screen.findByRole('button', { name: 'Notifications, 2 unread' }));
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog', { name: 'Notifications' })).toBeNull();
  });

  it('renders markup in vehicle names as text', async () => {
    const { user } = renderApp({
      api: apiWithInbox({
        unreadCount: 1,
        data: [notice({ vehicle: { id: 'v', make: '<img src=x onerror=alert(1)>', model: 'X' } })],
      }),
    });

    await user.click(await screen.findByRole('button', { name: 'Notifications, 1 unread' }));

    expect(screen.getByRole('dialog', { name: 'Notifications' })).toHaveTextContent(
      '<img src=x onerror=alert(1)> X: 2 left',
    );
    expect(document.querySelector('img')).toBeNull();
  });
});

describe('polling', () => {
  let hidden = false;

  beforeEach(() => {
    hidden = false;
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => (hidden ? 'hidden' : 'visible'));
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('checks for new notices about every 30 seconds', async () => {
    const api = apiWithInbox(inbox);
    renderApp({ api });
    await screen.findByRole('button', { name: 'Notifications, 2 unread' });
    const before = api.notifications.list.mock.calls.length;

    await act(() => vi.advanceTimersByTimeAsync(30_000));

    expect(api.notifications.list.mock.calls.length).toBe(before + 1);
  });

  it('pauses while the tab is hidden and catches up when it is shown again', async () => {
    const api = apiWithInbox(inbox);
    renderApp({ api });
    await screen.findByRole('button', { name: 'Notifications, 2 unread' });
    const before = api.notifications.list.mock.calls.length;

    hidden = true;
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await act(() => vi.advanceTimersByTimeAsync(120_000));
    expect(api.notifications.list.mock.calls.length).toBe(before);

    hidden = false;
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await waitFor(() => expect(api.notifications.list.mock.calls.length).toBeGreaterThan(before));
  });

  it('fails quietly and keeps the last known count', async () => {
    const api = apiWithInbox(inbox);
    renderApp({ api });
    await screen.findByRole('button', { name: 'Notifications, 2 unread' });

    api.notifications.list.mockRejectedValue(new Error('offline'));
    await act(() => vi.advanceTimersByTimeAsync(30_000));

    expect(screen.getByRole('button', { name: 'Notifications, 2 unread' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
