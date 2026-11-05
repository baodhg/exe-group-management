import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAuth } from "../../shared/auth/useAuth";
import type { Semester } from "../common/types";
import { ErrorNote, Pager } from "../common/ui";

const empty = { code: "", name: "", startDate: "", endDate: "" };

export function SemestersPage() {
  const { api } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [draft, setDraft] = useState(empty);

  const semesters = useQuery({
    queryKey: ["semesters", search, page],
    queryFn: () => api.get<Semester[]>("/api/v1/semesters", { search, page, pageSize: 10, sort: "-startDate" }),
    placeholderData: keepPreviousData,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["semesters"] });

  const create = useMutation({
    mutationFn: () => api.post("/api/v1/semesters", { ...draft, code: draft.code.trim().toUpperCase(), name: draft.name.trim() }),
    onSuccess: async () => {
      setDraft(empty);
      await refresh();
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/semesters/${id}`),
    onSuccess: refresh,
  });

  return (
    <section className="card">
      <h1>Học kỳ</h1>
      <form
        className="inline-form"
        onSubmit={(event) => {
          event.preventDefault();
          create.mutate();
        }}
      >
        <input required placeholder="Mã (VD: FA26)" value={draft.code} onChange={(event) => setDraft({ ...draft, code: event.target.value })} aria-label="Mã học kỳ" />
        <input required placeholder="Tên (VD: Fall 2026)" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} aria-label="Tên học kỳ" />
        <label className="inline">
          Bắt đầu
          <input required type="date" value={draft.startDate} onChange={(event) => setDraft({ ...draft, startDate: event.target.value })} />
        </label>
        <label className="inline">
          Kết thúc
          <input required type="date" value={draft.endDate} onChange={(event) => setDraft({ ...draft, endDate: event.target.value })} />
        </label>
        <button type="submit" disabled={create.isPending}>
          Thêm
        </button>
      </form>
      <ErrorNote error={create.error ?? remove.error ?? semesters.error} />
      <div className="toolbar">
        <input
          placeholder="Tìm theo mã hoặc tên"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />
      </div>
      <table>
        <thead>
          <tr>
            <th>Mã</th>
            <th>Tên</th>
            <th>Bắt đầu</th>
            <th>Kết thúc</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {semesters.data?.data.map((semester) => (
            <tr key={semester.id}>
              <td>{semester.code}</td>
              <td>{semester.name}</td>
              <td>{semester.startDate}</td>
              <td>{semester.endDate}</td>
              <td>
                <button
                  type="button"
                  disabled={remove.isPending}
                  onClick={() => {
                    if (window.confirm(`Xóa học kỳ ${semester.code}?`)) {
                      remove.mutate(semester.id);
                    }
                  }}
                >
                  Xóa
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Pager pagination={semesters.data?.pagination} page={page} onPage={setPage} unit="học kỳ" />
    </section>
  );
}
