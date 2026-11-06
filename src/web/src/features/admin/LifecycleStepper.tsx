import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateTime } from "../common/messages";
import type { Course, CoursePhase } from "../common/types";

const steps: { phase: CoursePhase; label: string; hint: (course: Course) => string }[] = [
  { phase: "Setup", label: "Chuẩn bị", hint: (course) => `${course.studentCount} sinh viên, ${course.roomCount} phòng` },
  { phase: "Published", label: "Tìm nhóm", hint: (course) => (course.publishAt ? `Mở ${formatDateTime(course.publishAt)}` : "Chưa hẹn giờ mở") },
  { phase: "Expired", label: "Hết hạn, xếp người", hint: (course) => `Hạn ${formatDateTime(course.expireAt)}` },
  { phase: "Finalized", label: "Đã chốt nhóm", hint: (course) => (course.finalizedAt ? formatDateTime(course.finalizedAt) : "Danh sách chính thức") },
];

export function LifecycleStepper({ course }: { course: Course }) {
  const currentIndex = steps.findIndex((step) => step.phase === course.phase);

  return (
    <ol className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-4 sm:gap-0 sm:p-0" aria-label="Vòng đời course">
      {steps.map((step, index) => {
        const done = index < currentIndex || course.phase === "Finalized";
        const current = index === currentIndex;
        return (
          <li
            key={step.phase}
            aria-current={current ? "step" : undefined}
            className={cn("relative flex items-start gap-3 sm:px-4 sm:py-4", index > 0 && "sm:border-l", current && "sm:bg-accent/50")}
          >
            <span
              className={cn(
                "tabular flex size-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold",
                done && "border-success bg-success text-white",
                current && !done && "border-primary bg-primary text-primary-foreground",
                !done && !current && "border-input text-muted-foreground",
              )}
            >
              {done ? <Check className="size-4" aria-hidden /> : index + 1}
            </span>
            <span className="min-w-0">
              <span className={cn("block text-sm font-medium", !done && !current && "text-muted-foreground")}>{step.label}</span>
              <span className="block truncate text-xs text-muted-foreground">{step.hint(course)}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
