import { createContext, useContext, useEffect } from "react";
import type { ChatMessage } from "./chat";

export type ConnectionState = "connecting" | "connected" | "reconnecting" | "disconnected";

export interface RealtimeState {
  state: ConnectionState;
  watchCourse(courseId: string): () => void;
  onMessage(conversationId: string, handler: (message: ChatMessage) => void): () => void;
}

export const RealtimeContext = createContext<RealtimeState | null>(null);

export function useRealtime(): RealtimeState {
  const state = useContext(RealtimeContext);
  if (!state) {
    throw new Error("useRealtime must be used inside <RealtimeProvider>.");
  }

  return state;
}

export function useWatchCourse(courseId: string | undefined) {
  const { watchCourse } = useRealtime();
  useEffect(() => (courseId ? watchCourse(courseId) : undefined), [courseId, watchCourse]);
}
