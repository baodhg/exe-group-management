import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, LoaderCircle, Lock, MessagesSquare, SendHorizontal, Trash2, Wifi, WifiOff, X, type LucideIcon } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useAuth } from "../../shared/auth/useAuth";
import { errorText } from "../common/messages";
import { Badge, EmptyState, Failure, Notice } from "../common/ui";
import { ActionDialog } from "../rooms/ActionDialog";
import { ChatImage } from "./ChatImage";
import { canSendDraft, canSendImages, chatRows, chatViewState, connectionLook, draftCounter, imageProblem, mergeMessages, messageLimit, stillSyncing, type ChatMessage, type ConnectionLook, type MessagePage } from "./chat";
import { useRealtime } from "./realtimeContext";

const pageSize = 20;
const syncAttempts = 15;
const stickDistance = 120;

const connectionIcons: Record<ConnectionLook["kind"], LucideIcon> = { live: Wifi, retry: LoaderCircle, offline: WifiOff, readOnly: Lock };

interface PickedImage {
  file: File;
  preview: string;
}

function ChatLoading() {
  return (
    <div className="flex flex-col gap-2.5" aria-label="Đang tải">
      <Skeleton className="h-3 w-32 rounded-full" />
      <Skeleton className="h-11 w-full rounded-[10px]" />
      <Skeleton className="h-3 w-32 self-end rounded-full" />
      <Skeleton className="h-11 w-full rounded-[10px]" />
      <Skeleton className="h-3 w-32 self-end rounded-full" />
      <Skeleton className="h-11 w-full rounded-[10px]" />
    </div>
  );
}

export function ChatPanel({ conversationId, title = "Chat của phòng", readOnly = false, className }: { conversationId: string; title?: string; readOnly?: boolean; className?: string }) {
  const { api, user } = useAuth();
  const { state, onMessage } = useRealtime();
  const queryClient = useQueryClient();
  const [extra, setExtra] = useState<ChatMessage[]>([]);
  const [olderOverride, setOlderOverride] = useState<string | null | undefined>(undefined);
  const [text, setText] = useState("");
  const [picked, setPicked] = useState<PickedImage[]>([]);
  const [deleting, setDeleting] = useState<ChatMessage | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const lastSeen = useRef<string | null>(null);
  const heightBeforeOlder = useRef<number | null>(null);
  const picker = useRef<HTMLInputElement>(null);

  const latest = useQuery({
    queryKey: ["chat", conversationId],
    queryFn: () => api.get<MessagePage>(`/api/v1/conversations/${conversationId}/messages`, { pageSize }),
    retry: (count, error) => !readOnly && stillSyncing(error) && count < syncAttempts,
    retryDelay: 2_000,
  });

  const messages = useMemo(() => mergeMessages(latest.data?.data.items ?? [], extra), [latest.data, extra]);
  const rows = useMemo(() => chatRows(messages, user?.userId, readOnly), [messages, user?.userId, readOnly]);
  const olderCursor = olderOverride === undefined ? (latest.data?.data.nextBefore ?? null) : olderOverride;
  const view = chatViewState({ hasData: latest.data !== undefined, error: latest.error, failureReason: latest.failureReason });
  const look = connectionLook(state, readOnly);
  const ConnectionIcon = connectionIcons[look.kind];
  const counter = draftCounter(text);

  useEffect(() => onMessage(conversationId, (message) => setExtra((current) => mergeMessages(current, [message]))), [conversationId, onMessage]);

  useEffect(() => () => picked.forEach((image) => URL.revokeObjectURL(image.preview)), [picked]);

  useLayoutEffect(() => {
    const box = scroller.current;
    if (!box) {
      return;
    }

    if (heightBeforeOlder.current !== null) {
      box.scrollTop += box.scrollHeight - heightBeforeOlder.current;
      heightBeforeOlder.current = null;
    }

    const last = messages.at(-1);
    if (!last || last.id === lastSeen.current) {
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
      heightBeforeOlder.current = scroller.current?.scrollHeight ?? null;
      setExtra((current) => mergeMessages(current, result.data.items));
      setOlderOverride(result.data.nextBefore);
    },
    onError: (error) => toast.error(errorText(error)),
  });
  const send = useMutation({
    mutationFn: (content: string) => api.post<ChatMessage>(`/api/v1/conversations/${conversationId}/messages`, { content }),
    onSuccess: (result) => {
      setText("");
      setExtra((current) => mergeMessages(current, [result.data]));
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
    onError: (error) => {
      toast.error(errorText(error));
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
  const sendImages = useMutation({
    mutationFn: (images: PickedImage[]) => {
      const form = new FormData();
      const caption = text.trim();
      if (caption) {
        form.append("content", caption);
      }

      for (const image of images) {
        form.append("files", image.file, image.file.name);
      }

      return api.postForm<ChatMessage>(`/api/v1/conversations/${conversationId}/messages`, form);
    },
    onSuccess: (result) => {
      setText("");
      setPicked([]);
      setExtra((current) => mergeMessages(current, [result.data]));
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
    onError: (error) => {
      toast.error(errorText(error));
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
  const remove = useMutation({
    mutationFn: (message: ChatMessage) => api.delete(`/api/v1/messages/${message.id}`).then(() => message),
    onSuccess: (message) => {
      setExtra((current) => mergeMessages(current, [{ ...message, content: null, deleted: true }]));
      setDeleting(null);
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
    onError: (error) => {
      setDeleting(null);
      toast.error(errorText(error));
    },
  });

  const canSend = canSendDraft(text, view, send.isPending);
  const canSendWithImages = canSendImages(text, view, sendImages.isPending, picked.length);
  const sending = send.isPending || sendImages.isPending;

  function submit() {
    if (picked.length > 0) {
      if (canSendWithImages) {
        sendImages.mutate(picked);
      }

      return;
    }

    if (canSend) {
      send.mutate(text.trim());
    }
  }

  function submitOnEnter(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  }

  function chooseImages(event: ChangeEvent<HTMLInputElement>) {
    const files = [...(event.target.files ?? [])];
    event.target.value = "";
    const accepted: PickedImage[] = [];
    for (const file of files) {
      const problem = imageProblem(file, accepted.length);
      if (problem) {
        toast.error(problem);
        continue;
      }

      accepted.push({ file, preview: URL.createObjectURL(file) });
    }

    setPicked((current) => [...current, ...accepted].slice(0, 4));
  }

  function dropImage(preview: string) {
    setPicked((current) => {
      URL.revokeObjectURL(preview);
      return current.filter((image) => image.preview !== preview);
    });
  }

  return (
    <div className={cn("flex min-h-0 flex-col gap-2.5", className)}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-extrabold tracking-[-0.015em]">
          <MessagesSquare className="size-5 shrink-0" aria-hidden />
          {title}
        </h2>
        <span role="status">
          <Badge tone={look.tone}>
            <ConnectionIcon className={cn("size-3.5 shrink-0", look.kind === "retry" && "animate-spin")} aria-hidden />
            {look.label}
          </Badge>
        </span>
      </div>

      {look.offlineNotice && (
        <Notice tone="warn" icon={WifiOff}>
          Tin mới không tự hiện cho tới khi kết nối lại.
        </Notice>
      )}

      <div ref={scroller} className="flex h-[280px] flex-col overflow-y-auto [overflow-anchor:none] lg:h-[440px]" aria-live="polite" aria-label="Tin nhắn" aria-busy={view === "loading"}>
        <div className="mt-auto flex flex-col gap-1.5">
          {view === "loading" && <ChatLoading />}
          {view === "error" && <Failure error={latest.error} title="Không tải được tin nhắn" onRetry={() => void latest.refetch()} />}
          {view === "syncing" && (
            <div className="[&_svg]:animate-spin">
              <EmptyState icon={LoaderCircle} title="Đang thêm bạn vào chat của phòng, chờ vài giây." />
            </div>
          )}
          {view === "ready" && rows.length === 0 && <EmptyState icon={MessagesSquare} title="Chưa có tin nhắn nào" description={readOnly ? undefined : "Chào cả phòng đi!"} />}
          {view === "ready" && olderCursor && (
            <Button variant="ghost" size="sm" className="self-center" pending={older.isPending} onClick={() => older.mutate(olderCursor)}>
              {older.isPending ? "Đang tải tin cũ hơn" : "Xem tin cũ hơn"}
            </Button>
          )}
          {rows.map((row) => (
            <div key={row.id} className="contents">
              {row.day && <span className="self-center rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">{row.day}</span>}
              <div className={cn("flex max-w-[82%] flex-col items-start gap-0.5", row.mine && "items-end self-end")}>
                {row.author && <span className="text-xs font-semibold text-muted-foreground">{row.author}</span>}
                <div className={cn("flex items-center gap-1.5", row.mine && "flex-row-reverse")}>
                  <div
                    className={cn(
                      "flex max-w-full flex-col gap-1.5 rounded-xl bg-muted px-3.5 py-2.5 text-[13px]/[1.45] wrap-anywhere whitespace-pre-wrap text-foreground",
                      row.mine && "bg-primary text-primary-foreground",
                      row.deleted && "border border-dashed border-input bg-transparent text-muted-foreground italic",
                    )}
                  >
                    {row.text && <span>{row.text}</span>}
                    {row.attachments.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {row.attachments.map((attachment) => (
                          <ChatImage key={attachment.id} attachment={attachment} />
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="tabular flex-none text-[11px] text-muted-foreground">{row.time}</span>
                  {row.canDelete && (
                    <Button variant="ghost" size="icon-sm" aria-label="Xoá tin nhắn" onClick={() => setDeleting(row.message)}>
                      <Trash2 />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {readOnly ? (
        <Notice tone="info" icon={Lock}>
          Bạn không còn ở phòng này, chỉ xem được tin nhắn tới lúc rời.
        </Notice>
      ) : (
        <form
          className="flex flex-col gap-1.5"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          {picked.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {picked.map((image) => (
                <div key={image.preview} className="relative">
                  <img src={image.preview} alt={image.file.name} className="size-20 rounded-lg object-cover" />
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon-sm"
                    className="absolute -right-1.5 -top-1.5 rounded-full"
                    aria-label={`Bỏ ${image.file.name}`}
                    onClick={() => dropImage(image.preview)}
                  >
                    <X />
                  </Button>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Gửi ảnh"
              className="size-11 shrink-0"
              disabled={sending}
              onClick={() => picker.current?.click()}
            >
              <ImagePlus />
            </Button>
            <input ref={picker} type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple className="sr-only" onChange={chooseImages} />
            <Textarea
              rows={1}
              maxLength={messageLimit}
              placeholder="Nhắn cho cả phòng"
              value={text}
              readOnly={sending}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={submitOnEnter}
              aria-label="Tin nhắn"
              className="max-h-[140px] min-h-11 flex-1 resize-none px-3.5 py-2.5"
            />
            <Button type="submit" pending={sending} disabled={picked.length > 0 ? !canSendWithImages : !canSend}>
              {!sending && <SendHorizontal aria-hidden />}
              {sending ? "Đang gửi" : "Gửi"}
            </Button>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">
              {picked.length > 0 ? "Đính kèm ảnh" : "Enter để gửi, Shift + Enter để xuống dòng"}
            </span>
            <span className={cn("tabular text-xs text-muted-foreground", counter.atLimit && "text-danger-ink")}>{counter.label}</span>
          </div>
        </form>
      )}

      {deleting && (
        <ActionDialog
          title="Xoá tin nhắn này?"
          description="Mọi người trong phòng sẽ thấy tin đã bị xoá."
          icon={Trash2}
          confirmLabel="Xoá"
          pendingLabel="Đang xoá"
          destructive
          pending={remove.isPending}
          onConfirm={() => remove.mutate(deleting)}
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
