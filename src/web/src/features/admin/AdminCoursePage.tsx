import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams } from "react-router";
import { useAuth } from "../../shared/auth/useAuth";
import { formatDateTime, phaseLabels } from "../common/messages";
import type { Course, GroupType, RoomSummary } from "../common/types";
import { Badge, ErrorNote, Loading } from "../common/ui";
import { OverviewPanel } from "../courses/OverviewPanel";
import { RoomBoard } from "../rooms/RoomBoard";
import { FinalizeSection, PlacementSection } from "./CompletionSection";
import { CourseForm } from "./CourseForm";
import { draftOf, expectedRooms, settingsOf } from "./courseDraft";
import { StudentsSection } from "./StudentsSection";

export function AdminCoursePage() {
  const { courseId = "" } = useParams();
  const { api } = useAuth();
  const queryClient = useQueryClient();
  const course = useQuery({ queryKey: ["course", courseId], queryFn: () => api.get<Course>(`/api/v1/courses/${courseId}`) });
  const refresh = () =>
    Promise.all([["course", courseId], ["courses"], ["overview", courseId], ["rooms", courseId]].map((queryKey) => queryClient.invalidateQueries({ queryKey })));

  const changePhase = useMutation({
    mutationFn: (action: "publish" | "expire") => api.post<Course>(`/api/v1/courses/${courseId}/${action}`),
    onSuccess: refresh,
  });
  const update = useMutation({
    mutationFn: (draft: Parameters<typeof settingsOf>[0]) => api.put<Course>(`/api/v1/courses/${courseId}`, settingsOf(draft)),
    onSuccess: refresh,
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
          <Link to="/admin/courses">Course</Link> / {current.subjectCode} {current.classCode}
        </p>
        <h1>
          {current.subjectCode} – {current.subjectName} · {current.classCode} ({current.semesterCode})
        </h1>
        <p>
          <Badge tone={current.phase === "Published" ? "good" : "warn"}>{phaseLabels[current.phase]}</Badge> {current.studentCount} sinh viên · {current.roomCount} phòng ·
          Publish {formatDateTime(current.publishAt)} · Hạn {formatDateTime(current.expireAt)}
        </p>
        <div className="actions">
          {current.phase === "Setup" && (
            <button
              type="button"
              disabled={changePhase.isPending}
              onClick={() => {
                if (window.confirm("Publish ngay? Sinh viên sẽ bắt đầu vào phòng.")) {
                  changePhase.mutate("publish");
                }
              }}
            >
              Publish ngay
            </button>
          )}
          {current.phase === "Published" && (
            <button
              type="button"
              disabled={changePhase.isPending}
              onClick={() => {
                if (window.confirm("Kết thúc tìm nhóm ngay? Các đơn đang chờ sẽ bị từ chối.")) {
                  changePhase.mutate("expire");
                }
              }}
            >
              Kết thúc tìm nhóm ngay
            </button>
          )}
        </div>
        <ErrorNote error={changePhase.error} />
      </section>

      {current.phase !== "Finalized" && (
        <section className="card">
          <h2>Cài đặt</h2>
          <CourseForm
            key={`${current.id}-${current.phase}`}
            initial={draftOf(current)}
            creating={false}
            locked={current.phase !== "Setup"}
            busy={update.isPending}
            submitLabel="Lưu cài đặt"
            onSubmit={(draft) => update.mutate(draft)}
          />
          <ErrorNote error={update.error} />
          {update.isSuccess && <p className="muted">Đã lưu.</p>}
        </section>
      )}

      <StudentsSection course={current} />

      {current.phase === "Setup" && <GenerateRooms course={current} />}

      {(current.phase === "Expired" || current.phase === "Finalized" || current.phase === "Published") && (
        <section className="card">
          <h2>Tiến độ chia nhóm</h2>
          <OverviewPanel courseId={courseId} />
        </section>
      )}

      {current.phase === "Expired" && (
        <>
          <PlacementSection course={current} />
          <FinalizeSection course={current} />
        </>
      )}

      <section className="card">
        <h2>{current.phase === "Finalized" ? "Danh sách nhóm chính thức" : "Phòng"}</h2>
        <RoomBoard courseId={courseId} finalized={current.phase === "Finalized"} />
      </section>
    </div>
  );
}

function GenerateRooms({ course }: { course: Course }) {
  const { api } = useAuth();
  const queryClient = useQueryClient();
  const [groupTypeId, setGroupTypeId] = useState("");
  const allowed = useQuery({
    queryKey: ["semesterGroupTypes", course.semesterId],
    queryFn: () => api.get<GroupType[]>(`/api/v1/semesters/${course.semesterId}/group-types`),
  });
  const generate = useMutation({
    mutationFn: () => api.post<{ target: number; created: number; rooms: RoomSummary[] }>(`/api/v1/courses/${course.id}/rooms/generate`, { groupTypeId }),
    onSuccess: () => Promise.all([["course", course.id], ["rooms", course.id]].map((queryKey) => queryClient.invalidateQueries({ queryKey }))),
  });

  return (
    <section className="card">
      <h2>Sinh phòng</h2>
      <p className="muted">
        Số phòng = ⌈{course.studentCount} SV × {course.roomFactor} / {course.maxGroupSize}⌉ = {expectedRooms(course.studentCount, course.maxGroupSize, course.roomFactor)} phòng,
        mỗi phòng {course.maxGroupSize} chỗ. Chạy lại chỉ tạo thêm phần còn thiếu.
      </p>
      {allowed.data?.data.length === 0 && <p className="error">Học kỳ chưa cho phép loại nhóm nào: hãy chọn ở trang Loại nhóm.</p>}
      <div className="inline-form">
        <select value={groupTypeId} onChange={(event) => setGroupTypeId(event.target.value)} aria-label="Loại nhóm">
          <option value="">Chọn loại nhóm…</option>
          {allowed.data?.data.map((groupType) => (
            <option key={groupType.id} value={groupType.id}>
              {groupType.code} – {groupType.name}
            </option>
          ))}
        </select>
        <button type="button" disabled={groupTypeId === "" || generate.isPending} onClick={() => generate.mutate()}>
          Sinh phòng
        </button>
      </div>
      <ErrorNote error={generate.error ?? allowed.error} />
      {generate.data && (
        <p className="notice">
          Cần {generate.data.data.target} phòng, vừa tạo {generate.data.data.created}.
        </p>
      )}
    </section>
  );
}
