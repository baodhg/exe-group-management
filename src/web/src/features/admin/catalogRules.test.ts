import { describe, expect, it } from "vitest";
import { ApiError } from "../../shared/api/apiClient";
import { catalogCodeChecks, clampPage, deleteRefused, errorCodeOf, isAccessFailure, isNotFound, normalizeCode, numberInRange } from "./catalogRules";

const conflict = (code: string) => new ApiError(409, code, [{ code, field: null, message: code }], null);

describe("catalog rules", () => {
  it("normalizes a code the way the server stores it", () => {
    expect(normalizeCode("  exe101 ")).toBe("EXE101");
  });

  it("accepts letters, digits, dot, underscore and dash after a letter or digit", () => {
    expect(catalogCodeChecks("PRN-232_a.1", 20)).toEqual({ startsWell: true, onlyAllowed: true, shortEnough: true, patternBad: false, usable: true });
  });

  it("refuses a code with a space or a bad first character", () => {
    expect(catalogCodeChecks("EXE 101", 20)).toMatchObject({ startsWell: true, onlyAllowed: false, patternBad: true, usable: false });
    expect(catalogCodeChecks("-EXE", 20)).toMatchObject({ startsWell: false, onlyAllowed: true, patternBad: true, usable: false });
  });

  it("holds an empty code back without calling it malformed", () => {
    expect(catalogCodeChecks("   ", 20)).toMatchObject({ patternBad: false, usable: false });
  });

  it("uses the limit of the resource", () => {
    expect(catalogCodeChecks("A".repeat(10), 10).shortEnough).toBe(true);
    expect(catalogCodeChecks("A".repeat(11), 10)).toMatchObject({ shortEnough: false, usable: false });
  });

  it("reads whole numbers inside a range only", () => {
    expect(numberInRange("1", 1, 20)).toBe(true);
    expect(numberInRange("20", 1, 20)).toBe(true);
    expect(numberInRange("21", 1, 20)).toBe(false);
    expect(numberInRange("0", 1, 20)).toBe(false);
    expect(numberInRange("", 1, 20)).toBe(false);
    expect(numberInRange("1.5", 1, 20)).toBe(false);
  });

  it("treats only in-use conflicts as a final delete refusal", () => {
    expect(deleteRefused(conflict("SEMESTER_IN_USE"))).toBe(true);
    expect(deleteRefused(conflict("GROUP_TYPE_IN_USE"))).toBe(true);
    expect(deleteRefused(conflict("STUDENT_ENROLLED"))).toBe(true);
    expect(deleteRefused(conflict("CONCURRENCY_CONFLICT"))).toBe(false);
    expect(deleteRefused(new Error("network"))).toBe(false);
    expect(deleteRefused(null)).toBe(false);
  });

  it("tells a missing record and a refused page apart from other failures", () => {
    const missing = new ApiError(404, "gone", [{ code: "NOT_FOUND", field: null, message: "gone" }], null);
    const forbidden = new ApiError(403, "no", [{ code: "FORBIDDEN", field: null, message: "no" }], null);
    const broken = new ApiError(500, "bad", [{ code: "INTERNAL_ERROR", field: null, message: "bad" }], null);

    expect(isNotFound(missing)).toBe(true);
    expect(isNotFound(forbidden)).toBe(false);
    expect(isAccessFailure(missing)).toBe(true);
    expect(isAccessFailure(forbidden)).toBe(true);
    expect(isAccessFailure(broken)).toBe(false);
    expect(isAccessFailure(new Error("network"))).toBe(false);
  });

  it("reads the error code only from an API error", () => {
    expect(errorCodeOf(conflict("EMAIL_TAKEN"))).toBe("EMAIL_TAKEN");
    expect(errorCodeOf(new Error("network"))).toBeNull();
  });

  it("moves back when the last row of the last page is gone", () => {
    expect(clampPage(3, 2)).toBe(2);
    expect(clampPage(3, 0)).toBe(1);
    expect(clampPage(2, 5)).toBe(2);
  });
});
