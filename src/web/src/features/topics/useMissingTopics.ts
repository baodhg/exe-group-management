import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../shared/auth/useAuth";
import type { MissingTopics } from "../common/types";

export function useMissingTopics(courseId: string, enabled = true) {
  const { api } = useAuth();
  return useQuery({
    queryKey: ["missingTopics", courseId],
    queryFn: () => api.get<MissingTopics>(`/api/v1/courses/${courseId}/groups/missing-topics`),
    enabled,
  });
}
