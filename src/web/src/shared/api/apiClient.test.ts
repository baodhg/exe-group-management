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

  it("reports a non-json gateway failure as an upstream error", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("<html>Bad Gateway</html>", { status: 502 }));
    const client = createApiClient({ fetcher, store: memoryStore(null) });

    await expect(client.get("/api/v1/semesters")).rejects.toMatchObject({ status: 502, code: "UPSTREAM_UNAVAILABLE" });
  });
});
