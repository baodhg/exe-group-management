import { ApiError } from "../../shared/api/apiClient";
import { deletedMessageText, timeLabel, type ChatMessage } from "../realtime/chat";
import { dayMonth } from "../rooms/roomActions";

export interface Conversation {
  id: string;
  courseId: string;
  title: string;
  joinedAt: string;
  leftAt: string | null;
  canSend: boolean;
  lastMessage: ChatMessage | null;
}

export function conversationPreview(conversation: Pick<Conversation, "lastMessage">, userId: string | undefined): string {
  const last = conversation.lastMessage;
  if (!last) {
    return "Chưa có tin nhắn nào";
  }

  const who = last.senderId === userId ? "Bạn" : last.senderName || "Thành viên";
  return `${who}: ${last.deleted ? deletedMessageText : (last.content ?? "")}`;
}

export function conversationTime(value: string | null, now: number = Date.now()): string {
  if (!value) {
    return "";
  }

  return new Date(value).toDateString() === new Date(now).toDateString() ? timeLabel(value) : dayMonth(value);
}

function lastActivity(conversation: Pick<Conversation, "lastMessage" | "joinedAt">): number {
  return new Date(conversation.lastMessage?.sentAt ?? conversation.joinedAt).getTime();
}

export function orderConversations(conversations: readonly Conversation[]): Conversation[] {
  return [...conversations].sort((first, second) => Number(second.canSend) - Number(first.canSend) || lastActivity(second) - lastActivity(first));
}

export function selectConversation(conversations: readonly Conversation[], wanted: string | null): Conversation | null {
  return conversations.find((conversation) => conversation.id === wanted) ?? conversations[0] ?? null;
}

export type ConversationStanding = "current" | "former" | "deleted";

export function conversationStanding(conversation: Pick<Conversation, "canSend">, roomGone: boolean): ConversationStanding {
  if (conversation.canSend) {
    return "current";
  }

  return roomGone ? "deleted" : "former";
}

export function isRoomGone(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}
