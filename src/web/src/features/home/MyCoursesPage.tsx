import { useQuery } from "@tanstack/react-query";
import { Award, Clock, GraduationCap, Star, type LucideIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "../../shared/auth/useAuth";
import type { Course } from "../common/types";
import { EmptyState, Failure, LinkButton, PageHeader, Section } from "../common/ui";
import { CourseCard } from "../courses/CourseCard";
import { PageDenied } from "../student/courseParts";
import { deniedStatus } from "../student/studentCourse";

function CourseGrid({ title, icon: Icon, courses, area }: { title: string; icon: LucideIcon; courses: Course[]; area: "student" | "lecturer" }) {
  if (courses.length === 0) {
    return null;
  }

  return (
    <section className="flex flex-col gap-3.5" aria-label={title}>
      <h2 className="flex items-center gap-2 text-lg font-extrabold tracking-[-0.015em]">
        <Icon className="size-5 shrink-0" aria-hidden />
        {title}
      </h2>
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
  const home = `/${area}`;
  const denied = deniedStatus(courses.error);

  if (denied && !courses.data) {
    return denied === 403 ? (
      <PageDenied status={403} title="Bạn không có quyền mở lớp này" text="Chỉ sinh viên trong danh sách lớp, giảng viên của lớp và giáo vụ mới mở được lớp." backTo={home} />
    ) : (
      <PageDenied status={404} title="Không tìm thấy lớp" text="Không tìm thấy dữ liệu. Đường dẫn có thể đã cũ." backTo={home} />
    );
  }

  const all = courses.data?.data ?? [];
  const active = all.filter((course) => course.phase !== "Finalized");
  const done = all.filter((course) => course.phase === "Finalized");
  const firstName = user?.name?.trim().split(/\s+/).at(-1);
  const skillCourse = area === "student" ? (active[0] ?? done[0]) : undefined;

  return (
    <div className="space-y-4">
      <PageHeader
        title={firstName ? `Chào ${firstName}` : area === "student" ? "Lớp của tôi" : "Lớp giảng dạy"}
        description={area === "student" ? "Chọn một lớp để tìm phòng, xem gợi ý và theo dõi đơn xin vào phòng." : "Theo dõi tiến độ lập nhóm của các lớp bạn phụ trách."}
        actions={
          skillCourse && (
            <LinkButton variant="outline" to={`/student/semesters/${skillCourse.semesterId}/skills`}>
              <Star aria-hidden />
              Kỹ năng học kỳ {skillCourse.semesterCode}
            </LinkButton>
          )
        }
      />
      {courses.isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="Đang tải danh sách lớp">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-56 rounded-xl" />
          ))}
        </div>
      )}
      {courses.isError && !courses.data && (
        <Section>
          <Failure error={courses.error} title="Không tải được danh sách lớp" onRetry={() => void courses.refetch()} />
        </Section>
      )}
      {courses.isSuccess && all.length === 0 && (
        <Section>
          <EmptyState icon={GraduationCap} title="Bạn chưa có lớp nào" description={area === "student" ? "Khi giáo vụ thêm bạn vào lớp, lớp sẽ hiện ở đây." : "Khi bạn được phân công dạy, lớp sẽ hiện ở đây."} />
        </Section>
      )}
      <CourseGrid title="Đang diễn ra" icon={Clock} courses={active} area={area} />
      <CourseGrid title="Đã chốt nhóm" icon={Award} courses={done} area={area} />
    </div>
  );
}
