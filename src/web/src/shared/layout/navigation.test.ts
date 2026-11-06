import { describe, expect, it } from "vitest";
import { initialsOf } from "./navigation";

describe("initialsOf", () => {
  it("takes the first and last word of a Vietnamese name", () => {
    expect(initialsOf("Nguyễn Văn An")).toBe("NA");
    expect(initialsOf("đặng thị ánh")).toBe("ĐÁ");
  });

  it("handles one word and empty names", () => {
    expect(initialsOf("Admin")).toBe("A");
    expect(initialsOf("  ")).toBe("?");
    expect(initialsOf(null, "U")).toBe("U");
  });
});
