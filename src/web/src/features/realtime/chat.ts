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
    byId.set(message.id, message);
  }

  return [...byId.values()].sort((first, second) => first.sentAt.localeCompare(second.sentAt) || first.id.localeCompare(second.id));
}

export function tokenExpired(expiresAt: number | undefined, now: number, marginMs = 5_000): boolean {
  return expiresAt === undefined || expiresAt - marginMs <= now;
}

export function unreadLabel(count: number): string {
  return count > 99 ? "99+" : String(count);
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
