import { useMutation, useQuery } from "@tanstack/react-query";
import { LoaderCircle, MessagesSquare, SendHorizontal, Trash2 } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { ApiError } from "../../shared/api/apiClient";
import { useAuth } from "../../shared/auth/useAuth";
import { useDialogs } from "../common/dialogsContext";
import { errorText } from "../common/messages";
import { ErrorNote } from "../common/ui";
import { mergeMessages, type ChatMessage, type MessagePage } from "./chat";
import { useRealtime } from "./realtimeContext";

const pageSize = 20;
const syncAttempts = 15;
const stickDistance = 120;

function stillSyncing(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 404 || error.status === 403);
}

function timeOf(value: string): string {
  return new Date(value).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

function dayOf(value: string): string {
  return new Date(value).toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit" });
}

export function ChatPanel({ conversationId, className }: { conversationId: string; className?: string }) {
  const { api, user } = useAuth();
  const { state, onMessage } = useRealtime();
  const { confirm } = useDialogs();
  const [extra, setExtra] = useState<ChatMessage[]>([]);
  const [olderOverride, setOlderOverride] = useState<string | null | undefined>(undefined);
  const [text, setText] = useState("");
  const scroller = useRef<HTMLDivElement>(null);
  const lastSeen = useRef<string | null>(null);

  const latest = useQuery({
    queryKey: ["chat", conversationId],
    queryFn: () => api.get<MessagePage>(`/api/v1/conversations/${conversationId}/messages`, { pageSize }),
    retry: (count, error) => stillSyncing(error) && count < syncAttempts,
    retryDelay: 2_000,
  });

  const messages = useMemo(() => mergeMessages(latest.data?.data.items ?? [], extra), [latest.data, extra]);
  const olderCursor = olderOverride === undefined ? (latest.data?.data.nextBefore ?? null) : olderOverride;

  useEffect(() => onMessage(conversationId, (message) => setExtra((current) => mergeMessages(current, [message]))), [conversationId, onMessage]);

  useLayoutEffect(() => {
    const box = scroller.current;
    const last = messages.at(-1);
    if (!box || !last || last.id === lastSeen.current) {
      return;
    }

    const firstLoad = lastSeen.current === null;
    const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < stickDistance;
    lastSeen.current = last.id;
    if (firstLoad || nearBottom || last.senderId === user?.userId) {
      box.scrollTo({ top: box.scrollHeight, behavior: firstLoad ? "auto" : "smooth" });
    }
  }, [messages, user?.userId]);

  const older = useMutation({
    mutationFn: (before: string) => api.get<MessagePage>(`/api/v1/conversations/${conversationId}/messages`, { pageSize, before }),
    onSuccess: (result) => {
      setExtra((current) => mergeMessages(current, result.data.items));
      setOlderOverride(result.data.nextBefore);
    },
    onError: (error) => toast.error(errorText(error)),
  });
  const send = useMutation({
    mutationFn: () => api.post<ChatMessage>(`/api/v1/conversations/${conversationId}/messages`, { content: text.trim() }),
    onSuccess: (result) => {
      setText("");
      setExtra((current) => mergeMessages(current, [result.data]));
    },
    onError: (error) => toast.error(errorText(error)),
  });
  const remove = useMutation({
    mutationFn: (message: ChatMessage) => api.delete(`/api/v1/messages/${message.id}`).then(() => message),
    onSuccess: (message) => setExtra((current) => mergeMessages(current, [{ ...message, content: null, deleted: true }])),
    onError: (error) => toast.error(errorText(error)),
  });

  const notReady = stillSyncing(latest.error) || (latest.isFetching && latest.failureCount > 0);
  const canSend = !send.isPending && text.trim().length > 0 && !notReady;

  function submitOnEnter(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      if (canSend) {
        send.mutate();
      }
    }
  }

  return (
    <section className={cn("flex h-[34rem] flex-col overflow-hidden rounded-xl border bg-card", className)}>
      <header className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <MessagesSquare className="size-4 text-muted-foreground" aria-hidden />
          Chat của phòng
        </h2>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className={cn("size-2 rounded-full", state === "connected" ? "bg-success" : state === "disconnected" ? "bg-muted-foreground" : "animate-pulse bg-deadline")} aria-hidden />
          {state === "connected" ? "Trực tiếp" : state === "disconnected" ? "Mất kết nối" : "Đang kết nối"}
        </span>
      </header>

      <div ref={scroller} className="flex-1 space-y-1 overflow-y-auto px-4 py-3" aria-live="polite" aria-label="Tin nhắn">
        {olderCursor && (
          <div className="flex justify-center pb-2">
            <Button variant="ghost" size="sm" disabled={older.isPending} onClick={() => older.mutate(olderCursor)}>
              {older.isPending && <LoaderCircle className="animate-spin" aria-hidden />}
              Xem tin cũ hơn
            </Button>
          </div>
        )}
        {notReady && <p className="py-8 text-center text-sm text-muted-foreground">Đang thêm bạn vào chat của phòng, chờ vài giây.</p>}
        {!notReady && <ErrorNote error={latest.error} />}
        {messages.length === 0 && latest.isSuccess && <p className="py-8 text-center text-sm text-muted-foreground">Chưa có tin nhắn nào. Chào cả phòng đi!</p>}
        {messages.map((message, index) => {
          const own = message.senderId === user?.userId;
          const previous = messages[index - 1];
          const newDay = !previous || dayOf(previous.sentAt) !== dayOf(message.sentAt);
          const newSender = newDay || previous?.senderId !== message.senderId;

          return (
            <div key={message.id}>
              {newDay && <p className="py-2 text-center text-xs text-muted-foreground first-letter:uppercase">{dayOf(message.sentAt)}</p>}
              <div className={cn("group flex flex-col", own ? "items-end" : "items-start", newSender && "pt-2")}>
                {newSender && !own && <span className="px-1 pb-0.5 text-xs font-medium text-muted-foreground">{message.senderName || "Thành viên"}</span>}
                <div className={cn("flex max-w-[85%] items-end gap-1.5", own && "flex-row-reverse")}>
                  <div
                    className={cn(
                      "rounded-2xl px-3 py-2 text-sm break-words whitespace-pre-wrap",
                      own ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md bg-muted text-foreground",
                      message.deleted && "border border-dashed bg-transparent text-muted-foreground italic",
                    )}
                  >
                    {message.deleted ? "Tin nhắn đã bị xóa" : message.content}
                  </div>
                  <span className="tabular shrink-0 pb-1 text-[11px] text-muted-foreground">{timeOf(message.sentAt)}</span>
                  {own && !message.deleted && (
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                      aria-label="Xóa tin nhắn"
                      disabled={remove.isPending}
                      onClick={async () => {
                        if (await confirm({ title: "Xóa tin nhắn này?", description: "Mọi người trong phòng sẽ thấy tin đã bị xóa.", confirmLabel: "Xóa", destructive: true })) {
                          remove.mutate(message);
                        }
                      }}
                    >
                      <Trash2 />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <form
        className="flex items-end gap-2 border-t p-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (canSend) {
            send.mutate();
          }
        }}
      >
        <Textarea
          rows={1}
          maxLength={2000}
          placeholder="Nhắn cho cả phòng"
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={submitOnEnter}
          aria-label="Tin nhắn"
          className="max-h-32 min-h-9 resize-none py-2"
        />
        <Button type="submit" size="icon-lg" disabled={!canSend} aria-label="Gửi">
          {send.isPending ? <LoaderCircle className="animate-spin" /> : <SendHorizontal />}
        </Button>
      </form>
    </section>
  );
}
