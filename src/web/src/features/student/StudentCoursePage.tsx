import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router";
import { useAuth } from "../../shared/auth/useAuth";
import { formatDateTime, phaseLabels, requestReasonText, requestStatusLabels, suggestionReasonText } from "../common/messages";
import type { Course, JoinRequest, RoomSuggestions, RoomSummary } from "../common/types";
import { Badge, ErrorNote, Loading } from "../common/ui";
import { RoomBoard } from "../rooms/RoomBoard";

export function StudentCoursePage() {
  const { courseId = "" } = useParams();
  const { api } = useAuth();
  const queryClient = useQueryClient();

  const course = useQuery({ queryKey: ["course", courseId], queryFn: () => api.get<Course>(`/api/v1/courses/${courseId}`) });
  const myRoom = useQuery({
    queryKey: ["rooms", courseId, "mine"],
    queryFn: () => api.get<RoomSummary[]>(`/api/v1/courses/${courseId}/rooms`, { mine: true }),
  });
  const phase = course.data?.data.phase;
  const mine = myRoom.data?.data[0] ?? null;

  const suggestions = useQuery({
    queryKey: ["suggestions", courseId],
    queryFn: () => api.get<RoomSuggestions>(`/api/v1/courses/${courseId}/rooms/suggestions`, { top: 3 }),
    enabled: phase === "Published" && myRoom.isSuccess && mine === null,
  });
  const applications = useQuery({
    queryKey: ["joinRequests", "mine", courseId],
    queryFn: () => api.get<JoinRequest[]>("/api/v1/join-requests", { courseId, pageSize: 50 }),
  });

  const withdraw = useMutation({
    mutationFn: (requestId: string) => api.post<JoinRequest>(`/api/v1/join-requests/${requestId}/withdraw`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["joinRequests"] }),
  });

  if (course.isLoading) {
    return <Loading when />;
  }

  if (!course.data) {
    return <ErrorNote error={course.error} />;
  }

  const current = course.data.data;
  return (
    <div className="stack">
      <section className="card">
        <p className="muted">
          <Link to="/student">Course của tôi</Link> / {current.subjectCode} {current.classCode}
        </p>
        <h1>
          {current.subjectCode} – {current.subjectName} · {current.classCode}
        </h1>
        <p>
          <Badge tone={current.phase === "Published" ? "good" : "warn"}>{phaseLabels[current.phase]}</Badge> Hạn tìm nhóm: {formatDateTime(current.expireAt)} · Nhóm{" "}
          {current.minGroupSize}–{current.maxGroupSize} người · <Link to={`/student/semesters/${current.semesterId}/skills`}>Skill của tôi</Link>
        </p>
        {mine ? (
          <p>
            Phòng của tôi: <Link to={`/rooms/${mine.id}`}>{mine.name}</Link> ({mine.memberCount}/{mine.capacity} người)
          </p>
        ) : (
          myRoom.isSuccess && <p className="muted">Bạn chưa có phòng.</p>
        )}
      </section>

      {phase === "Published" && mine === null && (
        <section className="card">
          <h2>Phòng gợi ý</h2>
          <Loading when={suggestions.isLoading} />
          <ErrorNote error={suggestions.error} />
          {suggestions.data && !suggestions.data.data.ranked && (
            <p className="muted">Chưa xếp hạng được lúc này; đây là các phòng bạn vào được.</p>
          )}
          {suggestions.data?.data.rooms.length === 0 && <p className="muted">Không còn phòng nào bạn vào được.</p>}
          <ul className="suggestions">
            {suggestions.data?.data.rooms.map((item) => (
              <li key={item.room.id}>
                <Link to={`/rooms/${item.room.id}`}>{item.room.name}</Link> · {item.room.memberCount}/{item.room.capacity} người
                {item.score !== null && <span className="muted"> · điểm {item.score}</span>}
                {item.reasons.length > 0 && (
                  <ul>
                    {item.reasons.map((reason) => (
                      <li key={`${reason.code}-${reason.detail}`}>{suggestionReasonText(reason.code, reason.detail)}</li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {applications.data && applications.data.data.length > 0 && (
        <section className="card">
          <h2>Đơn xin vào phòng của tôi</h2>
          <ErrorNote error={withdraw.error ?? applications.error} />
          <table>
            <thead>
              <tr>
                <th>Phòng</th>
                <th>Gửi lúc</th>
                <th>Trạng thái</th>
                <th>Lý do</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {applications.data.data.map((request) => (
                <tr key={request.id}>
                  <td>
                    <Link to={`/rooms/${request.roomId}`}>{request.roomName}</Link>
                  </td>
                  <td>{formatDateTime(request.createdAt)}</td>
                  <td>{requestStatusLabels[request.status]}</td>
                  <td>
                    {requestReasonText(request.reasonCode)}
                    {request.reasonText && <span className="muted"> – {request.reasonText}</span>}
                  </td>
                  <td>
                    {request.status === "Pending" && (
                      <button type="button" disabled={withdraw.isPending} onClick={() => withdraw.mutate(request.id)}>
                        Rút đơn
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="card">
        <h2>{current.phase === "Finalized" ? "Danh sách nhóm chính thức" : "Bảng phòng"}</h2>
        <RoomBoard courseId={courseId} finalized={current.phase === "Finalized"} myRoomId={mine?.id ?? null} />
      </section>
    </div>
  );
}
