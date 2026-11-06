import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useAuth } from "../../shared/auth/useAuth";
import type { CatalogItem, CourseOverview, RoomSummary, RosterEntry } from "../common/types";
import { listAll } from "./listAll";

export function useAllRooms(courseId: string, enabled = true) {
  const { api } = useAuth();
  return useQuery({
    queryKey: ["rooms", courseId, "all"],
    queryFn: () => listAll<RoomSummary>(api, `/api/v1/courses/${courseId}/rooms`, { sort: "name" }),
    enabled,
  });
}

export function useAllRoster(courseId: string, enabled = true) {
  const { api } = useAuth();
  return useQuery({
    queryKey: ["roster", courseId, "all"],
    queryFn: () => listAll<RosterEntry>(api, `/api/v1/courses/${courseId}/students`, { sort: "studentCode" }),
    enabled,
  });
}

export function useMajors() {
  const { api } = useAuth();
  return useQuery({
    queryKey: ["majors", "all"],
    queryFn: () => listAll<CatalogItem>(api, "/api/v1/majors", { sort: "code" }),
  });
}

export function useCourseOverview(courseId: string) {
  const { api } = useAuth();
  return useQuery({
    queryKey: ["overview", courseId],
    queryFn: () => api.get<CourseOverview>(`/api/v1/courses/${courseId}/overview`),
  });
}

export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}
