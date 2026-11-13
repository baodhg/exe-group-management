import { describe, expect, it } from "vitest";
import { ApiError } from "../../shared/api/apiClient";
import { deadlineInfo, errorText, formatRelative, phaseLabels, requestReasonText, requestStatusLabels, roomRequestReasonText, roomStatusLabels, signInErrorText, suggestionReasonText } from "./messages";

const errorSheet: [code: string, status: number, text: string][] = [
  ["VALIDATION_FAILED", 400, "Dữ liệu chưa hợp lệ."],
  ["UNAUTHORIZED", 401, "Phiên đăng nhập đã hết, hãy đăng nhập lại."],
  ["FORBIDDEN", 403, "Bạn không có quyền làm thao tác này."],
  ["NOT_FOUND", 404, "Không tìm thấy dữ liệu."],
  ["CONFLICT", 409, "Dữ liệu vừa thay đổi, hãy tải lại rồi thử lại."],
  ["CONCURRENCY_CONFLICT", 409, "Dữ liệu vừa thay đổi, hãy tải lại rồi thử lại."],
  ["TOO_MANY_REQUESTS", 429, "Bạn thao tác quá nhanh, hãy thử lại sau ít phút."],
  ["UPSTREAM_UNAVAILABLE", 503, "Máy chủ đang bận hoặc chưa sẵn sàng, hãy thử lại."],
  ["INTERNAL_ERROR", 500, "Máy chủ gặp lỗi, hãy thử lại."],
  ["EMAIL_TAKEN", 409, "Email đã được dùng cho tài khoản khác."],
  ["USER_CODE_TAKEN", 409, "Mã người dùng đã tồn tại."],
  ["OWN_ACCESS_PROTECTED", 409, "Không thể tự khoá hoặc bỏ quyền giáo vụ của chính mình."],
  ["SEMESTER_CODE_TAKEN", 409, "Mã học kỳ đã tồn tại."],
  ["SEMESTER_IN_USE", 409, "Học kỳ đang được dùng, không xoá được."],
  ["SUBJECT_CODE_TAKEN", 409, "Mã môn đã tồn tại."],
  ["SUBJECT_IN_USE", 409, "Môn đang được dùng, không xoá được."],
  ["MAJOR_CODE_TAKEN", 409, "Mã ngành đã tồn tại."],
  ["MAJOR_IN_USE", 409, "Ngành đang được dùng, không xoá được."],
  ["SKILL_CODE_TAKEN", 409, "Mã kỹ năng đã tồn tại."],
  ["SKILL_IN_USE", 409, "Kỹ năng đang được dùng, không xoá được."],
  ["GROUP_TYPE_CODE_TAKEN", 409, "Mã loại nhóm đã tồn tại."],
  ["GROUP_TYPE_IN_USE", 409, "Loại nhóm đang được phòng sử dụng. Không xoá hoặc đổi quy tắc ngành; hãy tạo loại nhóm mới."],
  ["COURSE_SIZE_LOCKED", 409, "Đã có phòng. Hãy xoá các phòng trong giai đoạn chuẩn bị trước khi đổi số người tối đa, rồi sinh lại phòng."],
  ["COURSE_NOT_READY", 409, "Cần có sinh viên và đủ chỗ trong các phòng trước khi mở tìm nhóm. Kiểm tra lại sức chứa phòng."],
  ["COURSE_CLASS_TAKEN", 409, "Lớp này đã có môn đó trong học kỳ."],
  ["COURSE_NOT_IN_SETUP", 409, "Lớp đã mở tìm nhóm, không còn ở giai đoạn chuẩn bị."],
  ["COURSE_FINALIZED", 409, "Lớp đã chốt nhóm, không thay đổi được nữa."],
  ["COURSE_SCHEDULE_LOCKED", 409, "Khi lớp đang mở, hạn chỉ được dời về sau."],
  ["COURSE_NOT_PUBLISHED", 409, "Lớp không ở giai đoạn tìm nhóm."],
  ["COURSE_NOT_EXPIRED", 409, "Chỉ xếp người sau khi lớp hết hạn."],
  ["STUDENT_MAJOR_LOCKED", 409, "Sinh viên đã vào phòng trong học kỳ này nên không đổi được ngành."],
  ["STUDENT_ENROLLED", 409, "Sinh viên đang ghi danh lớp, không xoá được."],
  ["STUDENT_NOT_IN_SEMESTER", 409, "Sinh viên chưa có trong học kỳ."],
  ["STUDENT_IN_ROOM", 409, "Sinh viên từng vào phòng của lớp này nên không gỡ được."],
  ["SKILLS_LOCKED", 409, "Kỹ năng đã khoá vì có lớp hết hạn."],
  ["NOT_ENROLLED", 409, "Bạn không có trong danh sách của lớp."],
  ["ALREADY_IN_ROOM", 409, "Bạn đã có phòng trong lớp này."],
  ["ROOM_LOCKED", 409, "Phòng đã khoá: hãy gửi đơn xin vào."],
  ["ROOM_NOT_LOCKED", 409, "Phòng đang mở: vào thẳng, không cần đơn."],
  ["ROOM_FULL", 409, "Phòng đã đủ người."],
  ["COMPOSITION_RULE", 409, "Vào phòng sẽ không còn đủ chỗ cho các ngành phòng còn thiếu."],
  ["REMOVED_FROM_ROOM", 409, "Trưởng nhóm đã xoá bạn khỏi phòng này, không vào lại được."],
  ["NOT_ROOM_LEADER", 403, "Chỉ trưởng nhóm làm được việc này."],
  ["NOT_ROOM_MEMBER", 409, "Người này không phải thành viên của phòng."],
  ["ROOM_NAME_TAKEN", 409, "Lớp đã có phòng trùng tên."],
  ["APPLICATION_PENDING", 409, "Bạn đã có đơn đang chờ vào phòng này."],
  ["REQUEST_NOT_PENDING", 409, "Đơn đã được xử lý."],
  ["FINALIZE_BLOCKED", 409, "Chưa chốt được: còn sinh viên chưa có phòng, hoặc còn phòng chưa đủ điều kiện mà chưa chấp nhận ngoại lệ."],
];

describe("messages", () => {
  it("covers every code on the handoff sheet", () => {
    expect(errorSheet).toHaveLength(48);
  });

  it.each(errorSheet)("shows the agreed wording for %s", (code, status, text) => {
    const message = code === "VALIDATION_FAILED" ? "" : "Server wording.";

    expect(errorText(new ApiError(status, "Server wording.", [{ code, field: null, message }], null))).toBe(text);
  });

  it("names phases and statuses in product terms", () => {
    expect(phaseLabels).toEqual({ Setup: "Chuẩn bị", Published: "Đang tìm nhóm", Expired: "Hết hạn", Finalized: "Đã chốt nhóm" });
    expect(roomStatusLabels).toEqual({ Open: "Mở", Locked: "Khoá", Finalized: "Chính thức" });
    expect(requestStatusLabels).toEqual({ Pending: "Đang chờ", Approved: "Đã duyệt", Rejected: "Bị từ chối", Cancelled: "Đã huỷ" });
    expect(requestReasonText("REJECTED_BY_LEADER")).toBe("Trưởng nhóm từ chối");
  });

  it("turns a known error code into Vietnamese", () => {
    const error = new ApiError(409, "The room has no free seat.", [{ code: "ROOM_FULL", field: null, message: "The room has no free seat." }], null);

    expect(errorText(error)).toBe("Phòng đã đủ người.");
  });

  it("never shows the server's English wording", () => {
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

    expect(errorText(unknown)).toBe("Không thực hiện được, hãy thử lại.");
    expect(errorText(invalid)).toBe("Dữ liệu chưa hợp lệ.");
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
    expect(signInErrorText(new ApiError(403, "Forbidden", [{ code: "FORBIDDEN", field: null, message: "This account is locked." }], null))).toBe("Tài khoản đang bị khoá, hãy liên hệ giáo vụ.");
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

describe("errors outside the agreed sheet", () => {
  it.each(["DUPLICATE", "BAD_REQUEST", "METHOD_NOT_ALLOWED", "NOT_ACCEPTABLE", "UNSUPPORTED_MEDIA_TYPE"])("has Vietnamese wording for %s", (code) => {
    const text = errorText(new ApiError(400, "English.", [{ code, field: null, message: "English." }], null));

    expect(text).not.toBe("English.");
    expect(text).toMatch(/[ạ-ỹ]/);
  });
});

describe("roomRequestReasonText", () => {
  it("speaks about the student when the leader reads the history", () => {
    expect(roomRequestReasonText("WITHDRAWN")).toBe("Sinh viên đã rút đơn");
    expect(roomRequestReasonText("JOINED_ANOTHER_ROOM")).toBe("Sinh viên đã vào phòng khác");
    expect(roomRequestReasonText("ROOM_FULL")).toBe("Phòng đã đủ người");
    expect(roomRequestReasonText(null)).toBe(requestReasonText(null));
  });
});
