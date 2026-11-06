import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Blocks, CalendarRange, CircleCheck, Library, Shapes, Sparkles, UsersRound, type LucideIcon } from "lucide-react";
import { Link } from "react-router";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useAuth } from "../../shared/auth/useAuth";
import type { Course, CoursePhase } from "../common/types";
import { ErrorNote, LinkButton, PageHeader, Section, StatTile } from "../common/ui";
import { PhaseBadge } from "../courses/CourseCard";
import { adminTodos } from "./adminTodos";

const shortcuts: { to: string; label: string; hint: string; icon: LucideIcon }[] = [
  { to: "/admin/semesters", label: "Học kỳ", hint: "Thời gian của từng kỳ", icon: CalendarRange },
  { to: "/admin/subjects", label: "Môn học", hint: "Các môn làm dự án nhóm", icon: Library },
  { to: "/admin/majors", label: "Ngành", hint: "Ngành và màu trên bảng phòng", icon: Shapes },
  { to: "/admin/skills", label: "Skill", hint: "Để gợi ý phòng", icon: Sparkles },
  { to: "/admin/group-types", label: "Loại nhóm", hint: "Luật thành phần ngành", icon: Blocks },
  { to: "/admin/users", label: "Tài khoản", hint: "Giảng viên, quản trị viên", icon: UsersRound },
];

const counted: { phase: CoursePhase; label: string; tone: "neutral" | "good" | "warn" | "info" }[] = [
  { phase: "Setup", label: "Đang chuẩn bị", tone: "neutral" },
  { phase: "Published", label: "Đang tìm nhóm", tone: "good" },
  { phase: "Expired", label: "Chờ chốt nhóm", tone: "warn" },
  { phase: "Finalized", label: "Đã chốt nhóm", tone: "info" },
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

  return (
    <div className="space-y-8">
      <PageHeader
        title={firstName ? `Chào ${firstName}` : "Tổng quan"}
        description="Theo dõi các course đang lập nhóm và việc cần làm tiếp theo."
        actions={
          <LinkButton to="/admin/courses">
            Quản lý course
            <ArrowRight />
          </LinkButton>
        }
      />

      <ErrorNote error={courses.error} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {courses.isLoading
          ? Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-24 rounded-xl" />)
          : counted.map((item) => (
              <StatTile key={item.phase} label={`Course ${item.label.toLowerCase()}`} value={all.filter((course) => course.phase === item.phase).length} />
            ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Section title="Việc cần làm" description="Sắp theo mức gấp.">
          {courses.isLoading && <Skeleton className="h-32" />}
          {courses.isSuccess && todos.length === 0 && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <CircleCheck className="size-4 text-success" aria-hidden />
              Không có việc gì đang chờ.
            </p>
          )}
          <ul className="divide-y">
            {todos.map((todo) => (
              <li key={todo.course.id}>
                <Link to={`/admin/courses/${todo.course.id}`} className="group flex items-center gap-3 py-3 outline-none first:pt-0 focus-visible:underline">
                  <span className={cn("size-2 shrink-0 rounded-full", todo.urgent ? "bg-deadline" : "bg-border")} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium group-hover:underline">
                      {todo.course.subjectCode} {todo.course.classCode}
                      <span className="ml-2 font-normal text-muted-foreground">{todo.course.semesterCode}</span>
                    </span>
                    <span className={cn("block text-xs", todo.urgent ? "text-deadline-ink" : "text-muted-foreground")}>{todo.action}</span>
                  </span>
                  <PhaseBadge phase={todo.course.phase} />
                  <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Dữ liệu nền">
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
            {shortcuts.map((shortcut) => (
              <Link
                key={shortcut.to}
                to={shortcut.to}
                className="flex items-center gap-3 rounded-lg border p-3 transition-colors outline-none hover:border-primary/40 hover:bg-accent/40 focus-visible:ring-3 focus-visible:ring-ring/40"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                  <shortcut.icon className="size-4" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{shortcut.label}</span>
                  <span className="block truncate text-xs text-muted-foreground">{shortcut.hint}</span>
                </span>
              </Link>
            ))}
          </div>
        </Section>
      </div>
    </div>
  );
}
