import { fullNameMax, passwordLengthOk } from "../account/accountRules";
import { normalizeCode } from "./catalogRules";

export const userCodeMax = 20;

export interface UserDraft {
  email: string;
  fullName: string;
  userCode: string;
  password: string;
  roles: string[];
}

export function userDraftState(draft: UserDraft, mode: "create" | "edit", taken: { email: string; code: string }) {
  const creating = mode === "create";
  const email = draft.email.trim().toLowerCase();
  const code = normalizeCode(draft.userCode);
  const needsCode = draft.roles.includes("Student");
  const codeTooLong = code.length > userCodeMax;
  const nameTooLong = draft.fullName.length > fullNameMax;
  const passwordOk = passwordLengthOk(draft.password);
  const passwordBad = creating && draft.password !== "" && !passwordOk;
  const noRole = draft.roles.length === 0;
  const emailMalformed = email !== "" && !/^\S+@\S+\.\S+$/.test(email);
  const emailTaken = creating && taken.email !== "" && taken.email === email;
  const emailError = emailTaken ? "Email đã được dùng cho tài khoản khác." : creating && emailMalformed ? "Email chưa đúng dạng." : "";
  const codeTaken = taken.code !== "" && taken.code === code;
  const codeError = codeTaken ? "Mã người dùng đã tồn tại." : needsCode && code === "" ? "Sinh viên cần có mã." : "";
  const canSubmit = email !== "" && emailError === "" && draft.fullName.trim() !== "" && !nameTooLong && codeError === "" && !codeTooLong && !noRole && (!creating || passwordOk);
  return { email, code, needsCode, codeTooLong, nameTooLong, passwordBad, noRole, emailError, codeError, canSubmit };
}
