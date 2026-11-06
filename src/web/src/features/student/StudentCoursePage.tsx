import { useQuery } from "@tanstack/react-query";
import { useParams, useSearchParams } from "react-router";
import { useAuth } from "../../shared/auth/useAuth";
import type { Course, JoinRequest, RoomSummary } from "../common/types";
import { Failure } from "../common/ui";
import { useWatchCourse } from "../realtime/realtimeContext";
import { CourseDenied, CourseSkeleton } from "./courseParts";
import { StudentBoardView } from "./StudentBoardView";
import { deniedStatus } from "./studentCourse";
import { StudentExpiredView } from "./StudentExpiredView";
import { StudentFinalView } from "./StudentFinalView";

export function StudentCoursePage() {
  const { courseId = "" } = useParams();
  const { api } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  useWatchCourse(courseId);

  const course = useQuery({ queryKey: ["course", courseId], queryFn: () => api.get<Course>(`/api/v1/courses/${courseId}`) });
  const myRoom = useQuery({
    queryKey: ["rooms", courseId, "mine"],
    queryFn: () => api.get<RoomSummary[]>(`/api/v1/courses/${courseId}/rooms`, { mine: true }),
  });
  const applications = useQuery({
    queryKey: ["joinRequests", "mine", courseId],
    queryFn: () => api.get<JoinRequest[]>("/api/v1/join-requests", { courseId, pageSize: 50 }),
  });

  if (course.isLoading) {
    return <CourseSkeleton />;
  }

  if (!course.data) {
    const denied = deniedStatus(course.error);
    return denied ? <CourseDenied status={denied} /> : <Failure error={course.error} title="Không tải được lớp" onRetry={() => void course.refetch()} className="min-h-[60vh] justify-center" />;
  }

  const current = course.data.data;
  const requests = applications.data?.data ?? [];

  if (current.phase === "Finalized") {
    return <StudentFinalView course={current} myRoom={myRoom} />;
  }

  if (current.phase === "Expired" && searchParams.get("view") !== "board") {
    return <StudentExpiredView course={current} myRoom={myRoom} applications={applications} showBoard={() => setSearchParams({ view: "board" })} />;
  }

  return <StudentBoardView course={current} myRoom={myRoom} requests={requests} requestsError={applications.isError ? applications.error : null} onRetryRequests={() => void applications.refetch()} backToStatus={current.phase === "Expired" ? () => setSearchParams({}) : undefined} />;
}
