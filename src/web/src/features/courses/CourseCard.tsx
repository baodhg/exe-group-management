import { CalendarClock, DoorOpen, UsersRound } from "lucide-react";
import { Link } from "react-router";
import { cn } from "@/lib/utils";
import { deadlineInfo, formatDateTime, phaseLabels, phaseTones } from "../common/messages";
import type { Course, CoursePhase } from "../common/types";
import { Badge } from "../common/ui";

export function PhaseBadge({ phase }: { phase: CoursePhase }) {
  return <Badge tone={phaseTones[phase]}>{phaseLabels[phase]}</Badge>;
}

export function DeadlineText({ expireAt, phase, className }: { expireAt: string | null; phase: CoursePhase; className?: string }) {
  const info = phase === "Published" ? deadlineInfo(expireAt) : null;

  return (
    <span className={cn("flex items-center gap-1.5", className)}>
      <CalendarClock className="size-4 shrink-0" aria-hidden />
      <span>
        {expireAt ? `Hạn tìm nhóm ${formatDateTime(expireAt)}` : "Chưa đặt hạn tìm nhóm"}
        {info && <span className={cn("ml-1.5 font-medium", info.urgent ? "text-deadline-ink" : "text-foreground")}>({info.text})</span>}
      </span>
    </span>
  );
}

export function CourseCard({ course, to }: { course: Course; to: string }) {
  return (
    <article className="group relative flex flex-col gap-4 rounded-xl border bg-card p-5 transition-shadow hover:shadow-md focus-within:ring-3 focus-within:ring-ring/40">
      <div className="flex items-center justify-between gap-2">
        <PhaseBadge phase={course.phase} />
        <span className="text-xs font-medium text-muted-foreground">{course.semesterCode}</span>
      </div>
      <div className="space-y-1">
        <h3 className="text-lg font-semibold">
          <Link to={to} className="outline-none after:absolute after:inset-0 after:rounded-xl">
            {course.subjectCode}
            <span className="sr-only"> lớp {course.classCode}</span>
          </Link>
        </h3>
        <p className="line-clamp-2 text-sm text-foreground/80">{course.subjectName}</p>
        <p className="text-sm text-muted-foreground">Lớp {course.classCode}</p>
      </div>
      <div className="mt-auto space-y-2 border-t pt-3 text-sm text-muted-foreground">
        <DeadlineText expireAt={course.expireAt} phase={course.phase} />
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <span className="tabular flex items-center gap-1.5">
            <UsersRound className="size-4" aria-hidden />
            {course.studentCount} sinh viên
          </span>
          <span className="tabular flex items-center gap-1.5">
            <DoorOpen className="size-4" aria-hidden />
            {course.roomCount} phòng
          </span>
        </div>
      </div>
    </article>
  );
}
