import { act, screen, waitFor, within } from '@testing-library/react';
import { ApiError } from '../api/client';
import { SESSION_EXPIRED_EVENT } from '../auth/AuthProvider';
import { dana, fakeApi, priya } from '../test/fake-api';
import { renderApp } from '../test/render';

function signedIn() {
  const api = fakeApi();
  api.auth.me.mockResolvedValue(priya);
  return api;
}

function signedOut() {
  const api = fakeApi();
  api.auth.me.mockRejectedValue(new ApiError(401, 'UNAUTHENTICATED', 'Authentication required'));
  return api;
}

describe('session', () => {
  it('restores the session from the cookie and shows the dashboard', async () => {
    renderApp({ api: signedIn() });

    expect(await screen.findByRole('heading', { name: 'Inventory' })).toBeInTheDocument();
  });

  it('sends a signed-out visitor to the sign-in page', async () => {
    renderApp({ api: signedOut() });

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('returns to sign-in with a message when the session expires mid-use', async () => {
    renderApp({ api: signedIn() });
    await screen.findByRole('heading', { name: 'Inventory' });

    act(() => {
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    });

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Your session expired. Sign in again.');
  });

  it('keeps signed-in users away from the sign-in page', async () => {
    renderApp({ api: signedIn(), route: '/login' });

    expect(await screen.findByRole('heading', { name: 'Inventory' })).toBeInTheDocument();
  });
});

describe('sign in', () => {
  it('signs in and opens the dashboard', async () => {
    const api = signedOut();
    api.auth.login.mockResolvedValue(priya);
    const { user } = renderApp({ api, route: '/login' });

    await user.type(await screen.findByLabelText('Email'), 'priya.nair@example.com');
    await user.type(screen.getByLabelText('Password'), 'S3curePass!');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('heading', { name: 'Inventory' })).toBeInTheDocument();
    expect(api.auth.login).toHaveBeenCalledWith('priya.nair@example.com', 'S3curePass!');
  });

  it('checks the fields before calling the API', async () => {
    const api = signedOut();
    const { user } = renderApp({ api, route: '/login' });

    await user.click(await screen.findByRole('button', { name: 'Sign in' }));

    expect(screen.getByLabelText('Email')).toHaveAccessibleDescription('Enter your email');
    expect(screen.getByLabelText('Password')).toHaveAccessibleDescription('Enter your password');
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
    expect(api.auth.login).not.toHaveBeenCalled();
  });

  it('shows the server’s answer for wrong credentials', async () => {
    const api = signedOut();
    api.auth.login.mockRejectedValue(new ApiError(401, 'UNAUTHENTICATED', 'Invalid email or password'));
    const { user } = renderApp({ api, route: '/login' });

    await user.type(await screen.findByLabelText('Email'), 'priya.nair@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrong-pass');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password');
  });

  it('disables the button while signing in', async () => {
    const api = signedOut();
    api.auth.login.mockReturnValue(new Promise(() => undefined));
    const { user } = renderApp({ api, route: '/login' });

    await user.type(await screen.findByLabelText('Email'), 'priya.nair@example.com');
    await user.type(screen.getByLabelText('Password'), 'S3curePass!');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(screen.getByRole('button', { name: 'Signing in…' })).toBeDisabled();
  });
});

describe('create account', () => {
  it('registers, signs in and opens the dashboard', async () => {
    const api = signedOut();
    api.auth.register.mockResolvedValue(priya);
    api.auth.login.mockResolvedValue(priya);
    const { user } = renderApp({ api, route: '/register' });

    await user.type(await screen.findByLabelText('Full name'), 'Priya Nair');
    await user.type(screen.getByLabelText('Email'), 'priya.nair@example.com');
    await user.type(screen.getByLabelText('Password'), 'S3curePass!');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByRole('heading', { name: 'Inventory' })).toBeInTheDocument();
    expect(api.auth.register).toHaveBeenCalledWith('Priya Nair', 'priya.nair@example.com', 'S3curePass!');
  });

  it('enforces the password length before calling the API', async () => {
    const api = signedOut();
    const { user } = renderApp({ api, route: '/register' });

    await user.type(await screen.findByLabelText('Full name'), 'Priya Nair');
    await user.type(screen.getByLabelText('Email'), 'priya.nair@example.com');
    await user.type(screen.getByLabelText('Password'), 'short');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(screen.getByLabelText('Password')).toHaveAccessibleDescription('Use at least 8 characters');
    expect(api.auth.register).not.toHaveBeenCalled();
  });

  it('puts server field errors next to the right field', async () => {
    const api = signedOut();
    api.auth.register.mockRejectedValue(new ApiError(409, 'EMAIL_TAKEN', 'Email is already registered'));
    const { user } = renderApp({ api, route: '/register' });

    await user.type(await screen.findByLabelText('Full name'), 'Priya Nair');
    await user.type(screen.getByLabelText('Email'), 'priya.nair@example.com');
    await user.type(screen.getByLabelText('Password'), 'S3curePass!');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() =>
      expect(screen.getByLabelText('Email')).toHaveAccessibleDescription('An account with this email already exists'),
    );
  });

  it('maps validation details from the API onto fields', async () => {
    const api = signedOut();
    api.auth.register.mockRejectedValue(
      new ApiError(400, 'VALIDATION_ERROR', 'Request validation failed', [
        { field: 'password', message: 'is too common' },
      ]),
    );
    const { user } = renderApp({ api, route: '/register' });

    await user.type(await screen.findByLabelText('Full name'), 'Priya Nair');
    await user.type(screen.getByLabelText('Email'), 'priya.nair@example.com');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() =>
      expect(screen.getByLabelText('Password')).toHaveAccessibleDescription('Password is too common'),
    );
  });
});

describe('demo access on the sign-in page', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  function withDemoAdmin() {
    vi.stubEnv('VITE_DEMO_ADMIN_EMAIL', 'demo.admin@example.com');
    vi.stubEnv('VITE_DEMO_ADMIN_PASSWORD', 'not-a-real-secret');
  }

  it('shows the demo admin email and password below the form', async () => {
    withDemoAdmin();
    renderApp({ api: signedOut(), route: '/login' });

    const demo = await screen.findByRole('region', { name: 'Demo access' });
    expect(within(demo).getByText('demo.admin@example.com')).toBeInTheDocument();
    expect(within(demo).getByText('not-a-real-secret')).toBeInTheDocument();
  });

  it('fills the form with the admin account and signs in with it', async () => {
    withDemoAdmin();
    const api = signedOut();
    api.auth.login.mockResolvedValue(dana);
    const { user } = renderApp({ api, route: '/login' });

    await user.click(await screen.findByRole('button', { name: 'Use admin account' }));
    expect(screen.getByLabelText('Email')).toHaveValue('demo.admin@example.com');
    expect(screen.getByLabelText('Password')).toHaveValue('not-a-real-secret');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(api.auth.login).toHaveBeenCalledWith('demo.admin@example.com', 'not-a-real-secret');
  });

  it('asks people who want the user view to create their own account', async () => {
    withDemoAdmin();
    const { user } = renderApp({ api: signedOut(), route: '/login' });

    const demo = await screen.findByRole('region', { name: 'Demo access' });
    await user.click(within(demo).getByRole('link', { name: 'Create a user account' }));

    expect(await screen.findByRole('heading', { name: 'Create account' })).toBeInTheDocument();
  });

  it('shows no credentials unless the demo admin is configured', async () => {
    renderApp({ api: signedOut(), route: '/login' });

    await screen.findByRole('heading', { name: 'Sign in' });
    expect(screen.queryByRole('region', { name: 'Demo access' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Create an account' })).toBeInTheDocument();
  });
});
