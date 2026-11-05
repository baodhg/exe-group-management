import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useAuth } from "../auth/useAuth";

export function createPollClock(now: () => number = Date.now) {
  let started: { path: string; at: number } | null = null;
  return {
    mark(path: string) {
      if (started?.path !== path) {
        started = { path, at: now() };
      }
    },
    elapsedMs: () => (started ? now() - started.at : 0),
  };
}

export function usePollUntil<T>(
  path: string | null,
  isDone: (value: T) => boolean,
  { intervalMs = 1500, timeoutMs = 30_000 }: { intervalMs?: number; timeoutMs?: number } = {},
) {
  const { api } = useAuth();
  const [clock] = useState(() => createPollClock());

  return useQuery({
    queryKey: ["poll", path],
    enabled: path !== null,
    queryFn: async () => {
      clock.mark(path!);
      return (await api.get<T>(path!)).data;
    },
    refetchInterval: (query) => {
      const value = query.state.data;
      if (value !== undefined && isDone(value)) {
        return false;
      }

      return clock.elapsedMs() > timeoutMs ? false : intervalMs;
    },
  });
}
