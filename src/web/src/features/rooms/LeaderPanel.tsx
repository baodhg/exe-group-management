import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAuth } from "../../shared/auth/useAuth";
import { formatDateTime } from "../common/messages";
import type { JoinRequest, RoomDetail } from "../common/types";
import { ErrorNote } from "../common/ui";
import { decisionNote } from "./leader";

export function LeaderPanel({ room }: { room: RoomDetail }) {
  const { api } = useAuth();
  const queryClient = useQueryClient();
  const [topic, setTopic] = useState(room.topic ?? "");
  const [note, setNote] = useState<string | null>(null);

  const applications = useQuery({
    queryKey: ["joinRequests", "room", room.id],
    queryFn: () => api.get<JoinRequest[]>("/api/v1/join-requests", { roomId: room.id, status: "Pending", sort: "createdAt", pageSize: 100 }),
  });

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["room", room.id] }),
      queryClient.invalidateQueries({ queryKey: ["rooms", room.courseId] }),
      queryClient.invalidateQueries({ queryKey: ["joinRequests"] }),
    ]);

  const saveTopic = useMutation({
    mutationFn: () => api.put(`/api/v1/rooms/${room.id}`, { topic }),
    onSuccess: refresh,
  });
  const toggleLock = useMutation({
    mutationFn: () => api.post(`/api/v1/rooms/${room.id}/${room.status === "Locked" ? "unlock" : "lock"}`),
    onSuccess: refresh,
  });
  const decide = useMutation({
    mutationFn: ({ id, approve, reasonText }: { id: string; approve: boolean; reasonText?: string }) =>
      approve ? api.post<JoinRequest>(`/api/v1/join-requests/${id}/approve`) : api.post<JoinRequest>(`/api/v1/join-requests/${id}/reject`, { reasonText }),
    onSuccess: async (result) => {
      setNote(decisionNote(result.data));
      await refresh();
    },
  });

  const error = saveTopic.error ?? toggleLock.error ?? decide.error ?? applications.error;
  return (
    <section className="card">
      <h2>Quản lý phòng (trưởng phòng)</h2>
      <form
        className="inline-form"
        onSubmit={(event) => {
          event.preventDefault();
          saveTopic.mutate();
        }}
      >
        <input placeholder="Đề tài của nhóm" maxLength={200} value={topic} onChange={(event) => setTopic(event.target.value)} aria-label="Đề tài" />
        <button type="submit" disabled={saveTopic.isPending || topic === (room.topic ?? "")}>
          Lưu đề tài
        </button>
      </form>
      <p>
        {room.status === "Locked" ? "Phòng đang khóa: người khác phải gửi đơn. " : "Phòng đang mở: ai còn chỗ hợp lệ đều vào thẳng. "}
        <button type="button" disabled={toggleLock.isPending} onClick={() => toggleLock.mutate()}>
          {room.status === "Locked" ? "Mở khóa (hủy các đơn đang chờ)" : "Khóa phòng"}
        </button>
      </p>
      <ErrorNote error={error} />
      {note && <p className="notice">{note}</p>}

      <h3>Đơn xin vào đang chờ</h3>
      {applications.data?.data.length === 0 && <p className="muted">Không có đơn nào.</p>}
      {applications.data && applications.data.data.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Sinh viên</th>
              <th>Ngành</th>
              <th>Skill</th>
              <th>Lời nhắn</th>
              <th>Gửi lúc</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {applications.data.data.map((request) => (
              <tr key={request.id}>
                <td>
                  {request.studentCode} · {request.studentName}
                </td>
                <td>{request.majorCode ?? "—"}</td>
                <td>{request.skills.map((skill) => `${skill.skillCode} ${skill.level}`).join(", ") || <span className="muted">—</span>}</td>
                <td>{request.message ?? <span className="muted">—</span>}</td>
                <td>{formatDateTime(request.createdAt)}</td>
                <td className="actions">
                  <button type="button" disabled={decide.isPending} onClick={() => decide.mutate({ id: request.id, approve: true })}>
                    Duyệt
                  </button>
                  <button
                    type="button"
                    disabled={decide.isPending}
                    onClick={() => {
                      const reasonText = window.prompt("Lý do từ chối (không bắt buộc):");
                      if (reasonText !== null) {
                        decide.mutate({ id: request.id, approve: false, reasonText: reasonText.trim() || undefined });
                      }
                    }}
                  >
                    Từ chối
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

export function MemberActions({ room, studentId }: { room: RoomDetail; studentId: string }) {
  const { api } = useAuth();
  const queryClient = useQueryClient();
  const [removing, setRemoving] = useState(false);
  const [reason, setReason] = useState("");

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["room", room.id] }),
      queryClient.invalidateQueries({ queryKey: ["rooms", room.courseId] }),
    ]);
  const remove = useMutation({
    mutationFn: () => api.post(`/api/v1/rooms/${room.id}/members/${studentId}/remove`, { reason: reason.trim() }),
    onSuccess: refresh,
  });
  const handOver = useMutation({
    mutationFn: () => api.post(`/api/v1/rooms/${room.id}/leader`, { studentId }),
    onSuccess: refresh,
  });

  if (removing) {
    return (
      <form
        className="inline-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (window.confirm("Xóa thành viên này? Người bị xóa không vào lại phòng này được.")) {
            remove.mutate();
          }
        }}
      >
        <input required maxLength={300} placeholder="Lý do (bắt buộc)" value={reason} onChange={(event) => setReason(event.target.value)} aria-label="Lý do xóa" />
        <button type="submit" disabled={remove.isPending || reason.trim().length === 0}>
          Xác nhận xóa
        </button>
        <button type="button" onClick={() => setRemoving(false)}>
          Thôi
        </button>
        <ErrorNote error={remove.error} />
      </form>
    );
  }

  return (
    <span className="actions">
      <button type="button" onClick={() => setRemoving(true)}>
        Xóa
      </button>
      <button
        type="button"
        disabled={handOver.isPending}
        onClick={() => {
          if (window.confirm("Chuyển quyền trưởng phòng cho thành viên này?")) {
            handOver.mutate();
          }
        }}
      >
        Chuyển trưởng phòng
      </button>
      <ErrorNote error={handOver.error} />
    </span>
  );
}
