import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useAuth } from "../../shared/auth/useAuth";
import type { RoomSummary } from "../common/types";
import { boardFetchLimit } from "./roomBoardLogic";

export function useCourseRooms(courseId: string, { search = "", onlyWithSeat = false, sort = "name", enabled = true }: { search?: string; onlyWithSeat?: boolean; sort?: string; enabled?: boolean } = {}) {
  const { api } = useAuth();
  return useQuery({
    queryKey: ["rooms", courseId, "all", { search, onlyWithSeat, sort }],
    queryFn: () =>
      api.get<RoomSummary[]>(`/api/v1/courses/${courseId}/rooms`, {
        search,
        hasSeat: onlyWithSeat ? true : undefined,
        sort,
        page: 1,
        pageSize: boardFetchLimit,
      }),
    placeholderData: keepPreviousData,
    enabled,
  });
}
