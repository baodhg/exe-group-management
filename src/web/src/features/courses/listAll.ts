import type { ApiClient } from "../../shared/api/apiClient";
import type { ListParams } from "../../shared/api/types";

const maxPageSize = 100;

export async function listAll<T>(api: Pick<ApiClient, "get">, path: string, params: ListParams = {}): Promise<T[]> {
  const items: T[] = [];
  let page = 1;
  let pages = 1;
  while (page <= pages) {
    const result = await api.get<T[]>(path, { ...params, page, pageSize: maxPageSize });
    items.push(...result.data);
    pages = result.pagination?.totalPages ?? 1;
    page++;
  }

  return items;
}
