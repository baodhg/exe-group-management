import { Award, CalendarClock, CalendarDays, Clock, DoorOpen, SlidersHorizontal, TriangleAlert, UsersRound, type LucideIcon } from "lucide-react";
import { Link } from "react-router";
import { cn } from "@/lib/utils";
import { deadlineInfo, formatDateTime, phaseLabels, phaseTones } from "../common/messages";
import type { Course, CoursePhase } from "../common/types";
import { Badge } from "../common/ui";

const phaseIcons: Record<CoursePhase, LucideIcon> = { Setup: SlidersHorizontal, Published: DoorOpen, Expired: Clock, Finalized: Award };

export function PhaseBadge({ phase }: { phase: CoursePhase }) {
  return (
    <Badge tone={phaseTones[phase]} icon={phaseIcons[phase]}>
      {phaseLabels[phase]}
    </Badge>
  );
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
  const left = course.phase === "Published" ? deadlineInfo(course.expireAt) : null;

  return (
    <article className="relative flex flex-col gap-3 rounded-xl border bg-card p-[18px] shadow-card transition-colors hover:bg-muted">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <PhaseBadge phase={course.phase} />
        <Badge icon={CalendarDays}>{course.semesterCode}</Badge>
      </div>
      <div className="flex flex-col gap-0.5">
        <h3 className="text-lg font-extrabold tracking-[-0.015em]">
          <Link to={to} className="outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-2 focus-visible:after:ring-ring">
            {course.subjectCode}
            <span className="sr-only"> lớp {course.classCode}</span>
          </Link>
        </h3>
        <p className="text-[13px]">{course.subjectName}</p>
        <p className="text-[13px] text-muted-foreground">Lớp {course.classCode}</p>
      </div>
      <div className="mt-auto flex flex-col gap-2">
        <span className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
          <Clock className="size-3.5 shrink-0" aria-hidden />
          {course.expireAt ? `Hạn tìm nhóm ${formatDateTime(course.expireAt)}` : "Chưa đặt hạn tìm nhóm"}
        </span>
        <div className="flex flex-wrap items-center gap-1.5">
          {left && !left.passed && (
            <Badge tone={left.urgent ? "warn" : "neutral"} icon={left.urgent ? TriangleAlert : Clock}>
              {left.text}
            </Badge>
          )}
          <Badge icon={UsersRound}>
            <span className="tabular">{course.studentCount}</span> sinh viên
          </Badge>
          <Badge icon={DoorOpen}>
            <span className="tabular">{course.roomCount}</span> phòng
          </Badge>
        </div>
      </div>
    </article>
  );
}
