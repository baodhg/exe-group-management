import { describe, expect, it } from "vitest";
import { ApiError } from "../../shared/api/apiClient";
import { courseErrorText, errorTraceText } from "./courseErrors";

const apiError = (code: string, status = 409, traceId: string | null = null) => new ApiError(status, "x", [{ code, field: null, message: "english" }], traceId);

describe("courseErrorText", () => {
  it("uses the product terms for the codes these screens surface", () => {
    expect(courseErrorText(apiError("COURSE_NOT_IN_SETUP"))).toBe("Lớp đã mở, không còn ở giai đoạn chuẩn bị.");
    expect(courseErrorText(apiError("ROOM_NAME_TAKEN"))).toBe("Lớp đã có phòng trùng tên.");
    expect(courseErrorText(apiError("STUDENT_IN_ROOM"))).toBe("Sinh viên từng vào phòng của lớp này nên không gỡ được.");
  });

  it("falls back to the shared wording", () => {
    expect(courseErrorText(apiError("ROOM_FULL"))).toBe("Phòng đã đủ người.");
    expect(courseErrorText(new Error("boom"))).toBe("Không thực hiện được, hãy thử lại.");
  });
});

describe("errorTraceText", () => {
  it("quotes the code, and the trace when the server sent one", () => {
    expect(errorTraceText(apiError("ROOM_FULL"))).toBe("Mã lỗi ROOM_FULL");
    expect(errorTraceText(apiError("INTERNAL_ERROR", 500, "00-ab"))).toBe("Mã lỗi INTERNAL_ERROR, mã tra cứu 00-ab");
  });

  it("has nothing to quote for a local error", () => {
    expect(errorTraceText(new Error("boom"))).toBeNull();
  });
});
