import { CalendarRange, UserRound } from "lucide-react";
import type { ReactNode } from "react";
import type { Course } from "../common/types";
import { Badge, Notice, PageHeader } from "../common/ui";
import { PhaseChip } from "../courses/PhaseChip";
import { courseErrorText, errorTraceText } from "./courseErrors";
import { LifecycleStepper } from "./LifecycleStepper";

export function CourseHeader({ course, title, description, meta, aside, hideLecturer = false }: { course: Course; title: ReactNode; description?: ReactNode; meta?: ReactNode; aside?: ReactNode; hideLecturer?: boolean }) {
  return (
    <PageHeader
      crumbs={[{ label: "Các lớp", to: "/admin/courses" }, { label: `${course.subjectCode} ${course.classCode}` }]}
      title={title}
      description={description}
      aside={aside}
      meta={
        <>
          <PhaseChip phase={course.phase} />
          <Badge icon={CalendarRange}>{course.semesterCode}</Badge>
          {!hideLecturer && <Badge icon={UserRound}>Giảng viên: {course.lecturerName ?? "Chưa phân công"}</Badge>}
          {meta}
          <LifecycleStepper course={course} className="basis-full pt-1" />
        </>
      }
    />
  );
}

export function FailureNote({ error, text }: { error: unknown; text?: string }) {
  if (!error) {
    return null;
  }

  const trace = errorTraceText(error);
  return (
    <Notice tone="bad" title={text ?? courseErrorText(error)}>
      {trace && <p className="tabular text-xs">{trace}</p>}
    </Notice>
  );
}
