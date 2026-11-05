import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useAuth } from "../../shared/auth/useAuth";
import { formatDateTime, phaseLabels } from "../common/messages";
import type { Course, CoursePhase, Semester } from "../common/types";
import { Badge, ErrorNote, Pager } from "../common/ui";
import { CourseForm } from "./CourseForm";
import { newCourse, settingsOf } from "./courseDraft";

const phases: CoursePhase[] = ["Setup", "Published", "Expired", "Finalized"];

export function CoursesPage() {
  const { api } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [semesterId, setSemesterId] = useState("");
  const [phase, setPhase] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);

  const semesters = useQuery({ queryKey: ["semesters", "all"], queryFn: () => api.get<Semester[]>("/api/v1/semesters", { pageSize: 100, sort: "-startDate" }) });
  const courses = useQuery({
    queryKey: ["courses", "admin", semesterId, phase, search, page],
    queryFn: () => api.get<Course[]>("/api/v1/courses", { semesterId, phase, search, page, pageSize: 20 }),
    placeholderData: keepPreviousData,
  });

  const create = useMutation({
    mutationFn: (draft: Parameters<typeof settingsOf>[0]) => api.post<Course>("/api/v1/courses", { semesterId: draft.semesterId, subjectId: draft.subjectId, ...settingsOf(draft) }),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["courses"] });
      navigate(`/admin/courses/${result.data.id}`);
    },
  });

  return (
    <div className="stack">
      <section className="card">
        <h1>Course</h1>
        <div className="toolbar">
          <select
            value={semesterId}
            onChange={(event) => {
              setSemesterId(event.target.value);
              setPage(1);
            }}
            aria-label="Học kỳ"
          >
            <option value="">Mọi học kỳ</option>
            {semesters.data?.data.map((semester) => (
              <option key={semester.id} value={semester.id}>
                {semester.code}
              </option>
            ))}
          </select>
          <select
            value={phase}
            onChange={(event) => {
              setPhase(event.target.value);
              setPage(1);
            }}
            aria-label="Giai đoạn"
          >
            <option value="">Mọi giai đoạn</option>
            {phases.map((item) => (
              <option key={item} value={item}>
                {phaseLabels[item]}
              </option>
            ))}
          </select>
          <input
            placeholder="Tìm theo lớp"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
          <button type="button" onClick={() => setCreating(!creating)}>
            {creating ? "Đóng" : "Tạo course"}
          </button>
        </div>
        {creating && (
          <>
            <CourseForm initial={newCourse} creating locked={false} busy={create.isPending} submitLabel="Tạo course" onSubmit={(draft) => create.mutate(draft)} />
            <ErrorNote error={create.error} />
          </>
        )}
        <ErrorNote error={courses.error} />
        <table>
          <thead>
            <tr>
              <th>Môn</th>
              <th>Lớp</th>
              <th>Học kỳ</th>
              <th>Giảng viên</th>
              <th>SV</th>
              <th>Phòng</th>
              <th>Giai đoạn</th>
              <th>Hạn</th>
            </tr>
          </thead>
          <tbody>
            {courses.data?.data.map((course) => (
              <tr key={course.id}>
                <td>
                  <Link to={`/admin/courses/${course.id}`}>
                    {course.subjectCode} – {course.subjectName}
                  </Link>
                </td>
                <td>{course.classCode}</td>
                <td>{course.semesterCode}</td>
                <td>{course.lecturerName ?? <span className="muted">—</span>}</td>
                <td>{course.studentCount}</td>
                <td>{course.roomCount}</td>
                <td>
                  <Badge tone={course.phase === "Published" ? "good" : "warn"}>{phaseLabels[course.phase]}</Badge>
                </td>
                <td>{formatDateTime(course.expireAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pager pagination={courses.data?.pagination} page={page} onPage={setPage} unit="course" />
      </section>
    </div>
  );
}
