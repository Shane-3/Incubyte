import { screen, within } from '@testing-library/react';
import { fakeApi, priya } from '../test/fake-api';
import { renderApp } from '../test/render';

function signedIn() {
  const api = fakeApi();
  api.auth.me.mockResolvedValue(priya);
  return api;
}

afterEach(() => {
  delete document.documentElement.dataset.theme;
  window.localStorage.clear();
});

describe('app shell', () => {
  it('shows who is signed in and their role', async () => {
    renderApp({ api: signedIn() });

    expect(await screen.findByText('Priya Nair')).toBeInTheDocument();
    expect(screen.getByText('user')).toBeInTheDocument();
  });

  it('signs out from the account menu', async () => {
    const api = signedIn();
    const { user } = renderApp({ api });

    await user.click(await screen.findByRole('button', { name: 'Account menu' }));
    await user.click(screen.getByRole('menuitem', { name: 'Sign out' }));

    expect(api.auth.logout).toHaveBeenCalled();
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('switches to the dark theme and remembers it', async () => {
    const { user } = renderApp({ api: signedIn() });

    await user.click(await screen.findByRole('button', { name: 'Account menu' }));
    await user.click(screen.getByRole('menuitem', { name: 'Use dark theme' }));

    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(window.localStorage.getItem('forecourt.theme')).toBe('dark');
  });

  it('opens and closes the navigation slide-over on small screens', async () => {
    const { user } = renderApp({ api: signedIn() });

    await user.click(await screen.findByRole('button', { name: 'Open navigation' }));
    const sheet = screen.getByRole('dialog', { name: 'Navigation' });
    expect(within(sheet).getByRole('link', { name: 'Out of stock' })).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Navigation' })).toBeNull();
  });

  it('names the current view in the breadcrumb', async () => {
    renderApp({ api: signedIn(), route: '/?stock=out' });

    expect(await screen.findByText('Out of stock', { selector: 'header span' })).toBeInTheDocument();
  });

  it('keeps menus keyboard operable', async () => {
    const { user } = renderApp({ api: signedIn() });

    const trigger = await screen.findByRole('button', { name: 'Account menu' });
    trigger.focus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Use dark theme' })).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Sign out' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(trigger).toHaveFocus();
  });
});
