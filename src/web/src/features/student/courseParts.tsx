import { ArrowLeft, Check, ChevronRight, Clock, DoorOpen, Inbox, Lock, MoveRight, Search, Undo2, X, type LucideIcon } from "lucide-react";
import { Link } from "react-router";
import { Skeleton } from "@/components/ui/skeleton";
import { requestStatusLabels } from "../common/messages";
import type { Course, CoursePhase, JoinRequest, RoomDetail, RoomMember } from "../common/types";
import { Badge, CheckItem, Checks, LinkButton, Steps, type Tone } from "../common/ui";
import { briefRoomChecks } from "../rooms/roomBoardLogic";
import { phaseStep } from "./studentCourse";

const phaseStepLabels = [{ label: "Chuẩn bị" }, { label: "Chọn phòng" }, { label: "Xếp lại" }, { label: "Chốt nhóm" }];

export function PhaseSteps({ phase }: { phase: CoursePhase }) {
  return <Steps steps={phaseStepLabels} current={phaseStep(phase)} className="mt-1 w-full" />;
}

function CourseField({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex items-baseline gap-1.5 leading-tight not-first:border-l not-first:pl-2.5">
      <small className="text-xs text-muted-foreground">{label}</small>
      <b className="text-[13px] font-semibold">{value}</b>
    </span>
  );
}

export function CoursePill({ course }: { course: Pick<Course, "subjectCode" | "classCode" | "semesterCode"> }) {
  return (
    <Link
      to="/student"
      aria-label={`Đổi lớp, đang chọn môn ${course.subjectCode}, lớp ${course.classCode}, học kỳ ${course.semesterCode}`}
      className="inline-flex min-h-9 items-center gap-2.5 rounded-full border bg-card px-3 py-1 shadow-xs outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
    >
      <CourseField label="Môn" value={course.subjectCode} />
      <CourseField label="Lớp" value={course.classCode} />
      <CourseField label="Học kỳ" value={course.semesterCode} />
      <ChevronRight className="size-3.5 text-muted-foreground" aria-hidden />
    </Link>
  );
}

const deniedIcons: Record<403 | 404, LucideIcon> = { 403: Lock, 404: Search };

export function PageDenied({ status, title, text, backTo = "/student", backLabel = "Về lớp của tôi" }: { status: 403 | 404; title: string; text: string; backTo?: string; backLabel?: string }) {
  const Icon = deniedIcons[status];
  return (
    <div className="flex min-h-[60vh] flex-1 flex-col items-center justify-center gap-2.5 text-center">
      <span className="text-[64px]/none font-extrabold tracking-[-0.03em] text-ink">{status}</span>
      <span className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-[18px]" aria-hidden />
      </span>
      <h1 className="text-lg font-extrabold">{title}</h1>
      <p className="max-w-md text-sm text-muted-foreground">{text}</p>
      <LinkButton to={backTo} variant="outline" size="sm" className="mt-1">
        <ArrowLeft aria-hidden />
        {backLabel}
      </LinkButton>
    </div>
  );
}

export function CourseDenied({ status }: { status: 403 | 404 }) {
  return status === 403 ? (
    <PageDenied status={403} title="Bạn không có quyền mở lớp này" text="Chỉ sinh viên trong danh sách lớp, giảng viên của lớp và giáo vụ mới mở được lớp." />
  ) : (
    <PageDenied status={404} title="Không tìm thấy lớp" text="Không tìm thấy dữ liệu. Đường dẫn có thể đã cũ." />
  );
}

export function CourseSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Đang tải lớp">
      <div className="flex flex-wrap items-start justify-between gap-6 pt-5 pb-2.5">
        <div className="flex-[1_1_460px] space-y-3">
          <Skeleton className="h-8 w-72 max-w-full rounded-full" />
          <Skeleton className="h-3 w-96 max-w-full rounded-full" />
          <Skeleton className="h-3 w-64 max-w-full rounded-full" />
        </div>
        <Skeleton className="h-28 flex-[0_1_270px] rounded-[18px]" />
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(340px,2fr)]">
        <div className="space-y-3.5">
          <Skeleton className="h-44 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    </div>
  );
}

const joinedViaStyles: Record<string, { label: string; tone: Tone; icon: LucideIcon }> = {
  Open: { label: "Tự vào", tone: "neutral", icon: DoorOpen },
  Application: { label: "Qua đơn", tone: "neutral", icon: Inbox },
  Admin: { label: "Giáo vụ xếp", tone: "info", icon: MoveRight },
};

export function JoinedViaBadge({ via }: { via: RoomMember["joinedVia"] }) {
  const style = joinedViaStyles[via];
  return style ? (
    <Badge tone={style.tone} icon={style.icon}>
      {style.label}
    </Badge>
  ) : null;
}

const requestStatusStyles: Record<JoinRequest["status"], { tone: Tone; icon: LucideIcon }> = {
  Pending: { tone: "info", icon: Clock },
  Approved: { tone: "good", icon: Check },
  Rejected: { tone: "bad", icon: X },
  Cancelled: { tone: "neutral", icon: Undo2 },
};

export function RequestStatusBadge({ status }: { status: JoinRequest["status"] }) {
  const style = requestStatusStyles[status];
  return (
    <Badge tone={style.tone} icon={style.icon}>
      {requestStatusLabels[status]}
    </Badge>
  );
}

export function RoomCheckList({ room }: { room: Pick<RoomDetail, "memberCount" | "minGroupSize" | "minDistinctMajors" | "majors"> }) {
  return (
    <Checks>
      {briefRoomChecks(room).map((check) => (
        <CheckItem key={check.label} ok={check.ok} label={check.label} value={check.ok ? "Đủ" : "Thiếu"} />
      ))}
    </Checks>
  );
}
