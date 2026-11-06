import { ApiError, type ApiClient } from "../../shared/api/apiClient";
import { fullNameMax } from "../account/accountRules";
import type { CatalogItem } from "../common/types";
import { foldText } from "../courses/overview";
import { courseErrorText, errorTraceText } from "./courseErrors";
import { userCodeMax } from "./userRules";

export interface StudentRow {
  email: string;
  fullName: string;
  userCode: string;
  majorCode: string;
}

export interface ParsedStudents {
  rows: StudentRow[];
  problems: string[];
}

const columns = ["email", "fullName", "userCode", "majorCode"] as const;
const emailMax = 255;

export function parseStudentCsv(text: string): ParsedStudents {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const problems: string[] = [];
  if (lines.length === 0) {
    return { rows: [], problems: ["Tệp rỗng."] };
  }

  const header = splitLine(lines[0]!).map((cell) => cell.toLowerCase());
  const positions = columns.map((column) => header.indexOf(column.toLowerCase()));
  if (positions.some((position) => position < 0)) {
    return { rows: [], problems: [`Dòng đầu phải có các cột: ${columns.join(", ")}.`] };
  }

  const rows: StudentRow[] = [];
  const seen = new Set<string>();
  const seenCodes = new Set<string>();
  lines.slice(1).forEach((line, index) => {
    const cells = splitLine(line);
    const [email, fullName, userCode, majorCode] = positions.map((position) => cells[position]?.trim() ?? "");
    const lineNo = index + 2;
    if (!email || !fullName || !userCode || !majorCode) {
      problems.push(`Dòng ${lineNo}: thiếu dữ liệu.`);
      return;
    }

    if (email.length > emailMax) {
      problems.push(`Dòng ${lineNo}: email dài quá ${emailMax} ký tự.`);
      return;
    }

    if (fullName.length > fullNameMax) {
      problems.push(`Dòng ${lineNo}: họ tên dài quá ${fullNameMax} ký tự.`);
      return;
    }

    if (userCode.length > userCodeMax) {
      problems.push(`Dòng ${lineNo}: mã "${userCode}" dài quá ${userCodeMax} ký tự.`);
      return;
    }

    if (!/^[^@\s]+@[^@\s]+$/.test(email)) {
      problems.push(`Dòng ${lineNo}: email "${email}" không hợp lệ.`);
      return;
    }

    if (seen.has(email.toLowerCase())) {
      problems.push(`Dòng ${lineNo}: email "${email}" bị lặp.`);
      return;
    }

    if (seenCodes.has(userCode.toUpperCase())) {
      problems.push(`Dòng ${lineNo}: mã "${userCode}" bị lặp.`);
      return;
    }

    seen.add(email.toLowerCase());
    seenCodes.add(userCode.toUpperCase());
    rows.push({ email, fullName, userCode: userCode.toUpperCase(), majorCode: majorCode.toUpperCase() });
  });
  return { rows, problems };
}

function splitLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index++) {
    const character = line[index]!;
    if (character === '"' && line[index + 1] === '"' && quoted) {
      current += '"';
      index++;
    } else if (character === '"') {
      quoted = !quoted;
    } else if ((character === "," || character === ";") && !quoted) {
      cells.push(current);
      current = "";
    } else {
      current += character;
    }
  }

  cells.push(current);
  return cells;
}

export interface ImportSummary {
  accountsCreated: number;
  accountsExisting: number;
  addedToSemester: number;
  updatedInSemester: number;
  enrolled: number;
  alreadyEnrolled: number;
}

export interface AccountsDone {
  created: number;
  existing: number;
}

export interface SemesterDone {
  added: number;
  updated: number;
}

export class ImportStoppedError extends Error {
  readonly stage: "semester" | "enrollment";
  override readonly cause: unknown;
  readonly accounts: AccountsDone;
  readonly semester: SemesterDone | null;

  constructor(stage: "semester" | "enrollment", cause: unknown, accounts: AccountsDone, semester: SemesterDone | null) {
    super(`Import stopped at the ${stage} step.`);
    this.name = "ImportStoppedError";
    this.stage = stage;
    this.cause = cause;
    this.accounts = accounts;
    this.semester = semester;
  }
}

export async function importStudents(
  api: Pick<ApiClient, "post">,
  { semesterId, courseId, rows, majors, defaultPassword }: { semesterId: string; courseId: string; rows: StudentRow[]; majors: CatalogItem[]; defaultPassword: string },
): Promise<ImportSummary> {
  const majorIds = new Map(majors.map((major) => [major.code.toUpperCase(), major.id]));
  const unknown = [...new Set(rows.map((row) => row.majorCode).filter((code) => !majorIds.has(code)))];
  if (unknown.length > 0) {
    throw new Error(`Chưa có ngành: ${unknown.join(", ")}. Hãy tạo ngành trước.`);
  }

  const accounts = await api.post<Array<{ email: string; userId: string; created: boolean }>>("/api/v1/users/import", {
    defaultPassword: defaultPassword || undefined,
    students: rows.map(({ email, fullName, userCode }) => ({ email, fullName, userCode })),
  });
  const accountsDone: AccountsDone = {
    created: accounts.data.filter((account) => account.created).length,
    existing: accounts.data.filter((account) => !account.created).length,
  };
  const userIds = new Map(accounts.data.map((account) => [account.email.toLowerCase(), account.userId]));
  const students = rows.map((row) => ({
    studentId: userIds.get(row.email.toLowerCase())!,
    studentCode: row.userCode,
    fullName: row.fullName,
    email: row.email,
    majorId: majorIds.get(row.majorCode)!,
  }));

  let semester: SemesterDone;
  try {
    semester = (await api.post<SemesterDone>(`/api/v1/semesters/${semesterId}/students`, { students })).data;
  } catch (error) {
    throw new ImportStoppedError("semester", error, accountsDone, null);
  }

  let enrollment: { enrolled: number; alreadyEnrolled: number };
  try {
    enrollment = (await api.post<{ enrolled: number; alreadyEnrolled: number }>(`/api/v1/courses/${courseId}/students`, { studentIds: students.map((student) => student.studentId) })).data;
  } catch (error) {
    throw new ImportStoppedError("enrollment", error, accountsDone, semester);
  }

  return {
    accountsCreated: accountsDone.created,
    accountsExisting: accountsDone.existing,
    addedToSemester: semester.added,
    updatedInSemester: semester.updated,
    enrolled: enrollment.enrolled,
    alreadyEnrolled: enrollment.alreadyEnrolled,
  };
}

export interface ImportStage {
  label: string;
  state: string;
  status: "done" | "failed" | "waiting";
}

export function importStages(stopped: ImportStoppedError, semesterCode: string, classCode: string): ImportStage[] {
  const accounts: ImportStage = { label: "Tạo hoặc dùng lại tài khoản", state: `${stopped.accounts.created} mới, ${stopped.accounts.existing} có sẵn`, status: "done" };
  const semesterLabel = `Thêm vào học kỳ ${semesterCode}`;
  const enrolLabel = `Ghi danh vào lớp ${classCode}`;
  if (stopped.stage === "semester") {
    return [accounts, { label: semesterLabel, state: "Bị từ chối", status: "failed" }, { label: enrolLabel, state: "Chưa chạy", status: "waiting" }];
  }

  return [accounts, { label: semesterLabel, state: `${stopped.semester?.added ?? 0} mới, ${stopped.semester?.updated ?? 0} cập nhật`, status: "done" }, { label: enrolLabel, state: "Thất bại", status: "failed" }];
}

export interface ImportFailure {
  text: string;
  trace: string | null;
  passwordError: string | null;
}

export function importFailureOf(failure: unknown): ImportFailure {
  const error = failure instanceof ImportStoppedError ? failure.cause : failure;
  if (!(error instanceof ApiError)) {
    return { text: error instanceof Error ? error.message : courseErrorText(error), trace: null, passwordError: null };
  }

  const trace = errorTraceText(error);
  const passwordField = error.errors.find((item) => item.field?.toLowerCase() === "defaultpassword");
  if (passwordField) {
    const email = /account (\S+)/.exec(passwordField.message)?.[1];
    return { text: "Dữ liệu chưa hợp lệ.", trace, passwordError: email ? `Tài khoản mới ${email} cần mật khẩu mặc định.` : passwordRuleText };
  }

  if (error.code === "USER_CODE_TAKEN") {
    const code = /'([^']+)'/.exec(error.message)?.[1];
    return { text: code ? `Mã người dùng đã tồn tại: ${code}.` : courseErrorText(error), trace, passwordError: null };
  }

  return { text: courseErrorText(error), trace, passwordError: null };
}

export const maxImportRows = 1000;

export function overImportCap(rows: number): boolean {
  return rows > maxImportRows;
}

const passwordRuleText = "Mật khẩu từ 8 đến 100 ký tự.";

export const maxPasswordLength = 100;

export function passwordProblem(password: string): string | null {
  return password.length > 0 && (password.length < 8 || password.length > maxPasswordLength) ? passwordRuleText : null;
}

export interface SemesterStudent {
  studentId: string;
  studentCode: string;
  fullName: string;
  email: string;
  majorId: string;
  majorCode: string;
  majorName: string;
  addedAt: string;
  courseCount: number;
}

export function enrolPool(students: readonly SemesterStudent[], enrolledIds: ReadonlySet<string>, query: string): SemesterStudent[] {
  const wanted = foldText(query.trim());
  return students.filter((student) => !enrolledIds.has(student.studentId) && foldText(`${student.studentCode} ${student.fullName} ${student.email}`).includes(wanted));
}

export function courseLoadText(courseCount: number): string {
  return courseCount === 0 ? "Chưa ở lớp nào" : `Đang học ${courseCount} lớp`;
}
