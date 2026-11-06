import { Inbox, Star, UsersRound } from "lucide-react";
import type { ReactNode } from "react";
import type { Course } from "../common/types";
import { Badge, LinkButton, PageHeader } from "../common/ui";
import { PhaseBadge } from "../courses/CourseCard";
import { CoursePill, PhaseSteps } from "./courseParts";

export function CourseHero({ course, title, text, aside, showApplications = false, extra }: { course: Course; title: string; text: string; aside?: ReactNode; showApplications?: boolean; extra?: ReactNode }) {
  return (
    <PageHeader
      lead={<CoursePill course={course} />}
      title={title}
      description={text}
      aside={aside}
      meta={
        <>
          <PhaseBadge phase={course.phase} />
          <Badge icon={UsersRound}>
            Nhóm {course.minGroupSize} đến {course.maxGroupSize} người
          </Badge>
          <LinkButton variant="outline" size="sm" to={`/student/semesters/${course.semesterId}/skills`}>
            <Star aria-hidden />
            Kỹ năng của tôi
          </LinkButton>
          {showApplications && (
            <LinkButton variant="outline" size="sm" to="/student/applications">
              <Inbox aria-hidden />
              Đơn của tôi
            </LinkButton>
          )}
          {extra}
          <PhaseSteps phase={course.phase} />
        </>
      }
    />
  );
}
