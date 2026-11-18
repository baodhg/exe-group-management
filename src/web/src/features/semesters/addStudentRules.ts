export interface AddStudentDraft {
  fullName: string;
  studentCode: string;
  email: string;
  majorId: string;
}

export interface AddStudentProblem {
  field: "fullName" | "studentCode" | "email" | "majorId";
  text: string;
}

export const studentCodeMax = 20;
export const studentNameMax = 150;
export const studentEmailMax = 255;
export const studentPasswordMax = 100;
export const studentPasswordMin = 8;

export function emptyAddStudentDraft(): AddStudentDraft {
  return { fullName: "", studentCode: "", email: "", majorId: "" };
}

export function addStudentProblems(draft: AddStudentDraft, majors: readonly { id: string }[]): AddStudentProblem[] {
  const problems: AddStudentProblem[] = [];
  if (draft.fullName.trim() === "") {
    problems.push({ field: "fullName", text: "Cần có họ tên." });
  } else if (draft.fullName.trim().length > studentNameMax) {
    problems.push({ field: "fullName", text: `Họ tên dài tối đa ${studentNameMax} ký tự.` });
  }

  if (draft.studentCode.trim() === "") {
    problems.push({ field: "studentCode", text: "Cần có mã sinh viên." });
  } else if (draft.studentCode.trim().length > studentCodeMax) {
    problems.push({ field: "studentCode", text: `Mã sinh viên dài tối đa ${studentCodeMax} ký tự.` });
  }

  if (draft.email.trim() === "") {
    problems.push({ field: "email", text: "Cần có email." });
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim())) {
    problems.push({ field: "email", text: "Email không đúng dạng." });
  } else if (draft.email.trim().length > studentEmailMax) {
    problems.push({ field: "email", text: `Email dài tối đa ${studentEmailMax} ký tự.` });
  }

  if (draft.majorId === "") {
    problems.push({ field: "majorId", text: "Cần chọn ngành." });
  } else if (!majors.some((major) => major.id === draft.majorId)) {
    problems.push({ field: "majorId", text: "Ngành không tồn tại." });
  }

  return problems;
}

export function passwordProblem(password: string): string | null {
  if (password === "") {
    return null;
  }

  if (password.length < studentPasswordMin || password.length > studentPasswordMax) {
    return `Mật khẩu phải dài từ ${studentPasswordMin} đến ${studentPasswordMax} ký tự.`;
  }

  return null;
}
