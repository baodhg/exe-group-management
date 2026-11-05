import { useQuery } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { useAuth } from "../../shared/auth/useAuth";
import type { CatalogItem, Semester, User } from "../common/types";
import type { CourseDraft } from "./courseDraft";

export function CourseForm({
  initial,
  creating,
  locked,
  busy,
  submitLabel,
  onSubmit,
}: {
  initial: CourseDraft;
  creating: boolean;
  locked: boolean;
  busy: boolean;
  submitLabel: string;
  onSubmit: (draft: CourseDraft) => void;
}) {
  const { api } = useAuth();
  const [draft, setDraft] = useState(initial);
  const semesters = useQuery({
    queryKey: ["semesters", "all"],
    queryFn: () => api.get<Semester[]>("/api/v1/semesters", { pageSize: 100, sort: "-startDate" }),
    enabled: creating,
  });
  const subjects = useQuery({
    queryKey: ["subjects", "all"],
    queryFn: () => api.get<CatalogItem[]>("/api/v1/subjects", { pageSize: 100, sort: "code" }),
    enabled: creating,
  });
  const lecturers = useQuery({ queryKey: ["users", "lecturers"], queryFn: () => api.get<User[]>("/api/v1/users", { role: "Lecturer", status: "Active", pageSize: 100, sort: "fullName" }) });

  function submit(event: FormEvent) {
    event.preventDefault();
    onSubmit(draft);
  }

  return (
    <form className="form-grid" onSubmit={submit}>
      {creating && (
        <>
          <label>
            Học kỳ
            <select required value={draft.semesterId} onChange={(event) => setDraft({ ...draft, semesterId: event.target.value })}>
              <option value="">Chọn…</option>
              {semesters.data?.data.map((semester) => (
                <option key={semester.id} value={semester.id}>
                  {semester.code} – {semester.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Môn
            <select required value={draft.subjectId} onChange={(event) => setDraft({ ...draft, subjectId: event.target.value })}>
              <option value="">Chọn…</option>
              {subjects.data?.data.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.code} – {subject.name}
                </option>
              ))}
            </select>
          </label>
        </>
      )}
      <label>
        Lớp
        <input required disabled={locked} value={draft.classCode} placeholder="VD: SE1801" onChange={(event) => setDraft({ ...draft, classCode: event.target.value })} />
      </label>
      <label>
        Giảng viên
        <select
          value={draft.lecturerId}
          onChange={(event) => {
            const lecturer = lecturers.data?.data.find((user) => user.id === event.target.value);
            setDraft({ ...draft, lecturerId: event.target.value, lecturerName: lecturer?.fullName ?? "" });
          }}
        >
          <option value="">Chưa phân công</option>
          {lecturers.data?.data.map((lecturer) => (
            <option key={lecturer.id} value={lecturer.id}>
              {lecturer.fullName} ({lecturer.email})
            </option>
          ))}
        </select>
      </label>
      <label>
        Nhóm tối thiểu
        <input type="number" min={1} disabled={locked} value={draft.minGroupSize} onChange={(event) => setDraft({ ...draft, minGroupSize: Number(event.target.value) })} />
      </label>
      <label>
        Nhóm tối đa
        <input type="number" min={1} disabled={locked} value={draft.maxGroupSize} onChange={(event) => setDraft({ ...draft, maxGroupSize: Number(event.target.value) })} />
      </label>
      <label>
        Hệ số phòng k
        <input type="number" min={1} max={9.99} step={0.01} disabled={locked} value={draft.roomFactor} onChange={(event) => setDraft({ ...draft, roomFactor: Number(event.target.value) })} />
      </label>
      <label>
        Tự publish lúc
        <input type="datetime-local" disabled={locked} value={draft.publishAt} onChange={(event) => setDraft({ ...draft, publishAt: event.target.value })} />
      </label>
      <label>
        Hạn tìm nhóm (ExpireAt)
        <input type="datetime-local" value={draft.expireAt} onChange={(event) => setDraft({ ...draft, expireAt: event.target.value })} />
      </label>
      <div className="form-actions">
        <button type="submit" disabled={busy}>
          {submitLabel}
        </button>
        {locked && <span className="muted">Đã publish: chỉ đổi được giảng viên và dời hạn về sau.</span>}
      </div>
    </form>
  );
}
