import { useQuery } from "@tanstack/react-query";
import { BookOpen } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "../../shared/auth/useAuth";
import type { Course } from "../common/types";
import { EmptyState, ErrorNote, PageHeader } from "../common/ui";
import { CourseCard } from "../courses/CourseCard";

function CourseGrid({ title, courses, area }: { title: string; courses: Course[]; area: "student" | "lecturer" }) {
  if (courses.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold text-muted-foreground">{title}</h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {courses.map((course) => (
          <CourseCard key={course.id} course={course} to={`/${area}/courses/${course.id}`} />
        ))}
      </div>
    </section>
  );
}

export function MyCoursesPage({ area }: { area: "student" | "lecturer" }) {
  const { api, user } = useAuth();
  const courses = useQuery({
    queryKey: ["courses", "mine"],
    queryFn: () => api.get<Course[]>("/api/v1/courses", { mine: true, pageSize: 100, sort: "-expireAt" }),
  });
  const all = courses.data?.data ?? [];
  const active = all.filter((course) => course.phase !== "Finalized");
  const done = all.filter((course) => course.phase === "Finalized");
  const firstName = user?.name?.trim().split(/\s+/).at(-1);

  return (
    <div className="space-y-8">
      <PageHeader
        title={firstName ? `Chào ${firstName}` : area === "student" ? "Course của tôi" : "Course giảng dạy"}
        description={
          area === "student"
            ? "Chọn một course để tìm phòng, xem gợi ý và theo dõi đơn xin vào phòng."
            : "Theo dõi tiến độ lập nhóm của các lớp bạn phụ trách."
        }
      />
      <ErrorNote error={courses.error} />
      {courses.isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-56 rounded-xl" />
          ))}
        </div>
      )}
      {courses.isSuccess && all.length === 0 && (
        <EmptyState
          icon={BookOpen}
          title="Bạn chưa có course nào"
          description={area === "student" ? "Khi phòng đào tạo thêm bạn vào lớp, course sẽ hiện ở đây." : "Khi bạn được phân công dạy, course sẽ hiện ở đây."}
        />
      )}
      <CourseGrid title="Đang diễn ra" courses={active} area={area} />
      <CourseGrid title="Đã chốt nhóm" courses={done} area={area} />
    </div>
  );
}
