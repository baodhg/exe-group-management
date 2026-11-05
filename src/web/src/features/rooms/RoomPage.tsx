import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams } from "react-router";
import { useAuth } from "../../shared/auth/useAuth";
import { phaseLabels, roomStatusLabels } from "../common/messages";
import type { Course, JoinRequest, RoomDetail, RoomSummary } from "../common/types";
import { Badge, ErrorNote, Loading } from "../common/ui";
import { studentActionFor } from "./roomActions";

export function RoomPage() {
  const { roomId = "" } = useParams();
  const { api, user, hasRole } = useAuth();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const isStudent = hasRole("Student");

  const room = useQuery({ queryKey: ["room", roomId], queryFn: () => api.get<RoomDetail>(`/api/v1/rooms/${roomId}`) });
  const courseId = room.data?.data.courseId;
  const course = useQuery({
    queryKey: ["course", courseId],
    queryFn: () => api.get<Course>(`/api/v1/courses/${courseId}`),
    enabled: courseId !== undefined,
  });
  const myRoom = useQuery({
    queryKey: ["rooms", courseId, "mine"],
    queryFn: () => api.get<RoomSummary[]>(`/api/v1/courses/${courseId}/rooms`, { mine: true }),
    enabled: isStudent && courseId !== undefined,
  });
  const pending = useQuery({
    queryKey: ["joinRequests", "mine", "room", roomId],
    queryFn: () => api.get<JoinRequest[]>("/api/v1/join-requests", { roomId, status: "Pending" }),
    enabled: isStudent,
  });

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["room", roomId] }),
      queryClient.invalidateQueries({ queryKey: ["rooms", courseId] }),
      queryClient.invalidateQueries({ queryKey: ["joinRequests"] }),
      queryClient.invalidateQueries({ queryKey: ["suggestions", courseId] }),
    ]);

  const act = useMutation({
    mutationFn: (action: "join" | "leave" | "apply") =>
      action === "apply"
        ? api.post("/api/v1/join-requests", { roomId, message: message.trim() || undefined })
        : api.post(`/api/v1/rooms/${roomId}/${action}`),
    onSuccess: async () => {
      setMessage("");
      await refresh();
    },
  });

  if (room.isLoading) {
    return <Loading when />;
  }

  if (!room.data) {
    return <ErrorNote error={room.error} />;
  }

  const detail = room.data.data;
  const phase = course.data?.data.phase;
  const myPending = (pending.data?.data ?? []).filter((request) => request.studentId === user?.userId);
  const action =
    isStudent && phase && myRoom.isSuccess
      ? studentActionFor({ phase, room: detail, myRoomId: myRoom.data.data[0]?.id ?? null, hasPendingApplication: myPending.length > 0 })
      : "none";
  const back = hasRole("Administrator") ? `/admin/courses/${detail.courseId}` : hasRole("Lecturer") ? `/lecturer/courses/${detail.courseId}` : `/student/courses/${detail.courseId}`;

  return (
    <div className="stack">
      <section className="card">
        <p className="muted">
          <Link to={back}>{course.data ? `${course.data.data.subjectCode} ${course.data.data.classCode}` : "Course"}</Link> / {detail.name}
        </p>
        <h1>
          {detail.groupNo !== null && `Nhóm ${detail.groupNo} · `}
          {detail.name}
        </h1>
        <p>
          <Badge tone={detail.status === "Open" ? "good" : detail.status === "Locked" ? "warn" : "neutral"}>{roomStatusLabels[detail.status]}</Badge>{" "}
          {detail.memberCount}/{detail.capacity} người · Loại nhóm {detail.groupTypeName} ({detail.groupTypeCode}) ·{" "}
          {detail.eligible ? <Badge tone="good">Đủ điều kiện</Badge> : <Badge tone="bad">Chưa đủ điều kiện</Badge>}
          {phase && <span className="muted"> · Course: {phaseLabels[phase]}</span>}
        </p>
        <p>Đề tài: {detail.topic ?? <span className="muted">chưa có</span>}</p>
        <p className="muted">
          Cần tối thiểu {detail.minGroupSize} người và {detail.minDistinctMajors} ngành khác nhau.
        </p>

        {action === "join" && (
          <button type="button" disabled={act.isPending} onClick={() => act.mutate("join")}>
            Vào phòng
          </button>
        )}
        {action === "apply" && (
          <form
            className="inline-form"
            onSubmit={(event) => {
              event.preventDefault();
              act.mutate("apply");
            }}
          >
            <input placeholder="Lời nhắn cho trưởng phòng (không bắt buộc)" maxLength={500} value={message} onChange={(event) => setMessage(event.target.value)} />
            <button type="submit" disabled={act.isPending}>
              Gửi đơn xin vào
            </button>
          </form>
        )}
        {action === "leave" && (
          <button
            type="button"
            disabled={act.isPending}
            onClick={() => {
              if (window.confirm("Rời phòng này?")) {
                act.mutate("leave");
              }
            }}
          >
            Rời phòng
          </button>
        )}
        {myPending.length > 0 && <p className="muted">Bạn đã gửi đơn vào phòng này, đang chờ trưởng phòng duyệt.</p>}
        <ErrorNote error={act.error} />
      </section>

      <section className="card">
        <h2>Ngành</h2>
        <table>
          <thead>
            <tr>
              <th>Ngành</th>
              <th>Đang có</th>
              <th>Yêu cầu tối thiểu</th>
            </tr>
          </thead>
          <tbody>
            {detail.majors.map((major) => (
              <tr key={major.majorId}>
                <td>{major.majorCode}</td>
                <td>{major.members}</td>
                <td>{major.required > 0 ? major.required : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card">
        <h2>Thành viên</h2>
        {detail.members.length === 0 && <p className="muted">Phòng chưa có ai.</p>}
        <table>
          <thead>
            <tr>
              <th>MSSV</th>
              <th>Họ tên</th>
              <th>Ngành</th>
              <th>Skill</th>
            </tr>
          </thead>
          <tbody>
            {detail.members.map((member) => (
              <tr key={member.studentId}>
                <td>{member.studentCode}</td>
                <td>
                  {member.fullName} {member.isLeader && <Badge tone="good">Trưởng phòng</Badge>}
                </td>
                <td>{member.majorCode}</td>
                <td>{member.skills.map((skill) => `${skill.skillCode} ${skill.level}`).join(", ") || <span className="muted">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
