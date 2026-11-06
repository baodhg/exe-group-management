import { describe, expect, it } from "vitest";
import { ApiError } from "../../shared/api/apiClient";
import { courseFieldErrors, draftChanged, draftOf, expectedRooms, fromLocalInput, settingsFor, settingsOf, stuckInSetup, toLocalInput, newCourse, validateDraft } from "./courseDraft";

describe("validateDraft", () => {
  const filled = { ...newCourse, classCode: "SE1919", publishAt: "2026-11-08T08:00", expireAt: "2026-11-15T23:59" };

  it("passes a sound draft", () => {
    expect(validateDraft(filled, "Setup", filled)).toEqual({});
  });

  it("checks sizes, factor, class length and the order of the dates", () => {
    const errors = validateDraft({ ...filled, classCode: "S".repeat(31), minGroupSize: 6, maxGroupSize: 4, roomFactor: 12, expireAt: "2026-11-01T00:00" }, "Setup", filled);

    expect(errors).toEqual({
      classCode: "Lớp dài tối đa 30 ký tự.",
      maxGroupSize: "Số người tối đa không được nhỏ hơn tối thiểu.",
      roomFactor: "Hệ số phòng từ 1,00 đến 9,99.",
      expireAt: "Hạn tìm nhóm phải sau lúc mở.",
    });
    expect(validateDraft({ ...filled, minGroupSize: 0, maxGroupSize: 51 }, "Setup", filled)).toEqual({ minGroupSize: "Số người tối thiểu từ 1 đến 50.", maxGroupSize: "Số người tối đa từ 1 đến 50." });
  });

  it("lets a published course only move the deadline later", () => {
    expect(validateDraft({ ...filled, expireAt: "2026-11-14T00:00" }, "Published", filled)).toEqual({ expireAt: "Khi lớp đang mở, hạn chỉ được dời về sau." });
    expect(validateDraft({ ...filled, expireAt: "2026-11-16T00:00" }, "Published", filled)).toEqual({});
    expect(validateDraft({ ...filled, expireAt: "" }, "Published", filled)).toEqual({ expireAt: "Khi lớp đang mở, hạn chỉ được dời về sau." });
  });

  it("does not judge locked fields once the course has expired", () => {
    expect(validateDraft({ ...filled, minGroupSize: 9, maxGroupSize: 2 }, "Expired", filled)).toEqual({});
  });
});

describe("courseFieldErrors", () => {
  it("puts refusals on the field they are about", () => {
    expect(courseFieldErrors(new ApiError(409, "x", [{ code: "COURSE_CLASS_TAKEN", field: null, message: "" }], null))).toEqual({ classCode: "Lớp này đã có môn đó trong học kỳ." });
    expect(courseFieldErrors(new ApiError(409, "x", [{ code: "COURSE_SCHEDULE_LOCKED", field: null, message: "" }], null))).toEqual({ expireAt: "Khi lớp đang mở, hạn chỉ được dời về sau." });
  });

  it("translates server validation by field, whatever its case", () => {
    const error = new ApiError(400, "x", [{ code: "VALIDATION_FAILED", field: "ClassCode", message: "english" }, { code: "VALIDATION_FAILED", field: "expireAt", message: "english" }], null);

    expect(courseFieldErrors(error)).toEqual({ classCode: "Mã lớp chỉ gồm chữ, số, dấu chấm, gạch và bắt đầu bằng chữ hoặc số.", expireAt: "Hạn đã qua, hãy dời về sau." });
  });

  it("has nothing for other failures", () => {
    expect(courseFieldErrors(new Error("boom"))).toEqual({});
  });
});

describe("stuckInSetup", () => {
  const course = { phase: "Setup", publishAt: "2026-11-01T08:00:00Z", expireAt: "2026-11-05T23:59:00Z" } as const;
  const now = Date.parse("2026-11-06T00:00:00Z");

  it("spots a setup course whose open time and deadline both passed", () => {
    expect(stuckInSetup(course, now)).toBe(true);
  });

  it("leaves other courses alone", () => {
    expect(stuckInSetup({ ...course, expireAt: "2026-11-07T00:00:00Z" }, now)).toBe(false);
    expect(stuckInSetup({ ...course, publishAt: null }, now)).toBe(false);
    expect(stuckInSetup({ ...course, phase: "Published" }, now)).toBe(false);
  });
});

describe("settingsFor", () => {
  const course = { publishAt: "2026-11-01T08:00:30.000Z", expireAt: "2026-11-15T23:59:45.000Z" };
  const draft = { ...newCourse, publishAt: toLocalInput(course.publishAt), expireAt: toLocalInput(course.expireAt) };

  it("keeps the exact server time when a date was not edited, so seconds never move a deadline earlier", () => {
    expect(settingsFor(course, draft)).toMatchObject({ publishAt: course.publishAt, expireAt: course.expireAt });
  });

  it("sends the new time when a date was edited", () => {
    const edited = { ...draft, expireAt: "2026-12-01T10:00" };

    expect(settingsFor(course, edited).expireAt).toBe(new Date("2026-12-01T10:00").toISOString());
  });
});

describe("draftChanged", () => {
  it("compares every setting", () => {
    expect(draftChanged(newCourse, { ...newCourse })).toBe(false);
    expect(draftChanged(newCourse, { ...newCourse, roomFactor: 1.5 })).toBe(true);
    expect(draftOf).toBeTypeOf("function");
  });
});

describe("courseDraft", () => {
  it("round-trips a time between the API and a datetime-local input", () => {
    const iso = "2026-11-20T10:30:00.000Z";

    expect(fromLocalInput(toLocalInput(iso))).toBe(iso);
    expect(toLocalInput(null)).toBe("");
    expect(fromLocalInput("")).toBeNull();
  });

  it("sends the lecturer only together with a name and trims the class code", () => {
    expect(settingsOf({ ...newCourse, classCode: " se1801 " })).toMatchObject({ classCode: "SE1801", lecturerId: null, lecturerName: null, publishAt: null });
    expect(settingsOf({ ...newCourse, lecturerId: "l1", lecturerName: "Dr. Lan" })).toMatchObject({ lecturerId: "l1", lecturerName: "Dr. Lan" });
  });

  it("previews the number of rooms like the server (BR-03)", () => {
    expect(expectedRooms(30, 6, 1.2)).toBe(6);
    expect(expectedRooms(31, 6, 1.2)).toBe(7);
    expect(expectedRooms(13, 5, 1.2)).toBe(4);
    expect(expectedRooms(0, 6, 1.2)).toBe(0);
  });
});
