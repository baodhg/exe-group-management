import { describe, expect, it } from "vitest";
import { userDraftState, type UserDraft } from "./userRules";

const lecturer: UserDraft = { email: "lan@fpt.edu.vn", fullName: "Nguyễn Lan", userCode: "", password: "x".repeat(10), roles: ["Lecturer"] };
const none = { email: "", code: "" };

describe("user rules", () => {
  it("lets a lecturer through without a code", () => {
    expect(userDraftState(lecturer, "create", none)).toMatchObject({ codeError: "", needsCode: false, canSubmit: true });
  });

  it("requires a code for a student", () => {
    const state = userDraftState({ ...lecturer, roles: ["Student"] }, "create", none);

    expect(state).toMatchObject({ needsCode: true, codeError: "Sinh viên cần có mã.", canSubmit: false });
    expect(userDraftState({ ...lecturer, roles: ["Lecturer", "Student"], userCode: "he190023" }, "create", none)).toMatchObject({ code: "HE190023", codeError: "", canSubmit: true });
  });

  it("keeps a code within 20 characters", () => {
    expect(userDraftState({ ...lecturer, userCode: "A".repeat(21) }, "create", none)).toMatchObject({ codeTooLong: true, canSubmit: false });
  });

  it("needs a password of 8 to 100 characters on create", () => {
    expect(userDraftState({ ...lecturer, password: "x".repeat(7) }, "create", none)).toMatchObject({ passwordBad: true, canSubmit: false });
    expect(userDraftState({ ...lecturer, password: "x".repeat(8) }, "create", none)).toMatchObject({ passwordBad: false, canSubmit: true });
    expect(userDraftState({ ...lecturer, password: "x".repeat(101) }, "create", none)).toMatchObject({ passwordBad: true, canSubmit: false });
    expect(userDraftState({ ...lecturer, password: "" }, "create", none)).toMatchObject({ passwordBad: false, canSubmit: false });
  });

  it("does not ask for a password when editing", () => {
    expect(userDraftState({ ...lecturer, password: "" }, "edit", none)).toMatchObject({ passwordBad: false, canSubmit: true });
  });

  it("shows a taken email and a taken code on their fields until they change", () => {
    const taken = { email: "lan@fpt.edu.vn", code: "HE190023" };

    expect(userDraftState(lecturer, "create", taken)).toMatchObject({ emailError: "Email đã được dùng cho tài khoản khác.", canSubmit: false });
    expect(userDraftState({ ...lecturer, email: "lan2@fpt.edu.vn" }, "create", taken).emailError).toBe("");
    expect(userDraftState({ ...lecturer, userCode: "he190023" }, "edit", taken)).toMatchObject({ codeError: "Mã người dùng đã tồn tại.", canSubmit: false });
  });

  it("checks the email shape only when typing a new account", () => {
    expect(userDraftState({ ...lecturer, email: "lan" }, "create", none)).toMatchObject({ emailError: "Email chưa đúng dạng.", canSubmit: false });
  });

  it("needs at least one role and a name within 150 characters", () => {
    expect(userDraftState({ ...lecturer, roles: [] }, "create", none)).toMatchObject({ noRole: true, canSubmit: false });
    expect(userDraftState({ ...lecturer, fullName: " " }, "create", none).canSubmit).toBe(false);
    expect(userDraftState({ ...lecturer, fullName: "x".repeat(151) }, "create", none)).toMatchObject({ nameTooLong: true, canSubmit: false });
  });
});
