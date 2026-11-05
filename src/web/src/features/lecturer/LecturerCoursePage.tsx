import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router";
import { useAuth } from "../../shared/auth/useAuth";
import { formatDateTime, phaseLabels } from "../common/messages";
import type { Course } from "../common/types";
import { Badge, ErrorNote, Loading } from "../common/ui";
import { OverviewPanel } from "../courses/OverviewPanel";
import { RoomBoard } from "../rooms/RoomBoard";

export function LecturerCoursePage() {
  const { courseId = "" } = useParams();
  const { api } = useAuth();
  const course = useQuery({ queryKey: ["course", courseId], queryFn: () => api.get<Course>(`/api/v1/courses/${courseId}`) });

  if (course.isLoading) {
    return <Loading when />;
  }

  if (!course.data) {
    return <ErrorNote error={course.error} />;
  }

  const current = course.data.data;
  const finalized = current.phase === "Finalized";
  return (
    <div className="stack">
      <section className="card">
        <p className="muted">
          <Link to="/lecturer">Course tôi dạy</Link> / {current.subjectCode} {current.classCode}
        </p>
        <h1>
          {current.subjectCode} – {current.subjectName} · {current.classCode}
        </h1>
        <p>
          <Badge tone={current.phase === "Published" ? "good" : "warn"}>{phaseLabels[current.phase]}</Badge> {current.studentCount} sinh viên · {current.roomCount}{" "}
          phòng · Hạn tìm nhóm {formatDateTime(current.expireAt)}
          {finalized && <> · Chốt nhóm lúc {formatDateTime(current.finalizedAt)}</>}
        </p>
        <p className="muted">Trang chỉ để xem: việc chia nhóm do sinh viên và quản trị viên thực hiện.</p>
      </section>

      <section className="card">
        <h2>Tiến độ chia nhóm</h2>
        <OverviewPanel courseId={courseId} />
      </section>

      <section className="card">
        <h2>{finalized ? "Danh sách nhóm chính thức" : "Bảng phòng"}</h2>
        <RoomBoard courseId={courseId} finalized={finalized} />
      </section>
    </div>
  );
}
