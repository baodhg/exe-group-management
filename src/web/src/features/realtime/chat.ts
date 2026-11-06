import { ApiError } from "../../shared/api/apiClient";
import type { ConnectionState } from "./realtimeContext";

export const messageLimit = 2000;

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  content: string | null;
  sentAt: string;
  deleted: boolean;
}

export interface MessagePage {
  items: ChatMessage[];
  nextBefore: string | null;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  createdAt: string;
  readAt: string | null;
  courseId?: string | null;
  roomId?: string | null;
}

export interface RoomChange {
  courseId: string;
  roomId: string;
  roomName: string;
  eventType: string;
}

export function mergeMessages(existing: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const byId = new Map(existing.map((message) => [message.id, message]));
  for (const message of incoming) {
    if (!byId.get(message.id)?.deleted) {
      byId.set(message.id, message);
    }
  }

  return [...byId.values()].sort((first, second) => first.sentAt.localeCompare(second.sentAt) || first.id.localeCompare(second.id));
}

export function timeLabel(value: string): string {
  return new Date(value).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

export function dayLabel(value: string): string {
  return new Date(value).toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit" });
}

export const deletedMessageText = "Tin nhắn đã bị xoá";

export interface ChatRow {
  id: string;
  message: ChatMessage;
  day: string | null;
  author: string | null;
  mine: boolean;
  deleted: boolean;
  text: string;
  time: string;
  canDelete: boolean;
}

export function chatRows(messages: readonly ChatMessage[], userId: string | undefined, readOnly: boolean): ChatRow[] {
  return messages.map((message, index) => {
    const previous = messages[index - 1];
    const day = dayLabel(message.sentAt);
    const newDay = !previous || dayLabel(previous.sentAt) !== day;
    const newSender = newDay || previous.senderId !== message.senderId;
    const mine = message.senderId === userId;
    return {
      id: message.id,
      message,
      day: newDay ? day : null,
      author: newSender && !mine ? message.senderName || "Thành viên" : null,
      mine,
      deleted: message.deleted,
      text: message.deleted ? deletedMessageText : (message.content ?? ""),
      time: timeLabel(message.sentAt),
      canDelete: mine && !message.deleted && !readOnly,
    };
  });
}

export function stillSyncing(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 404 || error.status === 403);
}

export type ChatViewState = "loading" | "syncing" | "error" | "ready";

export function chatViewState({ hasData, error, failureReason }: { hasData: boolean; error: unknown; failureReason: unknown }): ChatViewState {
  if (hasData) {
    return "ready";
  }

  if (error) {
    return "error";
  }

  return stillSyncing(failureReason) ? "syncing" : "loading";
}

export function canSendDraft(text: string, view: ChatViewState, sending: boolean): boolean {
  const content = text.trim();
  return view === "ready" && !sending && content.length > 0 && content.length <= messageLimit;
}

export function draftCounter(text: string): { label: string; atLimit: boolean } {
  return { label: `${text.length}/${messageLimit}`, atLimit: text.length >= messageLimit };
}

export interface ConnectionLook {
  label: string;
  tone: "good" | "warn" | "bad" | "neutral";
  kind: "live" | "retry" | "offline" | "readOnly";
  offlineNotice: boolean;
}

export function connectionLook(state: ConnectionState, readOnly: boolean): ConnectionLook {
  if (readOnly) {
    return { label: "Chỉ đọc", tone: "neutral", kind: "readOnly", offlineNotice: false };
  }

  switch (state) {
    case "connected":
      return { label: "Trực tiếp", tone: "good", kind: "live", offlineNotice: false };
    case "connecting":
      return { label: "Đang kết nối", tone: "warn", kind: "retry", offlineNotice: false };
    case "reconnecting":
      return { label: "Đang kết nối lại", tone: "warn", kind: "retry", offlineNotice: false };
    default:
      return { label: "Mất kết nối", tone: "bad", kind: "offline", offlineNotice: true };
  }
}

export function tokenExpired(expiresAt: number | undefined, now: number, marginMs = 5_000): boolean {
  return expiresAt === undefined || expiresAt - marginMs <= now;
}

export function unreadLabel(count: number): string {
  return count > 99 ? "99+" : String(count);
}

export function roomChangeQueryKeys({ courseId, roomId }: Pick<RoomChange, "courseId" | "roomId">): string[][] {
  return [["rooms", courseId], ["room", roomId], ["overview", courseId], ["suggestions", courseId], ["course", courseId], ["roster", courseId], ["placementSuggestions", courseId]];
}

export function notificationQueryKeys(notification: Pick<Notification, "courseId" | "roomId">): string[][] {
  const { courseId, roomId } = notification;
  return [
    ["notifications"],
    ["joinRequests"],
    ["courses"],
    ["conversations"],
    ...(courseId ? [["course", courseId], ["rooms", courseId], ["overview", courseId], ["suggestions", courseId], ["roster", courseId], ["placementSuggestions", courseId]] : []),
    ...(roomId ? [["room", roomId]] : []),
  ];
}

export function notificationTarget(notification: Pick<Notification, "courseId" | "roomId">, roles: readonly string[]): string {
  if (notification.roomId) {
    return `/rooms/${notification.roomId}`;
  }

  if (!notification.courseId) {
    return "/notifications";
  }

  if (roles.includes("Administrator")) {
    return `/admin/courses/${notification.courseId}`;
  }

  return roles.includes("Lecturer") ? `/lecturer/courses/${notification.courseId}` : `/student/courses/${notification.courseId}`;
}
