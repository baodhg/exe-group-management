import { decodeUser, type SessionStore, type StoredSession } from "../auth/sessionStore";
import type { ApiEnvelope, ApiErrorItem, ApiResult, ListParams } from "./types";

export const loginPath = "/api/v1/auth/login";
export const refreshPath = "/api/v1/auth/refresh-token";
export const logoutPath = "/api/v1/auth/logout";
const sessionlessPaths: ReadonlySet<string> = new Set([loginPath, refreshPath, logoutPath]);
const sessionlessTimeoutMs = 15_000;
const correlationHeader = "X-Correlation-ID";
const refreshLockName = "exe-group-token-refresh";

export type RefreshLock = <T>(work: () => Promise<T>) => Promise<T>;

const acrossBrowserTabs: RefreshLock = (work) =>
  typeof navigator !== "undefined" && navigator.locks ? navigator.locks.request(refreshLockName, work) : work();

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
  refreshLock?: RefreshLock;
}

export interface ApiClient {
  get<T>(path: string, params?: ListParams): Promise<ApiResult<T>>;
  post<T = unknown>(path: string, body?: unknown): Promise<ApiResult<T>>;
  put<T = unknown>(path: string, body?: unknown): Promise<ApiResult<T>>;
  patch<T = unknown>(path: string, body?: unknown): Promise<ApiResult<T>>;
  delete(path: string): Promise<void>;
  signOut(): Promise<void>;
}

export function createApiClient({ fetcher = fetch.bind(globalThis), store, onSignedOut, refreshLock = acrossBrowserTabs }: ApiClientOptions): ApiClient {
  let refreshing: Promise<StoredSession | null> | null = null;

  async function send<T>(method: string, path: string, body: unknown, allowRefresh: boolean): Promise<ApiResult<T>> {
    const sessionless = sessionlessPaths.has(path);
    const session = sessionless ? null : store.read();
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
      signal: sessionless ? AbortSignal.timeout(sessionlessTimeoutMs) : undefined,
    });

    if (response.status === 401 && allowRefresh && !sessionless) {
      if (!store.read()) {
        onSignedOut?.();
      } else if (session && (await refreshOnce(session))) {
        return send<T>(method, path, body, false);
      }
    }

    return read<T>(response);
  }

  function refreshOnce(rejected: StoredSession): Promise<StoredSession | null> {
    refreshing ??= refreshLock(() => renew(rejected)).finally(() => {
      refreshing = null;
    });
    return refreshing;
  }

  async function renew(rejected: StoredSession): Promise<StoredSession | null> {
    const current = store.read();
    if (!current) {
      return null;
    }

    if (current.accessToken !== rejected.accessToken) {
      return sameUser(current, rejected) ? current : null;
    }

    try {
      const { data: tokens } = await send<StoredSession>("POST", refreshPath, { refreshToken: current.refreshToken }, false);
      if (store.read()?.refreshToken !== current.refreshToken) {
        void revoke(tokens.refreshToken);
        return null;
      }

      store.write(tokens);
      return tokens;
    } catch (error) {
      const rejectedByServer = error instanceof ApiError && (error.status === 400 || error.status === 401);
      if (rejectedByServer && store.read()?.refreshToken === current.refreshToken) {
        store.clear();
        onSignedOut?.();
      }

      return null;
    }
  }

  async function revoke(refreshToken: string): Promise<void> {
    await send("POST", logoutPath, { refreshToken }, false).catch(() => undefined);
  }

  return {
    get: (path, params) => send("GET", withQuery(path, params), undefined, true),
    post: (path, body) => send("POST", path, body, true),
    put: (path, body) => send("PUT", path, body, true),
    patch: (path, body) => send("PATCH", path, body, true),
    delete: async (path) => {
      await send("DELETE", path, undefined, true);
    },
    signOut: async () => {
      const session = store.read();
      store.clear();
      if (session) {
        await revoke(session.refreshToken);
      }
    },
  };
}

function sameUser(first: StoredSession, second: StoredSession): boolean {
  const firstUser = decodeUser(first.accessToken)?.userId;
  return firstUser !== undefined && firstUser === decodeUser(second.accessToken)?.userId;
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
