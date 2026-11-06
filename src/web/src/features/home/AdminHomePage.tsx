import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Award, BookMarked, CalendarRange, Clock, DoorOpen, Inbox, Layers, Library, SlidersHorizontal, Sparkles, TriangleAlert, CircleCheck, UserRound, type LucideIcon } from "lucide-react";
import { Link } from "react-router";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { ApiError } from "../../shared/api/apiClient";
import { useAuth } from "../../shared/auth/useAuth";
import type { Course, CoursePhase } from "../common/types";
import { Badge, EmptyState, Failure, LinkButton, PageHeader, Section, StatTile } from "../common/ui";
import { CourseFailure } from "../courses/CourseFailure";
import { PhaseChip } from "../courses/PhaseChip";
import { adminTodos } from "./adminTodos";

const shortcuts: { to: string; label: string; hint: string; icon: LucideIcon }[] = [
  { to: "/admin/semesters", label: "Học kỳ", hint: "Thời gian của từng kỳ", icon: CalendarRange },
  { to: "/admin/subjects", label: "Môn học", hint: "Các môn làm dự án nhóm", icon: Library },
  { to: "/admin/majors", label: "Ngành", hint: "Ngành và nhãn trên bảng phòng", icon: BookMarked },
  { to: "/admin/skills", label: "Kỹ năng", hint: "Để gợi ý phòng", icon: Sparkles },
  { to: "/admin/group-types", label: "Loại nhóm", hint: "Luật thành phần ngành", icon: Layers },
  { to: "/admin/users", label: "Tài khoản", hint: "Giảng viên, giáo vụ", icon: UserRound },
];

const counted: { phase: CoursePhase; label: string; icon: LucideIcon }[] = [
  { phase: "Setup", label: "Lớp đang chuẩn bị", icon: SlidersHorizontal },
  { phase: "Published", label: "Lớp đang tìm nhóm", icon: DoorOpen },
  { phase: "Expired", label: "Lớp chờ chốt nhóm", icon: Clock },
  { phase: "Finalized", label: "Lớp đã chốt nhóm", icon: Award },
];

export function AdminHomePage() {
  const { api, user } = useAuth();
  const courses = useQuery({
    queryKey: ["courses", "admin", "dashboard"],
    queryFn: () => api.get<Course[]>("/api/v1/courses", { pageSize: 100, sort: "-expireAt" }),
  });
  const all = courses.data?.data ?? [];
  const todos = adminTodos(all);
  const firstName = user?.name?.trim().split(/\s+/).at(-1);

  if (courses.error instanceof ApiError && (courses.error.status === 403 || courses.error.status === 404)) {
    return <CourseFailure error={courses.error} onRetry={() => void courses.refetch()} failTitle="Không tải được danh sách lớp" forbiddenText="Trang tổng quan chỉ dành cho giáo vụ." missingText="Trang này không còn tồn tại hoặc đường dẫn đã sai." backTo="/login" backLabel="Về trang đăng nhập" />;
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={firstName ? `Chào ${firstName}` : "Chào Giáo vụ"}
        description="Theo dõi các lớp đang lập nhóm và việc cần làm tiếp theo."
        actions={
          <LinkButton to="/admin/courses" variant="outline">
            Quản lý lớp
            <ArrowRight />
          </LinkButton>
        }
      />

      {!courses.isError && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {courses.isLoading
            ? Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-24 rounded-xl" />)
            : counted.map((item) => <StatTile key={item.phase} icon={item.icon} label={item.label} value={all.filter((course) => course.phase === item.phase).length} />)}
        </div>
      )}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Section flush title="Việc cần làm" icon={Inbox} description="Sắp theo mức gấp.">
          {courses.isLoading && (
            <div className="space-y-2 px-[18px] py-3.5" aria-busy="true" aria-label="Đang tải">
              {Array.from({ length: 5 }, (_, index) => (
                <Skeleton key={index} className="h-14 rounded-[10px]" />
              ))}
            </div>
          )}
          {courses.isError && <Failure error={courses.error} title="Không tải được danh sách lớp" onRetry={() => void courses.refetch()} />}
          {courses.isSuccess && todos.length === 0 && <EmptyState icon={CircleCheck} title="Không có việc gì đang chờ." description="Việc mới hiện ở đây khi có lớp cần nhập sinh viên, sinh phòng, mở tìm nhóm hoặc chốt nhóm." />}
          <ul className="divide-y">
            {todos.map((todo) => (
              <li key={todo.course.id}>
                <Link to={`/admin/courses/${todo.course.id}/${todo.section}`} className="group flex items-center gap-3 px-[18px] py-3 transition-colors outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
                  <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", todo.urgent ? "bg-deadline-soft text-ink" : "bg-muted text-muted-foreground")} aria-hidden>
                    {todo.urgent ? <TriangleAlert className="size-4" /> : <Inbox className="size-4" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                      {todo.course.subjectCode} {todo.course.classCode}
                      <Badge icon={CalendarRange}>{todo.course.semesterCode}</Badge>
                    </span>
                    <span className={cn("block text-xs", todo.urgent ? "font-medium text-ink" : "text-muted-foreground")}>{todo.action}</span>
                  </span>
                  <PhaseChip phase={todo.course.phase} />
                  <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </Section>

        <Section flush title="Dữ liệu nền" icon={Layers}>
          <ul className="divide-y">
            {shortcuts.map((shortcut) => (
              <li key={shortcut.to}>
                <Link to={shortcut.to} className="flex items-center gap-3 px-[18px] py-3 transition-colors outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground" aria-hidden>
                    <shortcut.icon className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{shortcut.label}</span>
                    <span className="block truncate text-xs text-muted-foreground">{shortcut.hint}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </div>
  );
}
