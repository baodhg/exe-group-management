import type { ApiClient } from "../../shared/api/apiClient";
import type { CatalogItem } from "../common/types";

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
  lines.slice(1).forEach((line, index) => {
    const cells = splitLine(line);
    const [email, fullName, userCode, majorCode] = positions.map((position) => cells[position]?.trim() ?? "");
    const lineNo = index + 2;
    if (!email || !fullName || !userCode || !majorCode) {
      problems.push(`Dòng ${lineNo}: thiếu dữ liệu.`);
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

    seen.add(email.toLowerCase());
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
    defaultPassword,
    students: rows.map(({ email, fullName, userCode }) => ({ email, fullName, userCode })),
  });
  const userIds = new Map(accounts.data.map((account) => [account.email.toLowerCase(), account.userId]));
  const students = rows.map((row) => ({
    studentId: userIds.get(row.email.toLowerCase())!,
    studentCode: row.userCode,
    fullName: row.fullName,
    email: row.email,
    majorId: majorIds.get(row.majorCode)!,
  }));
  const semester = await api.post<{ added: number; updated: number }>(`/api/v1/semesters/${semesterId}/students`, { students });
  const enrollment = await api.post<{ enrolled: number; alreadyEnrolled: number }>(`/api/v1/courses/${courseId}/students`, {
    studentIds: students.map((student) => student.studentId),
  });
  return {
    accountsCreated: accounts.data.filter((account) => account.created).length,
    accountsExisting: accounts.data.filter((account) => !account.created).length,
    addedToSemester: semester.data.added,
    updatedInSemester: semester.data.updated,
    enrolled: enrollment.data.enrolled,
    alreadyEnrolled: enrollment.data.alreadyEnrolled,
  };
}
