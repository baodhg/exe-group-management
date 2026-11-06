import { HubConnectionBuilder, HubConnectionState, LogLevel, type HubConnection } from "@microsoft/signalr";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { browserSessionStore, decodeUser } from "../../shared/auth/sessionStore";
import { useAuth } from "../../shared/auth/useAuth";
import { notificationQueryKeys, notificationTarget, roomChangeQueryKeys, tokenExpired, type ChatMessage, type Notification, type RoomChange } from "./chat";
import { PushCard } from "./PushCard";
import { RealtimeContext, type ConnectionState, type RealtimeState } from "./realtimeContext";

const hubPath = "/hubs/realtime";
const retryDelayMs = 5_000;

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { api, user } = useAuth();
  const queryClient = useQueryClient();
  const [state, setState] = useState<ConnectionState>("disconnected");
  const connection = useRef<HubConnection | null>(null);
  const watched = useRef(new Map<string, number>());
  const listeners = useRef(new Map<string, Set<(message: ChatMessage) => void>>());
  const userId = user?.userId;
  const rolesRef = useRef<readonly string[]>([]);
  const roles = user?.roles;
  useEffect(() => {
    rolesRef.current = roles ?? [];
  }, [roles]);

  useEffect(() => {
    if (!userId) {
      return undefined;
    }

    const hub = new HubConnectionBuilder()
      .withUrl(hubPath, {
        accessTokenFactory: async () => {
          const session = browserSessionStore.read();
          if (session && tokenExpired(decodeUser(session.accessToken)?.expiresAt, Date.now())) {
            await api.get("/api/v1/notifications", { pageSize: 1 }).catch(() => undefined);
          }

          return browserSessionStore.read()?.accessToken ?? "";
        },
      })
      .withAutomaticReconnect()
      .configureLogging(LogLevel.None)
      .build();

    const rewatch = () => Promise.all([...watched.current.keys()].map((courseId) => hub.invoke("watchCourse", courseId).catch(() => undefined)));

    hub.on("notificationReceived", (notification: Notification) => {
      for (const queryKey of notificationQueryKeys(notification)) {
        void queryClient.invalidateQueries({ queryKey });
      }

      toast.custom((id) => <PushCard notification={notification} target={notificationTarget(notification, rolesRef.current)} onClose={() => toast.dismiss(id)} />, { position: "bottom-right", duration: 7_000 });
    });
    hub.on("messageReceived", (message: ChatMessage) => {
      listeners.current.get(message.conversationId)?.forEach((listener) => listener(message));
    });
    hub.on("roomChanged", (change: RoomChange) => {
      for (const queryKey of roomChangeQueryKeys(change)) {
        void queryClient.invalidateQueries({ queryKey });
      }
    });
    hub.onreconnecting(() => setState("reconnecting"));
    hub.onreconnected(() => {
      setState("connected");
      void rewatch();
      void queryClient.invalidateQueries();
    });
    hub.onclose(() => {
      setState("disconnected");
      if (!run.stopped) {
        run.dropped = true;
        clearTimeout(run.retry);
        run.retry = setTimeout(() => void start(), retryDelayMs);
      }
    });

    const run: { stopped: boolean; dropped: boolean; retry?: ReturnType<typeof setTimeout> } = { stopped: false, dropped: false };
    const start = async () => {
      setState("connecting");
      try {
        await hub.start();
        if (!run.stopped) {
          setState("connected");
          await rewatch();
          if (run.dropped) {
            run.dropped = false;
            void queryClient.invalidateQueries();
          }
        }
      } catch {
        if (!run.stopped) {
          setState("disconnected");
          run.retry = setTimeout(() => void start(), retryDelayMs);
        }
      }
    };

    connection.current = hub;
    void start();
    return () => {
      run.stopped = true;
      clearTimeout(run.retry);
      connection.current = null;
      void hub.stop();
    };
  }, [api, queryClient, userId]);

  const watchCourse = useCallback((courseId: string) => {
    const count = watched.current.get(courseId) ?? 0;
    watched.current.set(courseId, count + 1);
    if (count === 0 && connection.current?.state === HubConnectionState.Connected) {
      void connection.current.invoke("watchCourse", courseId).catch(() => undefined);
    }

    return () => {
      const remaining = (watched.current.get(courseId) ?? 1) - 1;
      if (remaining > 0) {
        watched.current.set(courseId, remaining);
        return;
      }

      watched.current.delete(courseId);
      if (connection.current?.state === HubConnectionState.Connected) {
        void connection.current.invoke("unwatchCourse", courseId).catch(() => undefined);
      }
    };
  }, []);

  const onMessage = useCallback((conversationId: string, handler: (message: ChatMessage) => void) => {
    const handlers = listeners.current.get(conversationId) ?? new Set();
    handlers.add(handler);
    listeners.current.set(conversationId, handlers);
    return () => {
      handlers.delete(handler);
      if (handlers.size === 0) {
        listeners.current.delete(conversationId);
      }
    };
  }, []);

  const value = useMemo<RealtimeState>(() => ({ state, watchCourse, onMessage }), [state, watchCourse, onMessage]);
  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}
