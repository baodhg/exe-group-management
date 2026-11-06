import { describe, expect, it } from "vitest";
import { ApiError } from "../../shared/api/apiClient";
import { canSaveName, passwordLengthOk, wrongCurrentPassword } from "./accountRules";

describe("account rules", () => {
  it("allows a new password of 8 to 100 characters", () => {
    expect(passwordLengthOk("x".repeat(7))).toBe(false);
    expect(passwordLengthOk("x".repeat(8))).toBe(true);
    expect(passwordLengthOk("x".repeat(100))).toBe(true);
    expect(passwordLengthOk("x".repeat(101))).toBe(false);
  });

  it("recognizes the field error of a wrong current password", () => {
    const wrong = new ApiError(400, "invalid", [{ code: "VALIDATION_FAILED", field: "currentPassword", message: "The current password is incorrect." }], null);
    const other = new ApiError(400, "invalid", [{ code: "VALIDATION_FAILED", field: "newPassword", message: "Too short." }], null);

    expect(wrongCurrentPassword(wrong)).toBe(true);
    expect(wrongCurrentPassword(other)).toBe(false);
    expect(wrongCurrentPassword(new Error("network"))).toBe(false);
  });

  it("saves a name only when it changed and fits", () => {
    expect(canSaveName("Minh Anh", "Minh Anh")).toBe(false);
    expect(canSaveName(" Minh Anh ", "Minh Anh")).toBe(false);
    expect(canSaveName("Minh", "Minh Anh")).toBe(true);
    expect(canSaveName("  ", "Minh Anh")).toBe(false);
    expect(canSaveName("x".repeat(151), "Minh Anh")).toBe(false);
  });
});
