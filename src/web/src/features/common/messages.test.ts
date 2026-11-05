import { describe, expect, it } from "vitest";
import { ApiError } from "../../shared/api/apiClient";
import { errorText, requestReasonText, suggestionReasonText } from "./messages";

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
});
