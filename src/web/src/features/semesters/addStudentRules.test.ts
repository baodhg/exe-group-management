import { describe, expect, it } from "vitest";
import { addStudentProblems, emptyAddStudentDraft, passwordProblem, type AddStudentDraft } from "./addStudentRules";

const majors = [
  { id: "se", code: "SE" },
  { id: "mkt", code: "MKT" },
];

function draft(change: Partial<AddStudentDraft> = {}): AddStudentDraft {
  return { ...emptyAddStudentDraft(), fullName: "An Nguyễn", studentCode: "SE123456", email: "an@fpt.edu.vn", majorId: "se", ...change };
}

describe("addStudentProblems", () => {
  it("accepts a complete student", () => {
    expect(addStudentProblems(draft(), majors)).toEqual([]);
  });

  it("asks for every missing field", () => {
    const problems = addStudentProblems(emptyAddStudentDraft(), majors);

    expect(problems.map((problem) => problem.field)).toEqual(["fullName", "studentCode", "email", "majorId"]);
  });

  it("rejects an email that is not an address", () => {
    expect(addStudentProblems(draft({ email: "an-at-fpt" }), majors)).toEqual([{ field: "email", text: "Email không đúng dạng." }]);
  });

  it("rejects a major that does not exist", () => {
    expect(addStudentProblems(draft({ majorId: "unknown" }), majors)).toEqual([{ field: "majorId", text: "Ngành không tồn tại." }]);
  });

  it("rejects a name longer than the limit", () => {
    const problems = addStudentProblems(draft({ fullName: "a".repeat(151) }), majors);

    expect(problems).toEqual([{ field: "fullName", text: "Họ tên dài tối đa 150 ký tự." }]);
  });

  it("rejects a student code longer than the limit", () => {
    const problems = addStudentProblems(draft({ studentCode: "s".repeat(21) }), majors);

    expect(problems).toEqual([{ field: "studentCode", text: "Mã sinh viên dài tối đa 20 ký tự." }]);
  });
});

describe("passwordProblem", () => {
  it("lets an empty password through for an existing account", () => {
    expect(passwordProblem("")).toBeNull();
  });

  it("asks for at least eight characters", () => {
    expect(passwordProblem("short")).toBe("Mật khẩu phải dài từ 8 đến 100 ký tự.");
  });

  it("refuses more than a hundred characters", () => {
    expect(passwordProblem("p".repeat(101))).toBe("Mật khẩu phải dài từ 8 đến 100 ký tự.");
  });

  it("accepts a password of the right size", () => {
    expect(passwordProblem("p".repeat(8))).toBeNull();
    expect(passwordProblem("p".repeat(100))).toBeNull();
  });
});
