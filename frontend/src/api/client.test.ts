import { ApiError, createApiClient } from './client';

function jsonResponse(status: number, body?: unknown) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
  });
}

function setup(response: Response | Error) {
  const fetchImpl = vi.fn<typeof fetch>(async () => {
    if (response instanceof Error) throw response;
    return response;
  });
  const onUnauthorized = vi.fn();
  const api = createApiClient({ fetchImpl, onUnauthorized });
  return { api, fetchImpl, onUnauthorized };
}

describe('api client', () => {
  it('sends JSON with the session cookie to /api and returns the parsed body', async () => {
    const { api, fetchImpl } = setup(jsonResponse(201, { vehicle: { id: 'v1' } }));

    const result = await api.post('/vehicles', { make: 'Toyota' });

    expect(result).toEqual({ vehicle: { id: 'v1' } });
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe('/api/vehicles');
    expect(init).toMatchObject({
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify({ make: 'Toyota' }),
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    });
  });

  it('sends no body when there is nothing to send', async () => {
    const { api, fetchImpl } = setup(jsonResponse(200, { watching: true }));

    await api.post('/vehicles/v1/watch');

    expect(fetchImpl.mock.calls[0]![1]!.body).toBeUndefined();
  });

  it('builds query strings from defined parameters only', async () => {
    const { api, fetchImpl } = setup(jsonResponse(200, { data: [], count: 0 }));

    await api.get('/vehicles/search', { make: 'Land Rover', minPrice: 1000, model: undefined, category: '' });

    expect(fetchImpl.mock.calls[0]![0]).toBe('/api/vehicles/search?make=Land+Rover&minPrice=1000');
  });

  it('returns undefined for 204 No Content', async () => {
    const { api } = setup(jsonResponse(204));

    await expect(api.del('/vehicles/v1')).resolves.toBeUndefined();
  });

  it('turns the standard error shape into an ApiError with field details', async () => {
    const { api } = setup(
      jsonResponse(400, {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: [{ field: 'price', message: 'must be 0 or more' }],
        },
      }),
    );

    const err = await api.post('/vehicles', {}).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      details: [{ field: 'price', message: 'must be 0 or more' }],
    });
  });

  it('reports a network failure as an ApiError', async () => {
    const { api } = setup(new TypeError('Failed to fetch'));

    await expect(api.get('/vehicles')).rejects.toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
  });

  it('reports a non-JSON error response as an ApiError', async () => {
    const { api } = setup(new Response('Bad gateway', { status: 502 }));

    await expect(api.get('/vehicles')).rejects.toMatchObject({ status: 502, code: 'HTTP_ERROR' });
  });

  it('signals an expired session on 401 so the app can sign the user out', async () => {
    const { api, onUnauthorized } = setup(
      jsonResponse(401, { error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } }),
    );

    await api.get('/vehicles').catch(() => undefined);

    expect(onUnauthorized).toHaveBeenCalledOnce();
  });

  it('lets login and session restore handle their own 401s', async () => {
    const { api, onUnauthorized } = setup(
      jsonResponse(401, { error: { code: 'UNAUTHENTICATED', message: 'Invalid email or password' } }),
    );

    await api.post('/auth/login', {}, { handleUnauthorized: false }).catch(() => undefined);

    expect(onUnauthorized).not.toHaveBeenCalled();
  });
});
