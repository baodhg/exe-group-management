import { useQuery } from "@tanstack/react-query";
import { useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "../../shared/auth/useAuth";
import type { CatalogItem, Semester, User } from "../common/types";
import { Field, NativeSelect, Notice } from "../common/ui";
import type { CourseDraft } from "./courseDraft";

export function CourseForm({
  initial,
  creating,
  locked,
  busy,
  submitLabel,
  onSubmit,
  extraActions,
}: {
  initial: CourseDraft;
  creating: boolean;
  locked: boolean;
  busy: boolean;
  submitLabel: string;
  onSubmit: (draft: CourseDraft) => void;
  extraActions?: ReactNode;
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
    <form className="space-y-5" onSubmit={submit}>
      {locked && <Notice tone="info">Course đã publish nên chỉ đổi được giảng viên và dời hạn tìm nhóm về sau.</Notice>}
      <div className="grid gap-4 sm:grid-cols-2">
        {creating && (
          <>
            <Field label="Học kỳ">
              <NativeSelect required value={draft.semesterId} onChange={(event) => setDraft({ ...draft, semesterId: event.target.value })}>
                <option value="">Chọn học kỳ</option>
                {semesters.data?.data.map((semester) => (
                  <option key={semester.id} value={semester.id}>
                    {semester.code}: {semester.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Môn">
              <NativeSelect required value={draft.subjectId} onChange={(event) => setDraft({ ...draft, subjectId: event.target.value })}>
                <option value="">Chọn môn</option>
                {subjects.data?.data.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.code}: {subject.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </>
        )}
        <Field label="Lớp">
          <Input required className="h-9" disabled={locked} value={draft.classCode} placeholder="VD: SE1801" onChange={(event) => setDraft({ ...draft, classCode: event.target.value })} />
        </Field>
        <Field label="Giảng viên">
          <NativeSelect
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
          </NativeSelect>
        </Field>
        <Field label="Số người tối thiểu mỗi nhóm">
          <Input type="number" className="h-9" min={1} disabled={locked} value={draft.minGroupSize} onChange={(event) => setDraft({ ...draft, minGroupSize: Number(event.target.value) })} />
        </Field>
        <Field label="Số người tối đa mỗi nhóm">
          <Input type="number" className="h-9" min={1} disabled={locked} value={draft.maxGroupSize} onChange={(event) => setDraft({ ...draft, maxGroupSize: Number(event.target.value) })} />
        </Field>
        <Field label="Hệ số phòng k" hint="Số phòng = sinh viên × k ÷ số người tối đa, làm tròn lên.">
          <Input
            type="number"
            className="h-9"
            min={1}
            max={9.99}
            step={0.01}
            disabled={locked}
            value={draft.roomFactor}
            onChange={(event) => setDraft({ ...draft, roomFactor: Number(event.target.value) })}
          />
        </Field>
        <Field label="Tự mở tìm nhóm lúc" hint="Để trống nếu muốn tự bấm Mở tìm nhóm.">
          <Input type="datetime-local" className="h-9" disabled={locked} value={draft.publishAt} onChange={(event) => setDraft({ ...draft, publishAt: event.target.value })} />
        </Field>
        <Field label="Hạn tìm nhóm">
          <Input type="datetime-local" className="h-9" value={draft.expireAt} onChange={(event) => setDraft({ ...draft, expireAt: event.target.value })} />
        </Field>
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        {extraActions}
        <Button type="submit" className="h-9" disabled={busy}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
