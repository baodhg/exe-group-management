import { describe, expect, it } from "vitest";
import { ApiError } from "../../shared/api/apiClient";
import { notificationQueryKeys, canSendDraft, chatRows, chatViewState, connectionLook, dayLabel, draftCounter, mergeMessages, notificationTarget, stillSyncing, timeLabel, tokenExpired, unreadLabel, type ChatMessage } from "./chat";

function message(id: string, sentAt: string, content = "hi"): ChatMessage {
  return { id, conversationId: "c1", senderId: "u1", senderName: "An", content, sentAt, deleted: false };
}

function apiError(status: number): ApiError {
  return new ApiError(status, "failed", [{ code: "X", field: null, message: "failed" }], null);
}

describe("chat", () => {
  it("merges pages and pushed messages oldest first without duplicates", () => {
    const page = [message("b", "2026-11-05T10:01:00Z"), message("a", "2026-11-05T10:00:00Z")];
    const pushed = [message("c", "2026-11-05T10:02:00Z"), { ...message("b", "2026-11-05T10:01:00Z"), content: null, deleted: true }];

    const merged = mergeMessages(page, pushed);

    expect(merged.map((item) => item.id)).toEqual(["a", "b", "c"]);
    expect(merged[1]!.deleted).toBe(true);
  });

  it("keeps a deleted message deleted when an older copy arrives later", () => {
    const deleted = { ...message("a", "2026-11-05T10:00:00Z"), content: null, deleted: true };

    const merged = mergeMessages([deleted], [message("a", "2026-11-05T10:00:00Z")]);

    expect(merged[0]!.deleted).toBe(true);
    expect(merged[0]!.content).toBeNull();
  });

  it("refreshes the token shortly before it expires and caps the unread badge", () => {
    expect(tokenExpired(10_000, 6_000)).toBe(true);
    expect(tokenExpired(60_000, 6_000)).toBe(false);
    expect(tokenExpired(undefined, 0)).toBe(true);
    expect(unreadLabel(7)).toBe("7");
    expect(unreadLabel(150)).toBe("99+");
  });
});

describe("chatRows", () => {
  const friday = (hour: number, minute = 0) => new Date(2026, 10, 13, hour, minute).toISOString();
  const thursday = (hour: number) => new Date(2026, 10, 12, hour, 0).toISOString();
  const from = (id: string, senderId: string, sentAt: string): ChatMessage => ({ ...message(id, sentAt), senderId, senderName: senderId === "me" ? "Tôi" : "Bình" });

  it("marks a new day and repeats the author only when the sender or day changes", () => {
    const rows = chatRows([from("1", "u2", thursday(20)), from("2", "u2", thursday(21)), from("3", "u2", friday(9)), from("4", "u3", friday(10))], "me", false);

    expect(rows.map((row) => row.day)).toEqual([dayLabel(thursday(20)), null, dayLabel(friday(9)), null]);
    expect(rows.map((row) => row.author)).toEqual(["Bình", null, "Bình", "Bình"]);
  });

  it("hides my own name and offers deleting only my own live messages", () => {
    const deleted: ChatMessage = { ...from("2", "me", friday(9, 1)), content: null, deleted: true };
    const rows = chatRows([from("1", "me", friday(9)), deleted, from("3", "u2", friday(10))], "me", false);

    expect(rows[0]).toMatchObject({ mine: true, author: null, canDelete: true, text: "hi" });
    expect(rows[1]).toMatchObject({ mine: true, canDelete: false, deleted: true, text: "Tin nhắn đã bị xoá" });
    expect(rows[2]).toMatchObject({ mine: false, canDelete: false });
  });

  it("offers no delete to a former member", () => {
    expect(chatRows([from("1", "me", friday(9))], "me", true)[0]!.canDelete).toBe(false);
  });

  it("falls back to a generic name when the sender has none", () => {
    expect(chatRows([{ ...message("1", friday(9)), senderName: "" }], "me", false)[0]!.author).toBe("Thành viên");
  });

  it("formats the time and the day label", () => {
    expect(timeLabel(friday(19, 40))).toBe("19:40");
    expect(dayLabel(friday(9))).toBe("Thứ Sáu, 13/11");
  });
});

describe("chatViewState", () => {
  it("shows messages whenever there is data, even while a refetch fails", () => {
    expect(chatViewState({ hasData: true, error: apiError(500), failureReason: apiError(500) })).toBe("ready");
  });

  it("shows the syncing note while a new member's access is being retried", () => {
    expect(chatViewState({ hasData: false, error: null, failureReason: apiError(403) })).toBe("syncing");
    expect(chatViewState({ hasData: false, error: null, failureReason: apiError(404) })).toBe("syncing");
  });

  it("stops syncing and shows the failure when retries run out", () => {
    expect(chatViewState({ hasData: false, error: apiError(403), failureReason: apiError(403) })).toBe("error");
    expect(chatViewState({ hasData: false, error: apiError(500), failureReason: apiError(500) })).toBe("error");
  });

  it("is loading before any answer", () => {
    expect(chatViewState({ hasData: false, error: null, failureReason: null })).toBe("loading");
  });

  it("recognises only access errors as syncing", () => {
    expect(stillSyncing(apiError(403))).toBe(true);
    expect(stillSyncing(apiError(500))).toBe(false);
    expect(stillSyncing(new Error("offline"))).toBe(false);
  });
});

describe("draft", () => {
  it("allows sending only a non blank text when the chat is ready and idle", () => {
    expect(canSendDraft("xin chào", "ready", false)).toBe(true);
    expect(canSendDraft("   ", "ready", false)).toBe(false);
    expect(canSendDraft("xin chào", "syncing", false)).toBe(false);
    expect(canSendDraft("xin chào", "ready", true)).toBe(false);
    expect(canSendDraft("x".repeat(2001), "ready", false)).toBe(false);
  });

  it("counts towards the limit and flags reaching it", () => {
    expect(draftCounter("abc")).toEqual({ label: "3/2000", atLimit: false });
    expect(draftCounter("x".repeat(2000))).toEqual({ label: "2000/2000", atLimit: true });
  });
});

describe("connectionLook", () => {
  it("maps each hub state to a label and tone", () => {
    expect(connectionLook("connected", false)).toMatchObject({ label: "Trực tiếp", tone: "good", kind: "live", offlineNotice: false });
    expect(connectionLook("connecting", false)).toMatchObject({ label: "Đang kết nối", tone: "warn", kind: "retry" });
    expect(connectionLook("reconnecting", false)).toMatchObject({ label: "Đang kết nối lại", tone: "warn", kind: "retry" });
    expect(connectionLook("disconnected", false)).toMatchObject({ label: "Mất kết nối", tone: "bad", kind: "offline", offlineNotice: true });
  });

  it("shows read-only instead of the connection for a former member", () => {
    expect(connectionLook("disconnected", true)).toMatchObject({ label: "Chỉ đọc", tone: "neutral", kind: "readOnly", offlineNotice: false });
  });
});

describe("notificationTarget", () => {
  it("opens the room when the notification names one", () => {
    expect(notificationTarget({ courseId: "c", roomId: "r" }, ["Student"])).toBe("/rooms/r");
  });

  it("opens the course page of the reader's role", () => {
    expect(notificationTarget({ courseId: "c", roomId: null }, ["Student"])).toBe("/student/courses/c");
    expect(notificationTarget({ courseId: "c", roomId: null }, ["Lecturer"])).toBe("/lecturer/courses/c");
  });

  it("falls back to the list for old notifications with no target", () => {
    expect(notificationTarget({ courseId: null, roomId: null }, ["Student"])).toBe("/notifications");
  });
});

describe("notificationQueryKeys", () => {
  it("refreshes what a push can change for its course and room", () => {
    const keys = notificationQueryKeys({ courseId: "c1", roomId: "r1" });

    expect(keys).toContainEqual(["notifications"]);
    expect(keys).toContainEqual(["joinRequests"]);
    expect(keys).toContainEqual(["courses"]);
    expect(keys).toContainEqual(["course", "c1"]);
    expect(keys).toContainEqual(["rooms", "c1"]);
    expect(keys).toContainEqual(["overview", "c1"]);
    expect(keys).toContainEqual(["room", "r1"]);
  });

  it("refreshes only shared lists when a push has no target", () => {
    expect(notificationQueryKeys({ courseId: null, roomId: null })).toEqual([["notifications"], ["joinRequests"], ["courses"]]);
  });
});
