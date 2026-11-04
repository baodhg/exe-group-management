import type { SessionStore, StoredSession } from "../auth/sessionStore";
import type { ApiEnvelope, ApiErrorItem, ApiResult, ListParams } from "./types";

export const refreshPath = "/api/v1/auth/refresh-token";
const correlationHeader = "X-Correlation-ID";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly errors: ApiErrorItem[];
  readonly traceId: string | null;

  constructor(status: number, message: string, errors: ApiErrorItem[], traceId: string | null) {
    super(errors[0]?.message ?? message);
    this.name = "ApiError";
    this.status = status;
    this.code = errors[0]?.code ?? "UNKNOWN_ERROR";
    this.errors = errors;
    this.traceId = traceId;
  }

  fieldErrors(): Record<string, string> {
    return Object.fromEntries(this.errors.filter((error) => error.field).map((error) => [error.field!, error.message]));
  }
}

export interface ApiClientOptions {
  fetcher?: typeof fetch;
  store: SessionStore;
  onSignedOut?: () => void;
}

export interface ApiClient {
  get<T>(path: string, params?: ListParams): Promise<ApiResult<T>>;
  post<T = unknown>(path: string, body?: unknown): Promise<ApiResult<T>>;
  put<T = unknown>(path: string, body?: unknown): Promise<ApiResult<T>>;
  delete(path: string): Promise<void>;
}

export function createApiClient({ fetcher = fetch.bind(globalThis), store, onSignedOut }: ApiClientOptions): ApiClient {
  let refreshing: Promise<StoredSession | null> | null = null;

  async function send<T>(method: string, path: string, body: unknown, allowRefresh: boolean): Promise<ApiResult<T>> {
    const session = store.read();
    const headers = new Headers({ Accept: "application/json" });
    if (body !== undefined) {
      headers.set("Content-Type", "application/json");
    }

    if (session) {
      headers.set("Authorization", `Bearer ${session.accessToken}`);
    }

    const response = await fetcher(path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (response.status === 401 && allowRefresh && session && path !== refreshPath) {
      const renewed = await refreshOnce(session);
      if (renewed) {
        return send<T>(method, path, body, false);
      }
    }

    return read<T>(response);
  }

  function refreshOnce(session: StoredSession): Promise<StoredSession | null> {
    refreshing ??= (async () => {
      try {
        const result = await send<StoredSession>("POST", refreshPath, { refreshToken: session.refreshToken }, false);
        store.write(result.data);
        return result.data;
      } catch {
        store.clear();
        onSignedOut?.();
        return null;
      } finally {
        refreshing = null;
      }
    })();
    return refreshing;
  }

  return {
    get: (path, params) => send("GET", withQuery(path, params), undefined, true),
    post: (path, body) => send("POST", path, body, true),
    put: (path, body) => send("PUT", path, body, true),
    delete: async (path) => {
      await send("DELETE", path, undefined, true);
    },
  };
}

async function read<T>(response: Response): Promise<ApiResult<T>> {
  if (response.status === 204) {
    return { data: undefined as T, message: "", traceId: response.headers.get(correlationHeader) };
  }

  let envelope: ApiEnvelope<T>;
  try {
    envelope = (await response.json()) as ApiEnvelope<T>;
  } catch {
    throw new ApiError(
      response.status,
      "The server did not answer with an API response.",
      [{ code: response.status >= 500 ? "UPSTREAM_UNAVAILABLE" : "UNKNOWN_ERROR", field: null, message: "The server did not answer with an API response." }],
      response.headers.get(correlationHeader),
    );
  }

  if (!response.ok || !envelope.success) {
    throw new ApiError(response.status, envelope.message, envelope.errors ?? [], envelope.traceId);
  }

  return { data: envelope.data as T, message: envelope.message, traceId: envelope.traceId, pagination: envelope.pagination };
}

function withQuery(path: string, params?: ListParams): string {
  if (!params) {
    return path;
  }

  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      query.set(key, String(value));
    }
  }

  const text = query.toString();
  return text ? `${path}?${text}` : path;
}
