import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAuth } from "../../shared/auth/useAuth";
import { formatDateTime } from "../common/messages";
import type { User } from "../common/types";
import { Badge, ErrorNote, Pager } from "../common/ui";

const roles = ["Student", "Lecturer", "Administrator"] as const;
const roleLabels: Record<string, string> = { Student: "Sinh viên", Lecturer: "Giảng viên", Administrator: "Quản trị" };
const empty = { email: "", fullName: "", userCode: "", password: "", role: "Lecturer" as string };

export function UsersPage() {
  const { api } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [page, setPage] = useState(1);
  const [draft, setDraft] = useState(empty);

  const users = useQuery({
    queryKey: ["users", search, role, page],
    queryFn: () => api.get<User[]>("/api/v1/users", { search, role, page, pageSize: 20 }),
    placeholderData: keepPreviousData,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["users"] });

  const create = useMutation({
    mutationFn: () =>
      api.post("/api/v1/users", {
        email: draft.email.trim(),
        fullName: draft.fullName.trim(),
        userCode: draft.userCode.trim() || undefined,
        password: draft.password,
        roles: [draft.role],
      }),
    onSuccess: async () => {
      setDraft(empty);
      await refresh();
    },
  });
  const setStatus = useMutation({
    mutationFn: (user: User) =>
      api.put(`/api/v1/users/${user.id}`, { fullName: user.fullName, userCode: user.userCode, roles: user.roles, status: user.status === "Active" ? "Locked" : "Active" }),
    onSuccess: refresh,
  });

  return (
    <section className="card">
      <h1>Tài khoản</h1>
      <p className="muted">Sinh viên thường được tạo khi import danh sách lớp ở trang course. Ở đây tạo giảng viên và quản trị viên.</p>
      <form
        className="inline-form"
        onSubmit={(event) => {
          event.preventDefault();
          create.mutate();
        }}
      >
        <input required type="email" placeholder="Email" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} aria-label="Email" />
        <input required placeholder="Họ tên" value={draft.fullName} onChange={(event) => setDraft({ ...draft, fullName: event.target.value })} aria-label="Họ tên" />
        <input placeholder="Mã (không bắt buộc)" value={draft.userCode} onChange={(event) => setDraft({ ...draft, userCode: event.target.value })} aria-label="Mã" />
        <input required type="password" placeholder="Mật khẩu" autoComplete="new-password" value={draft.password} onChange={(event) => setDraft({ ...draft, password: event.target.value })} aria-label="Mật khẩu" />
        <select value={draft.role} onChange={(event) => setDraft({ ...draft, role: event.target.value })} aria-label="Vai trò">
          {roles.map((option) => (
            <option key={option} value={option}>
              {roleLabels[option]}
            </option>
          ))}
        </select>
        <button type="submit" disabled={create.isPending}>
          Tạo tài khoản
        </button>
      </form>
      <ErrorNote error={create.error ?? setStatus.error ?? users.error} />
      <div className="toolbar">
        <input
          placeholder="Tìm theo email, tên hoặc mã"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />
        <select
          value={role}
          onChange={(event) => {
            setRole(event.target.value);
            setPage(1);
          }}
          aria-label="Lọc vai trò"
        >
          <option value="">Mọi vai trò</option>
          {roles.map((option) => (
            <option key={option} value={option}>
              {roleLabels[option]}
            </option>
          ))}
        </select>
      </div>
      <table>
        <thead>
          <tr>
            <th>Email</th>
            <th>Họ tên</th>
            <th>Mã</th>
            <th>Vai trò</th>
            <th>Trạng thái</th>
            <th>Tạo lúc</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {users.data?.data.map((user) => (
            <tr key={user.id}>
              <td>{user.email}</td>
              <td>{user.fullName}</td>
              <td>{user.userCode ?? "—"}</td>
              <td>{user.roles.map((item) => roleLabels[item] ?? item).join(", ")}</td>
              <td>
                <Badge tone={user.status === "Active" ? "good" : "bad"}>{user.status === "Active" ? "Hoạt động" : "Đã khóa"}</Badge>
              </td>
              <td>{formatDateTime(user.createdAt)}</td>
              <td>
                <button type="button" disabled={setStatus.isPending} onClick={() => setStatus.mutate(user)}>
                  {user.status === "Active" ? "Khóa" : "Mở khóa"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Pager pagination={users.data?.pagination} page={page} onPage={setPage} unit="tài khoản" />
    </section>
  );
}
