import { describe, expect, it } from "vitest";
import { ApiError } from "../../shared/api/apiClient";
import type { ChatMessage } from "../realtime/chat";
import { conversationPreview, conversationStanding, conversationTime, isRoomGone, orderConversations, selectConversation, type Conversation } from "./conversations";

function last(change: Partial<ChatMessage> = {}): ChatMessage {
  return { id: "m", conversationId: "c", senderId: "u2", senderName: "Bình", content: "Chào cả nhóm", sentAt: "2026-11-13T10:00:00Z", deleted: false, ...change };
}

function conversation(change: Partial<Conversation> = {}): Conversation {
  return { id: "c", courseId: "k", title: "Phòng 03", joinedAt: "2026-11-01T00:00:00Z", leftAt: null, canSend: true, lastMessage: last(), ...change };
}

describe("conversationPreview", () => {
  it("prefixes the sender, or 'Bạn' for my own message", () => {
    expect(conversationPreview(conversation(), "me")).toBe("Bình: Chào cả nhóm");
    expect(conversationPreview(conversation({ lastMessage: last({ senderId: "me" }) }), "me")).toBe("Bạn: Chào cả nhóm");
  });

  it("covers a deleted last message and no message at all", () => {
    expect(conversationPreview(conversation({ lastMessage: last({ deleted: true, content: null }) }), "me")).toBe("Bình: Tin nhắn đã bị xoá");
    expect(conversationPreview(conversation({ lastMessage: null }), "me")).toBe("Chưa có tin nhắn nào");
  });
});

describe("conversationTime", () => {
  const now = new Date(2026, 10, 13, 20, 0).getTime();

  it("shows the time for today and the date otherwise", () => {
    expect(conversationTime(new Date(2026, 10, 13, 19, 40).toISOString(), now)).toBe("19:40");
    expect(conversationTime(new Date(2026, 10, 11, 19, 40).toISOString(), now)).toBe("11/11");
    expect(conversationTime(null, now)).toBe("");
  });
});

describe("orderConversations", () => {
  it("puts rooms I am in first, newest activity first inside each group", () => {
    const items = [
      conversation({ id: "former-new", canSend: false, lastMessage: last({ sentAt: "2026-11-13T00:00:00Z" }) }),
      conversation({ id: "current-old", lastMessage: last({ sentAt: "2026-11-01T00:00:00Z" }) }),
      conversation({ id: "current-new", lastMessage: last({ sentAt: "2026-11-12T00:00:00Z" }) }),
      conversation({ id: "former-silent", canSend: false, lastMessage: null, joinedAt: "2026-10-01T00:00:00Z" }),
    ];

    expect(orderConversations(items).map((item) => item.id)).toEqual(["current-new", "current-old", "former-new", "former-silent"]);
  });
});

describe("selectConversation", () => {
  const items = [conversation({ id: "a" }), conversation({ id: "b" })];

  it("opens the requested conversation, else the first", () => {
    expect(selectConversation(items, "b")?.id).toBe("b");
    expect(selectConversation(items, "missing")?.id).toBe("a");
    expect(selectConversation(items, null)?.id).toBe("a");
    expect(selectConversation([], null)).toBeNull();
  });
});

describe("conversationStanding", () => {
  it("tells a current room from a former and a deleted one", () => {
    expect(conversationStanding(conversation(), false)).toBe("current");
    expect(conversationStanding(conversation({ canSend: false }), false)).toBe("former");
    expect(conversationStanding(conversation({ canSend: false }), true)).toBe("deleted");
  });
});

describe("isRoomGone", () => {
  it("only a 404 means the room was deleted", () => {
    expect(isRoomGone(new ApiError(404, "x", [], null))).toBe(true);
    expect(isRoomGone(new ApiError(403, "x", [], null))).toBe(false);
    expect(isRoomGone(null)).toBe(false);
  });
});
