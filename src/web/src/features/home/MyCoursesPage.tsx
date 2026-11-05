import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { useAuth } from "../../shared/auth/useAuth";
import { formatDateTime, phaseLabels } from "../common/messages";
import type { Course } from "../common/types";
import { Badge, ErrorNote, Loading } from "../common/ui";

export function MyCoursesPage({ area }: { area: "student" | "lecturer" }) {
  const { api } = useAuth();
  const courses = useQuery({
    queryKey: ["courses", "mine"],
    queryFn: () => api.get<Course[]>("/api/v1/courses", { mine: true, pageSize: 100, sort: "-expireAt" }),
  });

  return (
    <section className="card">
      <h1>{area === "student" ? "Course của tôi" : "Course tôi dạy"}</h1>
      <Loading when={courses.isLoading} />
      <ErrorNote error={courses.error} />
      {courses.data && courses.data.data.length === 0 && <p className="muted">Bạn chưa có course nào.</p>}
      {courses.data && courses.data.data.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Môn</th>
              <th>Lớp</th>
              <th>Học kỳ</th>
              <th>Giai đoạn</th>
              <th>Hạn tìm nhóm</th>
              <th>Phòng</th>
            </tr>
          </thead>
          <tbody>
            {courses.data.data.map((course) => (
              <tr key={course.id}>
                <td>
                  <Link to={`/${area}/courses/${course.id}`}>
                    {course.subjectCode} – {course.subjectName}
                  </Link>
                </td>
                <td>{course.classCode}</td>
                <td>{course.semesterCode}</td>
                <td>
                  <Badge tone={course.phase === "Published" ? "good" : course.phase === "Finalized" ? "neutral" : "warn"}>{phaseLabels[course.phase]}</Badge>
                </td>
                <td>{formatDateTime(course.expireAt)}</td>
                <td>{course.roomCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
