import { describe, expect, it } from "vitest";
import { ApiError } from "../../shared/api/apiClient";
import { signInErrorText } from "../common/messages";
import { sessionEndedFrom, loginFailureOf, missingFieldsOf, nothingMissing, sessionEndedText } from "./loginForm";

function apiError(status: number, code: string): ApiError {
  return new ApiError(status, "Server wording", [{ code, field: null, message: "Server wording" }], null);
}

describe("loginFailureOf", () => {
  it("đánh dấu cả hai ô khi sai email hoặc mật khẩu", () => {
    expect(loginFailureOf(apiError(401, "UNAUTHORIZED"))).toEqual({ message: "Email hoặc mật khẩu không đúng.", credentialsRejected: true });
  });

  it("báo tài khoản bị khoá mà không đánh dấu ô nhập", () => {
    const locked = apiError(403, "FORBIDDEN");

    expect(loginFailureOf(locked)).toEqual({ message: signInErrorText(locked), credentialsRejected: false });
  });

  it("nhắc chờ khi bị giới hạn 429", () => {
    expect(loginFailureOf(apiError(429, "TOO_MANY_REQUESTS"))).toEqual({ message: "Bạn thao tác quá nhanh, hãy thử lại sau ít phút.", credentialsRejected: false });
  });

  it("báo lỗi cổng khi máy chủ chưa sẵn sàng", () => {
    expect(loginFailureOf(apiError(503, "UPSTREAM_UNAVAILABLE"))).toEqual({ message: "Máy chủ đang bận hoặc chưa sẵn sàng, hãy thử lại.", credentialsRejected: false });
  });

  it("báo lỗi mạng hoặc hết thời gian chờ", () => {
    expect(loginFailureOf(new TypeError("Failed to fetch"))).toEqual({ message: "Không thực hiện được, hãy thử lại.", credentialsRejected: false });
  });
});

describe("missingFieldsOf", () => {
  it("nêu từng ô còn trống", () => {
    expect(missingFieldsOf("", "")).toEqual({ email: "Hãy nhập email.", password: "Hãy nhập mật khẩu." });
  });

  it("coi email toàn khoảng trắng là trống nhưng giữ mật khẩu toàn khoảng trắng", () => {
    expect(missingFieldsOf("   ", "   ")).toEqual({ email: "Hãy nhập email.", password: null });
  });

  it("không báo gì khi đã nhập đủ", () => {
    expect(missingFieldsOf("sv23@fpt.edu.vn", "secret")).toEqual(nothingMissing);
  });
});

describe("sessionEndedFrom", () => {
  it("đúng khi route được bảo vệ gửi kèm đường dẫn cũ", () => {
    expect(sessionEndedFrom({ from: "/student", sessionEnded: true })).toBe(true);
  });

  it("sai khi vào thẳng trang đăng nhập", () => {
    expect(sessionEndedFrom(null)).toBe(false);
    expect(sessionEndedFrom(undefined)).toBe(false);
    expect(sessionEndedFrom({})).toBe(false);
    expect(sessionEndedFrom({ from: "/student", sessionEnded: false })).toBe(false);
    expect(sessionEndedFrom("/student")).toBe(false);
  });
});

describe("sessionEndedText", () => {
  it("dùng đúng lời của lỗi hết phiên", () => {
    expect(sessionEndedText).toBe("Phiên đăng nhập đã hết, hãy đăng nhập lại.");
  });
});
