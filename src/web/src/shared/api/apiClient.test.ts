import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, createApiClient } from "./apiClient";
import type { SessionStore, StoredSession } from "../auth/sessionStore";

function memoryStore(initial: StoredSession | null): SessionStore & { current: StoredSession | null } {
  return {
    current: initial,
    read() {
      return this.current;
    },
    write(session) {
      this.current = session;
    },
    clear() {
      this.current = null;
    },
  };
}

function envelope(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const session: StoredSession = { accessToken: "old-access", refreshToken: "refresh-1" };

function accessTokenOf(userId: string, version: string): string {
  return `header.${btoa(JSON.stringify({ sub: userId, exp: 4_102_444_800, version }))}.signature`;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("apiClient", () => {
  it("returns data and pagination from a success envelope and sends the bearer token", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      envelope(200, {
        success: true,
        message: "Semesters loaded",
        data: [{ code: "FA26" }],
        errors: null,
        traceId: "t-1",
        pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
      }),
    );
    const client = createApiClient({ fetcher, store: memoryStore(session) });

    const result = await client.get<{ code: string }[]>("/api/v1/semesters");

    expect(result.data).toEqual([{ code: "FA26" }]);
    expect(result.pagination?.totalItems).toBe(1);
    const [, init] = fetcher.mock.calls[0]!;
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer old-access");
  });

  it("turns a failure envelope into an ApiError carrying the business code, field and trace id", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      envelope(409, {
        success: false,
        message: "The request conflicts with a business rule",
        data: null,
        errors: [{ code: "GROUP_FULL", field: null, message: "The group is full." }],
        traceId: "t-2",
      }),
    );
    const client = createApiClient({ fetcher, store: memoryStore(session) });

    const error = await client.post("/api/v1/join-requests/1/approve").catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(409);
    expect((error as ApiError).code).toBe("GROUP_FULL");
    expect((error as ApiError).traceId).toBe("t-2");
  });

  it("refreshes once on 401 and retries the original call with the new token", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(envelope(401, { success: false, message: "Authentication required", data: null, errors: [{ code: "UNAUTHORIZED", field: null, message: "expired" }], traceId: "t-3" }))
      .mockResolvedValueOnce(envelope(200, { success: true, message: "Token refreshed", data: { accessToken: "new-access", refreshToken: "refresh-2" }, errors: null, traceId: "t-4" }))
      .mockResolvedValueOnce(envelope(200, { success: true, message: "ok", data: { id: 1 }, errors: null, traceId: "t-5" }));
    const store = memoryStore(session);
    const client = createApiClient({ fetcher, store });

    const result = await client.get<{ id: number }>("/api/v1/auth/me");

    expect(result.data.id).toBe(1);
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(fetcher.mock.calls[1]![0]).toBe("/api/v1/auth/refresh-token");
    expect(new Headers(fetcher.mock.calls[2]![1].headers).get("Authorization")).toBe("Bearer new-access");
    expect(store.current).toEqual({ accessToken: "new-access", refreshToken: "refresh-2" });
  });

  it("renews the session on request so a changed profile reaches the token", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(envelope(200, { success: true, message: "Token refreshed", data: { accessToken: "renamed-access", refreshToken: "refresh-2" }, errors: null, traceId: "t" }));
    const store = memoryStore(session);
    const client = createApiClient({ fetcher, store });

    const renewed = await client.renewSession();

    expect(renewed?.accessToken).toBe("renamed-access");
    expect(fetcher.mock.calls[0]![0]).toBe("/api/v1/auth/refresh-token");
    expect(store.current?.refreshToken).toBe("refresh-2");
  });

  it("signs the user out when the refresh also fails, without looping", async () => {
    const unauthorized = () => envelope(401, { success: false, message: "Authentication required", data: null, errors: [{ code: "UNAUTHORIZED", field: null, message: "no" }], traceId: "t" });
    const fetcher = vi.fn().mockImplementation(() => Promise.resolve(unauthorized()));
    const store = memoryStore(session);
    const onSignedOut = vi.fn();
    const client = createApiClient({ fetcher, store, onSignedOut });

    await expect(client.get("/api/v1/semesters")).rejects.toMatchObject({ status: 401, code: "UNAUTHORIZED" });

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(store.current).toBeNull();
    expect(onSignedOut).toHaveBeenCalledOnce();
  });

  it("does not spend a rotated refresh token when a parallel call gets its 401 after the refresh finished", async () => {
    const oldAccess = accessTokenOf("user-a", "old");
    const newAccess = accessTokenOf("user-a", "new");
    const spentTokens: string[] = [];
    let releaseLateCall!: () => void;
    const lateCall = new Promise<void>((resolve) => {
      releaseLateCall = resolve;
    });
    const fetcher = vi.fn(async (path: string, init: RequestInit) => {
      if (path === "/api/v1/auth/refresh-token") {
        spentTokens.push((JSON.parse(init.body as string) as { refreshToken: string }).refreshToken);
        return envelope(200, { success: true, message: "Token refreshed", data: { accessToken: newAccess, refreshToken: "refresh-2" }, errors: null, traceId: "t" });
      }

      if (new Headers(init.headers).get("Authorization") === `Bearer ${oldAccess}`) {
        if (path === "/late") {
          await lateCall;
        }

        return envelope(401, { success: false, message: "Authentication required", data: null, errors: [{ code: "UNAUTHORIZED", field: null, message: "expired" }], traceId: "t" });
      }

      return envelope(200, { success: true, message: "ok", data: path, errors: null, traceId: "t" });
    });
    const store = memoryStore({ accessToken: oldAccess, refreshToken: "refresh-1" });
    const onSignedOut = vi.fn();
    const client = createApiClient({ fetcher: fetcher as unknown as typeof fetch, store, onSignedOut });

    const first = client.get<string>("/first");
    const late = client.get<string>("/late");
    await first;
    releaseLateCall();

    expect((await late).data).toBe("/late");
    expect(spentTokens).toEqual(["refresh-1"]);
    expect(onSignedOut).not.toHaveBeenCalled();
    expect(store.current?.refreshToken).toBe("refresh-2");
  });

  it.each([429, 502])("keeps the session when the refresh answers %i, so the user can retry", async (status) => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(envelope(401, { success: false, message: "Authentication required", data: null, errors: [{ code: "UNAUTHORIZED", field: null, message: "expired" }], traceId: "t" }))
      .mockResolvedValueOnce(envelope(status, { success: false, message: "Unavailable", data: null, errors: [{ code: "TOO_MANY_REQUESTS", field: null, message: "later" }], traceId: "t" }));
    const store = memoryStore(session);
    const onSignedOut = vi.fn();
    const client = createApiClient({ fetcher, store, onSignedOut });

    await expect(client.get("/api/v1/semesters")).rejects.toMatchObject({ status: 401 });

    expect(store.current).toEqual(session);
    expect(onSignedOut).not.toHaveBeenCalled();
  });

  it("keeps the session when the refresh cannot reach the server", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(envelope(401, { success: false, message: "Authentication required", data: null, errors: [{ code: "UNAUTHORIZED", field: null, message: "expired" }], traceId: "t" }))
      .mockRejectedValueOnce(new TypeError("network down"));
    const store = memoryStore(session);
    const client = createApiClient({ fetcher, store });

    await expect(client.get("/api/v1/semesters")).rejects.toMatchObject({ status: 401 });

    expect(store.current).toEqual(session);
  });

  it("clears the session at once on sign-out and asks the server to revoke the refresh token", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const store = memoryStore(session);
    const client = createApiClient({ fetcher, store });

    const signedOut = client.signOut();
    expect(store.current).toBeNull();
    await signedOut;

    const [path, init] = fetcher.mock.calls[0]!;
    expect(path).toBe("/api/v1/auth/logout");
    expect(JSON.parse(init.body)).toEqual({ refreshToken: "refresh-1" });
    expect(new Headers(init.headers).get("Authorization")).toBeNull();
  });

  it("still signs out locally when the server cannot be reached", async () => {
    const fetcher = vi.fn().mockRejectedValue(new TypeError("network down"));
    const store = memoryStore(session);
    const client = createApiClient({ fetcher, store });

    await expect(client.signOut()).resolves.toBeUndefined();

    expect(store.current).toBeNull();
  });

  describe("when the session changes while a refresh is in flight", () => {
    const expired = () => envelope(401, { success: false, message: "Authentication required", data: null, errors: [{ code: "UNAUTHORIZED", field: null, message: "expired" }], traceId: "t" });
    const refreshed = () => envelope(200, { success: true, message: "Token refreshed", data: { accessToken: "new-access", refreshToken: "refresh-2" }, errors: null, traceId: "t" });

    function pausedRefresh() {
      const calls: { path: string; refreshToken?: string; bearer: string | null }[] = [];
      let answer!: (response: Response) => void;
      const refreshAnswer = new Promise<Response>((resolve) => {
        answer = resolve;
      });
      let reachedRefresh!: () => void;
      const refreshStarted = new Promise<void>((resolve) => {
        reachedRefresh = resolve;
      });
      const fetcher = vi.fn(async (path: string, init: RequestInit) => {
        const body = init.body ? (JSON.parse(init.body as string) as { refreshToken?: string }) : {};
        calls.push({ path, refreshToken: body.refreshToken, bearer: new Headers(init.headers).get("Authorization") });
        if (path === "/api/v1/auth/refresh-token") {
          reachedRefresh();
          return refreshAnswer;
        }

        return path === "/api/v1/auth/logout" ? new Response(null, { status: 204 }) : expired();
      });
      return { calls, answer, refreshStarted, fetcher: fetcher as unknown as typeof fetch };
    }

    it("does not restore the session after sign-out, and revokes the token that arrived too late", async () => {
      const { calls, answer, refreshStarted, fetcher } = pausedRefresh();
      const store = memoryStore(session);
      const client = createApiClient({ fetcher, store });

      const pending = client.get("/api/v1/semesters");
      await refreshStarted;
      await client.signOut();
      answer(refreshed());

      await expect(pending).rejects.toMatchObject({ status: 401 });
      expect(store.current).toBeNull();
      const revoked = calls.filter((call) => call.path === "/api/v1/auth/logout").map((call) => call.refreshToken);
      expect(revoked).toEqual(["refresh-1", "refresh-2"]);
      expect(calls.filter((call) => call.bearer === "Bearer new-access")).toEqual([]);
    });

    it("leaves the next user alone when the previous user's refresh is rejected", async () => {
      const { answer, refreshStarted, fetcher } = pausedRefresh();
      const store = memoryStore(session);
      const onSignedOut = vi.fn();
      const client = createApiClient({ fetcher, store, onSignedOut });
      const nextUser: StoredSession = { accessToken: "b-access", refreshToken: "b-refresh" };

      const pending = client.get("/api/v1/semesters");
      await refreshStarted;
      store.write(nextUser);
      answer(expired());

      await expect(pending).rejects.toMatchObject({ status: 401 });
      expect(store.current).toEqual(nextUser);
      expect(onSignedOut).not.toHaveBeenCalled();
    });

    it("does not overwrite the next user with the previous user's new tokens", async () => {
      const { calls, answer, refreshStarted, fetcher } = pausedRefresh();
      const store = memoryStore(session);
      const client = createApiClient({ fetcher, store });
      const nextUser: StoredSession = { accessToken: "b-access", refreshToken: "b-refresh" };

      const pending = client.get("/api/v1/semesters");
      await refreshStarted;
      store.write(nextUser);
      answer(refreshed());

      await expect(pending).rejects.toMatchObject({ status: 401 });
      expect(store.current).toEqual(nextUser);
      expect(calls.filter((call) => call.path === "/api/v1/auth/logout").map((call) => call.refreshToken)).toEqual(["refresh-2"]);
    });
  });

  it("spends a refresh token once when two tabs share a session", async () => {
    const oldAccess = accessTokenOf("user-a", "old");
    const newAccess = accessTokenOf("user-a", "new");
    const spentTokens: string[] = [];
    const fetcher = vi.fn(async (path: string, init: RequestInit) => {
      if (path === "/api/v1/auth/refresh-token") {
        spentTokens.push((JSON.parse(init.body as string) as { refreshToken: string }).refreshToken);
        return envelope(200, { success: true, message: "Token refreshed", data: { accessToken: newAccess, refreshToken: "refresh-2" }, errors: null, traceId: "t" });
      }

      return new Headers(init.headers).get("Authorization") === `Bearer ${oldAccess}`
        ? envelope(401, { success: false, message: "Authentication required", data: null, errors: [{ code: "UNAUTHORIZED", field: null, message: "expired" }], traceId: "t" })
        : envelope(200, { success: true, message: "ok", data: path, errors: null, traceId: "t" });
    }) as unknown as typeof fetch;
    let queue: Promise<unknown> = Promise.resolve();
    const refreshLock = <T,>(work: () => Promise<T>): Promise<T> => {
      const turn = queue.then(work);
      queue = turn.catch(() => undefined);
      return turn;
    };
    const store = memoryStore({ accessToken: oldAccess, refreshToken: "refresh-1" });
    const firstTab = createApiClient({ fetcher, store, refreshLock });
    const secondTab = createApiClient({ fetcher, store, refreshLock });

    const results = await Promise.all([firstTab.get<string>("/first"), secondTab.get<string>("/second")]);

    expect(results.map((result) => result.data)).toEqual(["/first", "/second"]);
    expect(spentTokens).toEqual(["refresh-1"]);
  });

  it("never replays a call of the previous user with the next user's token", async () => {
    const previous: StoredSession = { accessToken: accessTokenOf("user-a", "1"), refreshToken: "a-refresh" };
    const next: StoredSession = { accessToken: accessTokenOf("user-b", "1"), refreshToken: "b-refresh" };
    let answerFirstCall!: (response: Response) => void;
    const firstCall = new Promise<Response>((resolve) => {
      answerFirstCall = resolve;
    });
    const fetcher = vi.fn().mockReturnValueOnce(firstCall);
    const store = memoryStore(previous);
    const client = createApiClient({ fetcher, store });

    const pending = client.post("/api/v1/join-requests/1/approve");
    store.write(next);
    answerFirstCall(envelope(401, { success: false, message: "Authentication required", data: null, errors: [{ code: "UNAUTHORIZED", field: null, message: "expired" }], traceId: "t" }));

    await expect(pending).rejects.toMatchObject({ status: 401 });
    expect(fetcher).toHaveBeenCalledOnce();
    expect(store.current).toEqual(next);
  });

  it("treats a wrong password as an answer, not as an expired session", async () => {
    const fetcher = vi.fn().mockResolvedValue(envelope(401, { success: false, message: "Authentication required", data: null, errors: [{ code: "UNAUTHORIZED", field: null, message: "expired" }], traceId: "t" }));
    const store = memoryStore(session);
    const onSignedOut = vi.fn();
    const client = createApiClient({ fetcher, store, onSignedOut });

    await expect(client.post("/api/v1/auth/login", { email: "a@b.c", password: "wrong" })).rejects.toMatchObject({ status: 401 });

    expect(fetcher).toHaveBeenCalledOnce();
    expect(new Headers(fetcher.mock.calls[0]![1].headers).get("Authorization")).toBeNull();
    expect(store.current).toEqual(session);
    expect(onSignedOut).not.toHaveBeenCalled();
  });

  it("signs this tab out when another tab already ended the session", async () => {
    const fetcher = vi.fn().mockResolvedValue(envelope(401, { success: false, message: "Authentication required", data: null, errors: [{ code: "UNAUTHORIZED", field: null, message: "expired" }], traceId: "t" }));
    const onSignedOut = vi.fn();
    const client = createApiClient({ fetcher, store: memoryStore(null), onSignedOut });

    await expect(client.get("/api/v1/semesters")).rejects.toMatchObject({ status: 401 });

    expect(onSignedOut).toHaveBeenCalledOnce();
  });

  it("puts a time limit on the refresh call so a silent server cannot hold every tab", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(envelope(401, { success: false, message: "Authentication required", data: null, errors: [{ code: "UNAUTHORIZED", field: null, message: "expired" }], traceId: "t" }))
      .mockRejectedValueOnce(new DOMException("timed out", "TimeoutError"));
    const store = memoryStore(session);
    const client = createApiClient({ fetcher, store });

    await expect(client.get("/api/v1/semesters")).rejects.toMatchObject({ status: 401 });

    expect(fetcher.mock.calls[1]![1].signal).toBeInstanceOf(AbortSignal);
    expect(fetcher.mock.calls[0]![1].signal).toBeUndefined();
    expect(store.current).toEqual(session);
  });

  it("sends a partial update with PATCH", async () => {
    const fetcher = vi.fn().mockResolvedValue(envelope(200, { success: true, message: "ok", data: { status: "Locked" }, errors: null, traceId: "t" }));
    const client = createApiClient({ fetcher, store: memoryStore(session) });

    const result = await client.patch<{ status: string }>("/api/v1/users/1/status", { status: "Locked" });

    expect(result.data.status).toBe("Locked");
    expect(fetcher.mock.calls[0]![1].method).toBe("PATCH");
  });

  it("passes resource filters along with the list parameters", async () => {
    const fetcher = vi.fn().mockResolvedValue(envelope(200, { success: true, message: "ok", data: [], errors: null, traceId: "t" }));
    const client = createApiClient({ fetcher, store: memoryStore(session) });

    await client.get("/api/v1/join-requests", { mine: true, status: "Pending", page: 2, search: "" });

    expect(fetcher.mock.calls[0]![0]).toBe("/api/v1/join-requests?mine=true&status=Pending&page=2");
  });

  it("reports a non-json gateway failure as an upstream error", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("<html>Bad Gateway</html>", { status: 502 }));
    const client = createApiClient({ fetcher, store: memoryStore(null) });

    await expect(client.get("/api/v1/semesters")).rejects.toMatchObject({ status: 502, code: "UPSTREAM_UNAVAILABLE" });
  });
});
