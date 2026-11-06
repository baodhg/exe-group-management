import { describe, expect, it } from "vitest";
import { mergeMessages, tokenExpired, unreadLabel, type ChatMessage } from "./chat";

function message(id: string, sentAt: string, content = "hi"): ChatMessage {
  return { id, conversationId: "c1", senderId: "u1", senderName: "An", content, sentAt, deleted: false };
}

describe("chat", () => {
  it("merges pages and pushed messages oldest first without duplicates", () => {
    const page = [message("b", "2026-11-05T10:01:00Z"), message("a", "2026-11-05T10:00:00Z")];
    const pushed = [message("c", "2026-11-05T10:02:00Z"), { ...message("b", "2026-11-05T10:01:00Z"), content: null, deleted: true }];

    const merged = mergeMessages(page, pushed);

    expect(merged.map((item) => item.id)).toEqual(["a", "b", "c"]);
    expect(merged[1]!.deleted).toBe(true);
  });

  it("refreshes the token shortly before it expires and caps the unread badge", () => {
    expect(tokenExpired(10_000, 6_000)).toBe(true);
    expect(tokenExpired(60_000, 6_000)).toBe(false);
    expect(tokenExpired(undefined, 0)).toBe(true);
    expect(unreadLabel(7)).toBe("7");
    expect(unreadLabel(150)).toBe("99+");
  });
});
