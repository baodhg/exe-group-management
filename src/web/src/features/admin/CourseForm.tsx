import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "../../shared/auth/useAuth";
import type { CatalogItem, CoursePhase, Semester, User } from "../common/types";
import { Field, NativeSelect } from "../common/ui";
import { maxClassCodeLength, type CourseDraft, type CourseFieldErrors } from "./courseDraft";

export function LecturerSelect({ lecturerId, lecturerName, disabled, onChange }: { lecturerId: string; lecturerName: string; disabled?: boolean; onChange: (lecturerId: string, lecturerName: string) => void }) {
  const { api } = useAuth();
  const lecturers = useQuery({ queryKey: ["users", "lecturers"], queryFn: () => api.get<User[]>("/api/v1/users", { role: "Lecturer", status: "Active", pageSize: 100, sort: "fullName" }) });
  const items = lecturers.data?.data ?? [];
  const known = lecturerId === "" || items.some((lecturer) => lecturer.id === lecturerId);

  return (
    <Field label="Giảng viên" error={lecturers.isError ? "Không tải được danh sách giảng viên." : undefined}>
      <NativeSelect
        value={lecturerId}
        disabled={disabled}
        onChange={(event) => {
          const lecturer = items.find((user) => user.id === event.target.value);
          onChange(event.target.value, lecturer?.fullName ?? "");
        }}
      >
        <option value="">Chưa phân công</option>
        {!known && <option value={lecturerId}>{lecturerName}</option>}
        {items.map((lecturer) => (
          <option key={lecturer.id} value={lecturer.id}>
            {lecturer.fullName} ({lecturer.email})
          </option>
        ))}
      </NativeSelect>
    </Field>
  );
}

const factors = [1, 1.2, 1.5];

function factorText(value: number): string {
  return String(value).replace(".", ",");
}

export function FactorButtons({ value, disabled, onChange }: { value: number; disabled?: boolean; onChange: (value: number) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] font-bold">Hệ số phòng dư</span>
        <div role="group" aria-label="Hệ số phòng dư" className="flex gap-1">
          {factors.map((factor) => (
            <Button key={factor} type="button" size="sm" variant={factor === value ? "default" : "outline"} aria-pressed={factor === value} disabled={disabled} onClick={() => onChange(factor)}>
              {factorText(factor)}
            </Button>
          ))}
        </div>
      </div>
      <p className="min-w-0 flex-1 basis-56 text-xs text-muted-foreground">
        Thêm phòng cho sinh viên nhiều lựa chọn hơn, nhưng dễ có phòng lẻ người.
        {!factors.includes(value) && ` Lớp đang đặt hệ số ${factorText(value)}.`}
      </p>
    </div>
  );
}

export function CourseForm({
  draft,
  onChange,
  errors,
  creating,
  phase,
}: {
  draft: CourseDraft;
  onChange: (draft: CourseDraft, field: keyof CourseDraft) => void;
  errors: CourseFieldErrors;
  creating: boolean;
  phase: CoursePhase;
}) {
  const { api } = useAuth();
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
  const lockSetup = phase !== "Setup";
  const lockExpire = phase === "Expired" || phase === "Finalized";
  const set = <K extends keyof CourseDraft>(field: K, value: CourseDraft[K]) => onChange({ ...draft, [field]: value }, field);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {creating && (
        <>
          <Field label="Học kỳ" error={semesters.isError ? "Không tải được danh sách học kỳ." : undefined}>
            <NativeSelect required value={draft.semesterId} onChange={(event) => set("semesterId", event.target.value)}>
              <option value="">Chọn học kỳ</option>
              {semesters.data?.data.map((semester) => (
                <option key={semester.id} value={semester.id}>
                  {semester.code}: {semester.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Môn học" error={subjects.isError ? "Không tải được danh sách môn học." : undefined}>
            <NativeSelect required value={draft.subjectId} onChange={(event) => set("subjectId", event.target.value)}>
              <option value="">Chọn môn học</option>
              {subjects.data?.data.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.code}: {subject.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </>
      )}
      <Field label="Lớp" error={errors.classCode} counter={{ value: draft.classCode.trim().length, max: maxClassCodeLength }}>
        <Input required disabled={lockSetup} maxLength={maxClassCodeLength + 10} value={draft.classCode} placeholder="VD: SE1924" onChange={(event) => set("classCode", event.target.value)} />
      </Field>
      <LecturerSelect
        lecturerId={draft.lecturerId}
        lecturerName={draft.lecturerName}
        disabled={phase === "Finalized"}
        onChange={(lecturerId, lecturerName) => onChange({ ...draft, lecturerId, lecturerName }, "lecturerId")}
      />
      <Field label="Số người tối thiểu mỗi nhóm" error={errors.minGroupSize}>
        <Input type="number" min={1} max={50} disabled={lockSetup} value={draft.minGroupSize} onChange={(event) => set("minGroupSize", Number(event.target.value))} />
      </Field>
      <Field label="Số người tối đa mỗi nhóm" error={errors.maxGroupSize}>
        <Input type="number" min={1} max={50} disabled={lockSetup} value={draft.maxGroupSize} onChange={(event) => set("maxGroupSize", Number(event.target.value))} />
      </Field>
      {creating && (
        <Field label="Hệ số phòng k" hint="Số phòng = sinh viên × k ÷ số người tối đa, làm tròn lên." error={errors.roomFactor}>
          <Input type="number" min={1} max={9.99} step={0.01} value={draft.roomFactor} onChange={(event) => set("roomFactor", Number(event.target.value))} />
        </Field>
      )}
      <Field label="Tự mở tìm nhóm lúc" hint="Để trống nếu muốn tự bấm Mở tìm nhóm.">
        <Input type="datetime-local" disabled={lockSetup} value={draft.publishAt} onChange={(event) => set("publishAt", event.target.value)} />
      </Field>
      <Field label="Hạn tìm nhóm" error={errors.expireAt}>
        <Input type="datetime-local" disabled={lockExpire} value={draft.expireAt} onChange={(event) => set("expireAt", event.target.value)} />
      </Field>
    </div>
  );
}
