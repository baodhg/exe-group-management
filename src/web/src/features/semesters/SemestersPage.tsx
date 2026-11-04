import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ApiError } from "../../shared/api/apiClient";
import { useAuth } from "../../shared/auth/useAuth";

interface Semester {
  id: string;
  code: string;
  name: string;
  startDate: string;
  endDate: string;
}

export function SemestersPage() {
  const { api } = useAuth();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const semesters = useQuery({
    queryKey: ["semesters", search, page],
    queryFn: () => api.get<Semester[]>("/api/v1/semesters", { search, page, pageSize: 10, sort: "-startDate" }),
    placeholderData: keepPreviousData,
  });

  const pagination = semesters.data?.pagination;

  return (
    <section className="card">
      <h1>Học kỳ</h1>
      <input placeholder="Tìm theo mã hoặc tên" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
      {semesters.isError && (
        <p className="error" role="alert">
          {semesters.error instanceof ApiError ? `${semesters.error.message} (mã: ${semesters.error.code}, traceId: ${semesters.error.traceId})` : "Không tải được dữ liệu."}
        </p>
      )}
      <table>
        <thead>
          <tr>
            <th>Mã</th>
            <th>Tên</th>
            <th>Bắt đầu</th>
            <th>Kết thúc</th>
          </tr>
        </thead>
        <tbody>
          {semesters.data?.data.map((semester) => (
            <tr key={semester.id}>
              <td>{semester.code}</td>
              <td>{semester.name}</td>
              <td>{semester.startDate}</td>
              <td>{semester.endDate}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {pagination && (
        <div className="pager">
          <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Trước
          </button>
          <span>
            Trang {pagination.page}/{Math.max(pagination.totalPages, 1)} · {pagination.totalItems} học kỳ
          </span>
          <button type="button" disabled={page >= pagination.totalPages} onClick={() => setPage(page + 1)}>
            Sau
          </button>
        </div>
      )}
    </section>
  );
}
