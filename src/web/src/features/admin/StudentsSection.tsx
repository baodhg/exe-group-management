import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ApiError } from "../../shared/api/apiClient";
import { useAuth } from "../../shared/auth/useAuth";
import type { CatalogItem, Course, RosterEntry } from "../common/types";
import { ErrorNote, Pager } from "../common/ui";
import { importStudents, parseStudentCsv, type ImportSummary } from "./studentImport";

export function StudentsSection({ course }: { course: Course }) {
  const { api } = useAuth();
  const queryClient = useQueryClient();
  const [csv, setCsv] = useState("");
  const [password, setPassword] = useState("");
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [hasRoom, setHasRoom] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const parsed = csv.trim() ? parseStudentCsv(csv) : null;
  const editable = course.phase !== "Finalized";

  const roster = useQuery({
    queryKey: ["roster", course.id, hasRoom, search, page],
    queryFn: () => api.get<RosterEntry[]>(`/api/v1/courses/${course.id}/students`, { hasRoom: hasRoom || undefined, search, page, pageSize: 20 }),
    placeholderData: keepPreviousData,
  });
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["roster", course.id] }),
      queryClient.invalidateQueries({ queryKey: ["course", course.id] }),
      queryClient.invalidateQueries({ queryKey: ["overview", course.id] }),
    ]);

  const runImport = useMutation({
    mutationFn: async () => {
      const majors = await api.get<CatalogItem[]>("/api/v1/majors", { pageSize: 100 });
      return importStudents(api, { semesterId: course.semesterId, courseId: course.id, rows: parsed?.rows ?? [], majors: majors.data, defaultPassword: password });
    },
    onSuccess: async (result) => {
      setSummary(result);
      setCsv("");
      await refresh();
    },
  });
  const remove = useMutation({
    mutationFn: (studentId: string) => api.delete(`/api/v1/courses/${course.id}/students/${studentId}`),
    onSuccess: refresh,
  });

  return (
    <section className="card">
      <h2>Sinh viên ({course.studentCount})</h2>
      {editable && (
        <details>
          <summary>Import danh sách lớp (CSV)</summary>
          <p className="muted">
            Cột: <code>email,fullName,userCode,majorCode</code>. Mỗi dòng tạo (hoặc dùng lại) tài khoản sinh viên, thêm vào học kỳ {course.semesterCode} với ngành
            đó rồi ghi danh vào course.
          </p>
          <input
            type="file"
            accept=".csv,text/csv"
            aria-label="Tệp CSV"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (file) {
                setCsv(await file.text());
              }
            }}
          />
          <textarea rows={6} placeholder={"email,fullName,userCode,majorCode\nan@fpt.edu.vn,Nguyen Van An,SE180001,SE"} value={csv} onChange={(event) => setCsv(event.target.value)} />
          {parsed && (
            <p>
              {parsed.rows.length} sinh viên hợp lệ
              {parsed.problems.length > 0 && <span className="error"> · {parsed.problems.join(" ")}</span>}
            </p>
          )}
          <div className="inline-form">
            <input
              type="password"
              autoComplete="new-password"
              placeholder="Mật khẩu mặc định cho tài khoản mới"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-label="Mật khẩu mặc định"
            />
            <button type="button" disabled={!parsed || parsed.rows.length === 0 || password.length === 0 || runImport.isPending} onClick={() => runImport.mutate()}>
              {runImport.isPending ? "Đang import…" : "Import"}
            </button>
          </div>
          {runImport.error && !(runImport.error instanceof ApiError) ? <p className="error">{runImport.error.message}</p> : <ErrorNote error={runImport.error} />}
          {summary && (
            <p className="notice">
              Tài khoản mới {summary.accountsCreated}, đã có {summary.accountsExisting} · Thêm vào học kỳ {summary.addedToSemester}, cập nhật {summary.updatedInSemester} · Ghi
              danh {summary.enrolled}, đã ghi danh trước {summary.alreadyEnrolled}.
            </p>
          )}
        </details>
      )}
      <div className="toolbar">
        <input
          placeholder="Tìm theo MSSV, tên hoặc email"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />
        <select
          value={hasRoom}
          onChange={(event) => {
            setHasRoom(event.target.value);
            setPage(1);
          }}
          aria-label="Lọc theo phòng"
        >
          <option value="">Tất cả</option>
          <option value="true">Đã có phòng</option>
          <option value="false">Chưa có phòng</option>
        </select>
      </div>
      <ErrorNote error={roster.error ?? remove.error} />
      <table>
        <thead>
          <tr>
            <th>MSSV</th>
            <th>Họ tên</th>
            <th>Email</th>
            <th>Ngành</th>
            <th>Phòng</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {roster.data?.data.map((student) => (
            <tr key={student.studentId}>
              <td>{student.studentCode}</td>
              <td>{student.fullName}</td>
              <td>{student.email}</td>
              <td>{student.majorCode}</td>
              <td>{student.roomName ?? <span className="muted">—</span>}</td>
              <td>
                {editable && student.roomId === null && (
                  <button
                    type="button"
                    disabled={remove.isPending}
                    onClick={() => {
                      if (window.confirm(`Gỡ ${student.studentCode} khỏi course?`)) {
                        remove.mutate(student.studentId);
                      }
                    }}
                  >
                    Gỡ
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Pager pagination={roster.data?.pagination} page={page} onPage={setPage} unit="sinh viên" />
    </section>
  );
}
