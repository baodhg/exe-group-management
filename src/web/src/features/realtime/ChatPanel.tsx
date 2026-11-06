import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ApiError } from "../../shared/api/apiClient";
import { useAuth } from "../../shared/auth/useAuth";
import { formatDateTime } from "../common/messages";
import { ErrorNote } from "../common/ui";
import { mergeMessages, type ChatMessage, type MessagePage } from "./chat";
import { useRealtime } from "./realtimeContext";

const pageSize = 20;
const syncAttempts = 15;

function stillSyncing(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 404 || error.status === 403);
}

export function ChatPanel({ conversationId }: { conversationId: string }) {
  const { api, user } = useAuth();
  const { state, onMessage } = useRealtime();
  const [extra, setExtra] = useState<ChatMessage[]>([]);
  const [olderOverride, setOlderOverride] = useState<string | null | undefined>(undefined);
  const [text, setText] = useState("");

  const latest = useQuery({
    queryKey: ["chat", conversationId],
    queryFn: () => api.get<MessagePage>(`/api/v1/conversations/${conversationId}/messages`, { pageSize }),
    retry: (count, error) => stillSyncing(error) && count < syncAttempts,
    retryDelay: 2_000,
  });

  const messages = useMemo(() => mergeMessages(latest.data?.data.items ?? [], extra), [latest.data, extra]);
  const olderCursor = olderOverride === undefined ? (latest.data?.data.nextBefore ?? null) : olderOverride;

  useEffect(() => onMessage(conversationId, (message) => setExtra((current) => mergeMessages(current, [message]))), [conversationId, onMessage]);

  const older = useMutation({
    mutationFn: (before: string) => api.get<MessagePage>(`/api/v1/conversations/${conversationId}/messages`, { pageSize, before }),
    onSuccess: (result) => {
      setExtra((current) => mergeMessages(current, result.data.items));
      setOlderOverride(result.data.nextBefore);
    },
  });
  const send = useMutation({
    mutationFn: () => api.post<ChatMessage>(`/api/v1/conversations/${conversationId}/messages`, { content: text.trim() }),
    onSuccess: (result) => {
      setText("");
      setExtra((current) => mergeMessages(current, [result.data]));
    },
  });
  const remove = useMutation({
    mutationFn: (message: ChatMessage) => api.delete(`/api/v1/messages/${message.id}`).then(() => message),
    onSuccess: (message) => setExtra((current) => mergeMessages(current, [{ ...message, content: null, deleted: true }])),
  });

  const notReady = stillSyncing(latest.error) || (latest.isFetching && latest.failureCount > 0);
  return (
    <section className="card">
      <h2>
        Chat của phòng <span className="muted">· {state === "connected" ? "trực tiếp" : state === "reconnecting" || state === "connecting" ? "đang kết nối…" : "mất kết nối"}</span>
      </h2>
      {notReady ? <p className="muted">Đang thêm bạn vào chat của phòng, chờ vài giây…</p> : <ErrorNote error={latest.error} />}
      {olderCursor && (
        <button type="button" disabled={older.isPending} onClick={() => older.mutate(olderCursor)}>
          Tải tin cũ hơn
        </button>
      )}
      <ul className="chat">
        {messages.map((message) => (
          <li key={message.id} className={message.senderId === user?.userId ? "own" : undefined}>
            <span className="muted">
              {message.senderName || "Thành viên"} · {formatDateTime(message.sentAt)}
            </span>
            <p>{message.deleted ? <em className="muted">Tin nhắn đã bị xóa</em> : message.content}</p>
            {message.senderId === user?.userId && !message.deleted && (
              <button type="button" className="link" disabled={remove.isPending} onClick={() => remove.mutate(message)}>
                Xóa
              </button>
            )}
          </li>
        ))}
      </ul>
      {messages.length === 0 && latest.isSuccess && <p className="muted">Chưa có tin nhắn nào.</p>}
      <form
        className="inline-form"
        onSubmit={(event) => {
          event.preventDefault();
          send.mutate();
        }}
      >
        <input maxLength={2000} placeholder="Nhắn cho cả phòng…" value={text} onChange={(event) => setText(event.target.value)} aria-label="Tin nhắn" />
        <button type="submit" disabled={send.isPending || text.trim().length === 0 || notReady}>
          Gửi
        </button>
      </form>
      <ErrorNote error={send.error ?? remove.error ?? older.error} />
    </section>
  );
}
