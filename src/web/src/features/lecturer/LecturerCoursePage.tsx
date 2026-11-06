import { useQuery } from "@tanstack/react-query";
import { Eye, UsersRound } from "lucide-react";
import { useParams } from "react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "../../shared/auth/useAuth";
import { formatDateTime } from "../common/messages";
import type { Course } from "../common/types";
import { Badge, ErrorNote, Loading, PageHeader } from "../common/ui";
import { DeadlineText, PhaseBadge } from "../courses/CourseCard";
import { OverviewPanel } from "../courses/OverviewPanel";
import { RoomBoard } from "../rooms/RoomBoard";

export function LecturerCoursePage() {
  const { courseId = "" } = useParams();
  const { api } = useAuth();
  const course = useQuery({ queryKey: ["course", courseId], queryFn: () => api.get<Course>(`/api/v1/courses/${courseId}`) });

  if (course.isLoading) {
    return <Loading when rows={4} />;
  }

  if (!course.data) {
    return <ErrorNote error={course.error} />;
  }

  const current = course.data.data;
  const finalized = current.phase === "Finalized";

  return (
    <div className="space-y-6">
      <PageHeader
        crumbs={[{ label: "Course giảng dạy", to: "/lecturer" }, { label: `${current.subjectCode} ${current.classCode}` }]}
        title={`${current.subjectCode}: ${current.subjectName}`}
        meta={
          <>
            <PhaseBadge phase={current.phase} />
            <Badge>Lớp {current.classCode}</Badge>
            <span className="tabular flex items-center gap-1.5 text-sm text-muted-foreground">
              <UsersRound className="size-4" aria-hidden />
              {current.studentCount} sinh viên, {current.roomCount} phòng
            </span>
            {finalized ? (
              <span className="text-sm text-muted-foreground">Chốt nhóm lúc {formatDateTime(current.finalizedAt)}</span>
            ) : (
              <DeadlineText expireAt={current.expireAt} phase={current.phase} className="text-sm text-muted-foreground" />
            )}
          </>
        }
        actions={
          <Badge className="py-1">
            <Eye className="size-3.5" aria-hidden />
            Chỉ xem
          </Badge>
        }
      />

      <Tabs defaultValue="progress">
        <TabsList>
          <TabsTrigger value="progress">Tiến độ</TabsTrigger>
          <TabsTrigger value="rooms">{finalized ? "Nhóm chính thức" : "Bảng phòng"}</TabsTrigger>
        </TabsList>
        <TabsContent value="progress" className="pt-4">
          <OverviewPanel courseId={courseId} />
        </TabsContent>
        <TabsContent value="rooms" className="pt-4">
          <RoomBoard courseId={courseId} finalized={finalized} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
