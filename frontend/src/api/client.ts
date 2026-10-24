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

export function createApiClient(_options: ApiClientOptions = {}) {
  const notImplemented = (): Promise<never> => Promise.reject(new Error('Not implemented'));
  return {
    get: <T>(_path: string, _query?: QueryParams, _options?: RequestOptions): Promise<T> => notImplemented(),
    post: <T>(_path: string, _body?: unknown, _options?: RequestOptions): Promise<T> => notImplemented(),
    put: <T>(_path: string, _body?: unknown, _options?: RequestOptions): Promise<T> => notImplemented(),
    del: <T>(_path: string, _options?: RequestOptions): Promise<T> => notImplemented(),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
