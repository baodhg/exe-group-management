import { useEffect, useState } from "react";

const longestTimer = 2_147_483_647;

export function useDeadlineReached(deadline: string | null): boolean {
  const [reached, setReached] = useState<string | null>(null);

  useEffect(() => {
    if (!deadline) {
      return undefined;
    }

    const left = new Date(deadline).getTime() - Date.now();
    if (left > longestTimer) {
      return undefined;
    }

    const timer = setTimeout(() => setReached(deadline), Math.max(left, 0));
    return () => clearTimeout(timer);
  }, [deadline]);

  return reached !== null && reached === deadline;
}
