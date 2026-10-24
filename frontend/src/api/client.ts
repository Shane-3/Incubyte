export interface ErrorDetail {
  field: string;
  message: string;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: ErrorDetail[] = [],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export type QueryParams = Record<string, string | number | boolean | undefined>;

export interface RequestOptions {
  /** Set false where a 401 is an expected answer (login, session restore), not an expired session. */
  handleUnauthorized?: boolean;
}

export interface ApiClientOptions {
  fetchImpl?: typeof fetch;
  onUnauthorized?: () => void;
}

const BASE = '/api';

function toQueryString(query?: QueryParams): string {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  const text = params.toString();
  return text ? `?${text}` : '';
}

async function toApiError(response: Response): Promise<ApiError> {
  try {
    const body = (await response.json()) as { error?: { code?: string; message?: string; details?: ErrorDetail[] } };
    if (body.error?.code) {
      return new ApiError(response.status, body.error.code, body.error.message ?? 'Request failed', body.error.details);
    }
  } catch {
    // Not JSON (a proxy error page, for example): fall through to a generic error.
  }
  return new ApiError(response.status, 'HTTP_ERROR', `Request failed (${response.status})`);
}

/** The only module that talks to the network. The session token lives in an httpOnly cookie, never in JS. */
export function createApiClient({ fetchImpl = fetch, onUnauthorized }: ApiClientOptions = {}) {
  async function request<T>(method: string, path: string, body: unknown, options: RequestOptions): Promise<T> {
    let response: Response;
    try {
      response = await fetchImpl(`${BASE}${path}`, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        ...(body !== undefined && { body: JSON.stringify(body) }),
      });
    } catch {
      throw new ApiError(0, 'NETWORK_ERROR', "Couldn't reach the server. Check your connection.");
    }

    if (response.ok) {
      return (response.status === 204 ? undefined : await response.json()) as T;
    }
    if (response.status === 401 && options.handleUnauthorized !== false) {
      onUnauthorized?.();
    }
    throw await toApiError(response);
  }

  return {
    get: <T>(path: string, query?: QueryParams, options: RequestOptions = {}) =>
      request<T>('GET', `${path}${toQueryString(query)}`, undefined, options),
    post: <T>(path: string, body?: unknown, options: RequestOptions = {}) => request<T>('POST', path, body, options),
    put: <T>(path: string, body?: unknown, options: RequestOptions = {}) => request<T>('PUT', path, body, options),
    del: <T>(path: string, options: RequestOptions = {}) => request<T>('DELETE', path, undefined, options),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
