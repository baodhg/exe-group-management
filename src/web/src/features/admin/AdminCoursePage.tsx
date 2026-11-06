import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Navigate, useParams } from "react-router";
import { courseSectionsFor, defaultCourseSection } from "../../shared/layout/navigation";
import { useAuth } from "../../shared/auth/useAuth";
import type { Course } from "../common/types";
import { PageLoading } from "../common/ui";
import { CourseFailure } from "../courses/CourseFailure";
import { deadlineReached } from "../courses/overview";
import { useWatchCourse } from "../realtime/realtimeContext";
import { PlacementSection } from "./CompletionSection";
import { FinalSection } from "./FinalSection";
import { OverviewSection } from "./OverviewSection";
import type { FinalizeResult } from "./placement";
import { RoomsSection } from "./RoomsSection";
import { SettingsSection } from "./SettingsSection";
import { StudentsSection } from "./StudentsSection";

const closingRefreshMs = 20_000;

export function AdminCoursePage() {
  const { courseId = "", section } = useParams();
  const { api } = useAuth();
  const [finalizeResult, setFinalizeResult] = useState<FinalizeResult | null>(null);
  useWatchCourse(courseId);
  const course = useQuery({
    queryKey: ["course", courseId],
    queryFn: () => api.get<Course>(`/api/v1/courses/${courseId}`),
    refetchInterval: (query) => {
      const current = query.state.data?.data;
      return current && deadlineReached(current.phase, current.expireAt) ? closingRefreshMs : false;
    },
  });

  if (course.isLoading) {
    return <PageLoading />;
  }

  if (!course.data) {
    return (
      <CourseFailure
        error={course.error}
        onRetry={() => void course.refetch()}
        failTitle="Không tải được thông tin lớp"
        forbiddenText="Trang của lớp chỉ dành cho giáo vụ."
        missingText="Lớp này không còn tồn tại hoặc đường dẫn đã sai."
        backTo="/admin/courses"
        backLabel="Về các lớp"
      />
    );
  }

  const current = course.data.data;
  if (!section || !courseSectionsFor(current.phase).includes(section)) {
    return <Navigate to={`/admin/courses/${courseId}/${defaultCourseSection(current.phase)}`} replace />;
  }

  switch (section) {
    case "settings":
      return <SettingsSection key={`${current.id}-${current.phase}`} course={current} />;
    case "roster":
      return <StudentsSection course={current} />;
    case "rooms":
      return <RoomsSection course={current} />;
    case "placement":
      return <PlacementSection course={current} onFinalized={setFinalizeResult} />;
    case "final":
      return <FinalSection course={current} result={finalizeResult} />;
    default:
      return <OverviewSection course={current} />;
  }
}
