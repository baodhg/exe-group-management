import { Eye, UsersRound } from "lucide-react";
import { Badge, LinkButton } from "../common/ui";
import type { Course } from "../common/types";
import { CourseHeader } from "./CourseHeader";
import { ProjectBoardPanel } from "../projects/ProjectBoardPanel";

export function ProjectsSection({ course }: { course: Course }) {
  return (
    <div className="space-y-5">
      <CourseHeader
        course={course}
        hideLecturer
        title="Vòng đời đồ án"
        description="Giáo vụ mở các mốc đồ án; mỗi nhóm chính thức nộp sản phẩm cho từng mốc và giảng viên chấm điểm."
        meta={
          <>
            <Badge icon={Eye}>Nhóm chính thức</Badge>
            <LinkButton to={`/admin/courses/${course.id}/final`} variant="link" size="sm" className="h-auto p-0">
              <UsersRound />
              Danh sách nhóm chính thức
            </LinkButton>
          </>
        }
      />

      <ProjectBoardPanel courseId={course.id} canManage canReview />
    </div>
  );
}
