import type { ReactNode } from "react";
import type { Pagination } from "../../shared/api/types";
import { errorText } from "./messages";

export function ErrorNote({ error }: { error: unknown }) {
  if (!error) {
    return null;
  }

  return (
    <p className="error" role="alert">
      {errorText(error)}
    </p>
  );
}

export function Pager({ pagination, page, onPage, unit }: { pagination?: Pagination; page: number; onPage: (page: number) => void; unit: string }) {
  if (!pagination) {
    return null;
  }

  return (
    <div className="pager">
      <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Trước
      </button>
      <span>
        Trang {pagination.page}/{Math.max(pagination.totalPages, 1)} · {pagination.totalItems} {unit}
      </span>
      <button type="button" disabled={page >= pagination.totalPages} onClick={() => onPage(page + 1)}>
        Sau
      </button>
    </div>
  );
}

export function Badge({ tone = "neutral", children }: { tone?: "neutral" | "good" | "warn" | "bad"; children: ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function Loading({ when }: { when: boolean }) {
  return when ? <p className="muted">Đang tải…</p> : null;
}
