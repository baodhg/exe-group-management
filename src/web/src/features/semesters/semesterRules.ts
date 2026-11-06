export const semesterNameMax = 100;

export interface SemesterDraft {
  code: string;
  name: string;
  startDate: string;
  endDate: string;
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

export function semesterDraftState(draft: SemesterDraft) {
  const code = draft.code.trim().toUpperCase();
  const shapeOk = /^(SP|SU|FA)[0-9]{2}$/.test(code);
  const codeBad = code !== "" && !shapeOk;
  const filled = draft.startDate !== "" && draft.endDate !== "";
  const endsTooEarly = filled && draft.endDate <= draft.startDate;
  const datesOk = filled && !endsTooEarly;
  const nameOk = draft.name.trim() !== "" && draft.name.length <= semesterNameMax;
  return { code, shapeOk, codeBad, endsTooEarly, datesOk, canSave: shapeOk && datesOk && nameOk };
}

export function dayAfter(value: string): string {
  if (!value) {
    return "";
  }

  const next = new Date(`${value}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
}

export function dateText(value: string): string {
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

export function isCurrentSemester(semester: { startDate: string; endDate: string }, today: string): boolean {
  return semester.startDate <= today && today <= semester.endDate;
}
