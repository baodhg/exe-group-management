export interface ApiErrorItem {
  code: string;
  field: string | null;
  message: string;
}

export interface Pagination {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T | null;
  errors: ApiErrorItem[] | null;
  traceId: string | null;
  pagination?: Pagination;
}

export interface ApiResult<T> {
  data: T;
  message: string;
  traceId: string | null;
  pagination?: Pagination;
}

export interface ListParams {
  search?: string;
  sort?: string;
  page?: number;
  pageSize?: number;
  fields?: string;
  expand?: string;
  [filter: string]: string | number | boolean | undefined;
}
