import { describe, expect, it } from "vitest";
import { ApiError } from "../../shared/api/apiClient";
import { deadlineInfo, errorText, formatRelative, requestReasonText, signInErrorText, suggestionReasonText } from "./messages";

describe("messages", () => {
  it("turns a known error code into Vietnamese", () => {
    const error = new ApiError(409, "The room has no free seat.", [{ code: "ROOM_FULL", field: null, message: "The room has no free seat." }], null);

    expect(errorText(error)).toBe("Phòng đã đủ người.");
  });

  it("shows the server message for an unknown code and field messages for validation errors", () => {
    const unknown = new ApiError(409, "Something new.", [{ code: "BRAND_NEW", field: null, message: "Something new." }], null);
    const invalid = new ApiError(
      400,
      "Validation failed",
      [
        { code: "VALIDATION_FAILED", field: "reason", message: "Give a reason." },
        { code: "VALIDATION_FAILED", field: "name", message: "Name is required." },
      ],
      null,
    );

    expect(errorText(unknown)).toBe("Something new.");
    expect(errorText(invalid)).toBe("Give a reason. Name is required.");
    expect(errorText(new Error("network"))).toBe("Không thực hiện được, hãy thử lại.");
  });

  it("explains suggestion and application reasons in Vietnamese", () => {
    expect(suggestionReasonText("MAJOR_NEEDED", "AI")).toBe("Phòng còn cần ngành AI");
    expect(suggestionReasonText("SKILL_GAP", "BE")).toBe("Bạn mạnh hơn phòng về BE");
    expect(suggestionReasonText("BELOW_MINIMUM", "1/4")).toBe("Phòng chưa đủ người tối thiểu (1/4)");
    expect(requestReasonText("JOINED_ANOTHER_ROOM")).toBe("Bạn đã vào phòng khác");
    expect(requestReasonText(null)).toBe("");
  });

  it("says how long ago something happened", () => {
    const now = Date.parse("2026-11-06T10:00:00Z");
    expect(formatRelative("2026-11-06T09:59:40Z", now)).toBe("vừa xong");
    expect(formatRelative("2026-11-06T09:55:00Z", now)).toBe("5 phút trước");
    expect(formatRelative("2026-11-06T07:00:00Z", now)).toBe("3 giờ trước");
    expect(formatRelative("2026-11-05T10:00:00Z", now)).toMatch(/^hôm qua$/i);
    expect(formatRelative(null, now)).toBe("—");
  });

  it("explains a failed sign-in without leaking the server wording", () => {
    expect(signInErrorText(new ApiError(401, "Unauthorized", [{ code: "UNAUTHORIZED", field: null, message: "The e-mail or password is incorrect." }], null))).toBe("Email hoặc mật khẩu không đúng.");
    expect(signInErrorText(new ApiError(403, "Forbidden", [{ code: "FORBIDDEN", field: null, message: "This account is locked." }], null))).toBe("Tài khoản đang bị khóa, hãy liên hệ quản trị viên.");
    expect(signInErrorText(new ApiError(429, "Too many", [{ code: "TOO_MANY_REQUESTS", field: null, message: "Slow down." }], null))).toBe("Bạn thao tác quá nhanh, hãy thử lại sau ít phút.");
  });

  it("counts down to the grouping deadline", () => {
    const now = Date.parse("2026-11-06T10:00:00Z");
    expect(deadlineInfo(null, now)).toBeNull();
    expect(deadlineInfo("2026-11-06T09:00:00Z", now)).toEqual({ text: "Đã hết hạn", urgent: false, passed: true });
    expect(deadlineInfo("2026-11-06T10:20:00Z", now)).toEqual({ text: "Còn 20 phút", urgent: true, passed: false });
    expect(deadlineInfo("2026-11-07T15:00:00Z", now)).toEqual({ text: "Còn 29 giờ", urgent: true, passed: false });
    expect(deadlineInfo("2026-11-10T10:00:00Z", now)).toEqual({ text: "Còn 4 ngày", urgent: false, passed: false });
  });
});
