import { describe, expect, it, vi } from "vitest";
import { listAll } from "./listAll";

describe("listAll", () => {
  it("follows the pages until the last one, keeping the filters", async () => {
    const get = vi.fn(async (_path: string, params?: Record<string, unknown>) => ({
      data: params?.page === 1 ? ["a", "b"] : ["c"],
      message: "",
      traceId: null,
      pagination: { page: Number(params?.page), pageSize: 100, totalItems: 3, totalPages: 2 },
    }));

    await expect(listAll<string>({ get } as never, "/x", { sort: "name" })).resolves.toEqual(["a", "b", "c"]);
    expect(get).toHaveBeenCalledTimes(2);
    expect(get).toHaveBeenLastCalledWith("/x", { sort: "name", page: 2, pageSize: 100 });
  });

  it("stops after one call when the response has no pagination", async () => {
    const get = vi.fn(async () => ({ data: ["a"], message: "", traceId: null }));

    await expect(listAll<string>({ get } as never, "/x")).resolves.toEqual(["a"]);
    expect(get).toHaveBeenCalledTimes(1);
  });
});
