import { describe, expect, it } from "vitest";
import { dateText, dayAfter, isCurrentSemester, semesterDraftState } from "./semesterRules";

const filled = { code: "fa27", name: "Fall 2027", startDate: "2027-09-06", endDate: "2027-12-25" };

describe("semester rules", () => {
  it("accepts SP, SU or FA with two digits, in any case", () => {
    expect(semesterDraftState(filled)).toMatchObject({ code: "FA27", shapeOk: true, codeBad: false, canSave: true });
    expect(semesterDraftState({ ...filled, code: "SP26" }).shapeOk).toBe(true);
    expect(semesterDraftState({ ...filled, code: "su26" }).shapeOk).toBe(true);
  });

  it("refuses any other code shape", () => {
    expect(semesterDraftState({ ...filled, code: "WI27" })).toMatchObject({ shapeOk: false, codeBad: true, canSave: false });
    expect(semesterDraftState({ ...filled, code: "FA2027" })).toMatchObject({ shapeOk: false, codeBad: true, canSave: false });
  });

  it("holds an empty code back without an error", () => {
    expect(semesterDraftState({ ...filled, code: " " })).toMatchObject({ shapeOk: false, codeBad: false, canSave: false });
  });

  it("needs the end strictly after the start", () => {
    expect(semesterDraftState({ ...filled, endDate: filled.startDate })).toMatchObject({ endsTooEarly: true, datesOk: false, canSave: false });
    expect(semesterDraftState({ ...filled, endDate: "2027-09-05" })).toMatchObject({ endsTooEarly: true, canSave: false });
    expect(semesterDraftState({ ...filled, endDate: "2027-09-07" })).toMatchObject({ endsTooEarly: false, datesOk: true, canSave: true });
  });

  it("does not complain about dates that are still empty", () => {
    expect(semesterDraftState({ ...filled, endDate: "" })).toMatchObject({ endsTooEarly: false, datesOk: false, canSave: false });
  });

  it("needs a name of at most 100 characters", () => {
    expect(semesterDraftState({ ...filled, name: "   " }).canSave).toBe(false);
    expect(semesterDraftState({ ...filled, name: "x".repeat(100) }).canSave).toBe(true);
    expect(semesterDraftState({ ...filled, name: "x".repeat(101) }).canSave).toBe(false);
  });

  it("gives the first allowed end date across a month", () => {
    expect(dayAfter("2027-01-31")).toBe("2027-02-01");
    expect(dayAfter("")).toBe("");
  });

  it("shows dates in day, month, year order", () => {
    expect(dateText("2026-09-07")).toBe("07/09/2026");
  });

  it("marks the semester running today, boundaries included", () => {
    const semester = { startDate: "2026-09-07", endDate: "2026-12-26" };
    expect(isCurrentSemester(semester, "2026-09-07")).toBe(true);
    expect(isCurrentSemester(semester, "2026-12-26")).toBe(true);
    expect(isCurrentSemester(semester, "2026-12-27")).toBe(false);
  });
});
