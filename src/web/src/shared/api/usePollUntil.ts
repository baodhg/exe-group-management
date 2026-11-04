import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useAuth } from "../auth/useAuth";

export function usePollUntil<T>(
  path: string | null,
  isDone: (value: T) => boolean,
  { intervalMs = 1500, timeoutMs = 30_000 }: { intervalMs?: number; timeoutMs?: number } = {},
) {
  const { api } = useAuth();
  const [startedAt] = useState(() => Date.now());

  return useQuery({
    queryKey: ["poll", path],
    enabled: path !== null,
    queryFn: async () => (await api.get<T>(path!)).data,
    refetchInterval: (query) => {
      const value = query.state.data;
      if (value !== undefined && isDone(value)) {
        return false;
      }

      return Date.now() - startedAt > timeoutMs ? false : intervalMs;
    },
  });
}
