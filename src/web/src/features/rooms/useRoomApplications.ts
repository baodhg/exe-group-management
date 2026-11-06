import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../shared/auth/useAuth";
import type { JoinRequest } from "../common/types";

const pendingRefreshMs = 30_000;

export function useRoomApplications(roomId: string, enabled: boolean) {
  const { api } = useAuth();
  return useQuery({
    queryKey: ["joinRequests", "room", roomId],
    queryFn: () => api.get<JoinRequest[]>("/api/v1/join-requests", { roomId, status: "Pending", sort: "createdAt", pageSize: 100 }),
    enabled,
    refetchInterval: pendingRefreshMs,
  });
}
