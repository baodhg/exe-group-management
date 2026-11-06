import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Blocks, CalendarRange, Pencil, Plus, Save, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "../../shared/auth/useAuth";
import { errorText } from "../common/messages";
import type { CatalogItem, GroupType, Semester } from "../common/types";
import { useMajors } from "../courses/courseData";
import { Criteria, Criterion, EmptyState, Failure, Field, NativeSelect, Notice, PageHeader, Section } from "../common/ui";
import { MajorTag } from "../rooms/seats";
import { DeleteDialog, FormDialog, PageFailure } from "./CatalogFrame";
import { badCodeText, catalogCodeChecks, errorCodeOf, isAccessFailure, isNotFound, normalizeCode, numberInRange } from "./catalogRules";

const codeMax = 20;
const nameMax = 100;
const minHint = "Từ 1 đến 20";

function useTakenCode() {
  const [taken, setTaken] = useState<{ code: string; text: string } | null>(null);
  return {
    remember: (code: string, error: unknown) => setTaken({ code, text: errorText(error) }),
    errorFor: (value: string) => {
      const checks = catalogCodeChecks(value, codeMax);
      return taken?.code === normalizeCode(value) ? taken.text : checks.patternBad ? badCodeText : undefined;
    },
  };
}

export function GroupTypesPage() {
  const { api } = useAuth();
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<GroupType | null>(null);

  const groupTypes = useQuery({ queryKey: ["groupTypes"], queryFn: () => api.get<GroupType[]>("/api/v1/group-types", { pageSize: 100, sort: "code" }) });
  const majors = useMajors();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["groupTypes"] });

  const items = groupTypes.data?.data ?? [];
  const current = items.find((groupType) => groupType.id === selected) ?? null;

  const header = (
    <PageHeader
      crumbs={[{ label: "Dữ liệu nền" }, { label: "Loại nhóm" }]}
      title="Loại nhóm"
      description="Mỗi loại nhóm quy định cách ghép ngành trong một phòng."
      actions={
        <Button onClick={() => setCreating(true)}>
          <Plus aria-hidden />
          Thêm loại nhóm
        </Button>
      }
    />
  );

  if (isAccessFailure(groupTypes.error)) {
    return (
      <div className="space-y-4">
        <PageHeader crumbs={[{ label: "Dữ liệu nền" }, { label: "Loại nhóm" }]} title="Loại nhóm" description="Mỗi loại nhóm quy định cách ghép ngành trong một phòng." />
        <PageFailure error={groupTypes.error} title="Không mở được trang loại nhóm" backTo="/admin" backLabel="Về tổng quan" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {header}

      <Criteria columns={3}>
        <Criterion label="Mỗi phòng cần">Đủ số ngành khác nhau tối thiểu</Criterion>
        <Criterion label="Mỗi ngành yêu cầu cần">Đủ số người tối thiểu</Criterion>
        <Criterion label="Phòng nhận thêm người">Khi còn đủ chỗ cho ngành còn thiếu</Criterion>
      </Criteria>

      {groupTypes.isLoading && (
        <div className="grid gap-4 lg:grid-cols-2" aria-busy="true" aria-label="Đang tải">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      )}
      {groupTypes.isError && (
        <Section>
          <Failure error={groupTypes.error} title="Không tải được danh sách loại nhóm" onRetry={() => void groupTypes.refetch()} />
        </Section>
      )}
      {groupTypes.isSuccess && items.length === 0 && (
        <Section>
          <EmptyState
            icon={Blocks}
            title="Chưa có loại nhóm nào"
            action={
              <Button size="sm" onClick={() => setCreating(true)}>
                <Plus aria-hidden />
                Thêm loại nhóm
              </Button>
            }
          />
        </Section>
      )}
      {items.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          {items.map((groupType) => (
            <Section
              key={groupType.id}
              title={groupType.code}
              description={groupType.name}
              actions={
                <span className="inline-flex items-center gap-1">
                  <Button variant="ghost" size="icon-sm" aria-label={`Sửa ${groupType.code}`} onClick={() => setSelected(groupType.id)}>
                    <Pencil aria-hidden />
                  </Button>
                  <Button variant="ghost" size="icon-sm" aria-label={`Xoá ${groupType.code}`} onClick={() => setDeleting(groupType)}>
                    <Trash2 aria-hidden />
                  </Button>
                </span>
              }
            >
              <Criteria>
                <Criterion label="Số ngành khác nhau tối thiểu">Ít nhất {groupType.minDistinctMajors} ngành</Criterion>
                <Criterion label="Số người tối thiểu theo ngành">
                  {groupType.majors.length === 0 ? (
                    "Không yêu cầu ngành cụ thể"
                  ) : (
                    <span className="flex flex-wrap items-center gap-1.5 font-normal">
                      {groupType.majors.map((major) => (
                        <span key={major.majorId} className="inline-flex items-center gap-1">
                          <MajorTag code={major.majorCode} />
                          <span className="tabular text-xs text-muted-foreground">từ {major.minMembers}</span>
                        </span>
                      ))}
                    </span>
                  )}
                </Criterion>
              </Criteria>
            </Section>
          ))}
        </div>
      )}

      <SemesterAllowance groupTypes={items} />

      {creating && (
        <GroupTypeCreator
          onClose={() => setCreating(false)}
          onCreated={async (created) => {
            setCreating(false);
            await refresh();
            setSelected(created.id);
          }}
        />
      )}
      {current && <GroupTypeEditor key={current.id} groupType={current} majors={majors.data ?? []} majorsLoading={majors.isLoading} majorsError={majors.error} onRetryMajors={() => void majors.refetch()} onClose={() => setSelected(null)} onChanged={refresh} />}
      {deleting && (
        <DeleteDialog
          key={deleting.id}
          title={`Xoá loại nhóm ${deleting.code}?`}
          criteria={[{ label: "Không xoá được nếu", value: "Đã có phòng dùng loại này" }]}
          columns={2}
          successText={`Đã xoá loại nhóm ${deleting.code}`}
          run={() => api.delete(`/api/v1/group-types/${deleting.id}`)}
          onDone={refresh}
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  );
}

function GroupTypeCreator({ onClose, onCreated }: { onClose: () => void; onCreated: (created: GroupType) => Promise<void> }) {
  const { api } = useAuth();
  const [draft, setDraft] = useState({ code: "", name: "", minDistinctMajors: "1" });
  const [note, setNote] = useState<unknown>(null);
  const takenCode = useTakenCode();
  const code = normalizeCode(draft.code);
  const checks = catalogCodeChecks(draft.code, codeMax);
  const codeError = takenCode.errorFor(draft.code);
  const minOk = numberInRange(draft.minDistinctMajors, 1, 20);

  const create = useMutation({
    mutationFn: () => api.post<GroupType>("/api/v1/group-types", { code, name: draft.name.trim(), minDistinctMajors: Number(draft.minDistinctMajors) }),
    onSuccess: async (result) => {
      toast.success(`Đã thêm loại nhóm ${result.data.code}, hãy đặt số tối thiểu cho từng ngành`);
      await onCreated(result.data);
    },
    onError: (error) => {
      if (errorCodeOf(error) === "GROUP_TYPE_CODE_TAKEN") {
        takenCode.remember(code, error);
        setNote(null);
        return;
      }

      setNote(error);
    },
  });
  const change = (patch: Partial<typeof draft>) => {
    setDraft({ ...draft, ...patch });
    setNote(null);
  };

  return (
    <FormDialog
      title="Thêm loại nhóm"
      description="Sau khi thêm, đặt số người tối thiểu cho từng ngành."
      icon={Plus}
      submitLabel="Thêm"
      pendingLabel="Đang thêm"
      canSubmit={checks.usable && codeError === undefined && draft.name.trim() !== "" && draft.name.length <= nameMax && minOk}
      pending={create.isPending}
      note={note}
      onClose={onClose}
      onSubmit={() => create.mutate()}
    >
      <Field label="Mã" error={codeError} counter={{ value: draft.code.trim().length, max: codeMax }}>
        <Input aria-required="true" aria-invalid={codeError !== undefined || !checks.shortEnough} placeholder="VD: EXE" value={draft.code} onChange={(event) => change({ code: event.target.value })} />
      </Field>
      <Field label="Tên" counter={{ value: draft.name.length, max: nameMax }}>
        <Input aria-required="true" value={draft.name} onChange={(event) => change({ name: event.target.value })} />
      </Field>
      <Field label="Số ngành khác nhau tối thiểu" hint={minHint} error={minOk ? undefined : "Số ngành phải từ 1 đến 20."}>
        <Input type="number" min={1} max={20} aria-invalid={!minOk} value={draft.minDistinctMajors} onChange={(event) => change({ minDistinctMajors: event.target.value })} />
      </Field>
    </FormDialog>
  );
}

function GroupTypeEditor({
  groupType,
  majors,
  majorsLoading,
  majorsError,
  onRetryMajors,
  onClose,
  onChanged,
}: {
  groupType: GroupType;
  majors: CatalogItem[];
  majorsLoading: boolean;
  majorsError: unknown;
  onRetryMajors: () => void;
  onClose: () => void;
  onChanged: () => Promise<unknown>;
}) {
  const { api } = useAuth();
  const [draft, setDraft] = useState({ code: groupType.code, name: groupType.name, minDistinctMajors: String(groupType.minDistinctMajors) });
  const [minimums, setMinimums] = useState<Record<string, string>>(Object.fromEntries(groupType.majors.map((major) => [major.majorId, String(major.minMembers)])));
  const [note, setNote] = useState<unknown>(null);
  const takenCode = useTakenCode();
  const code = normalizeCode(draft.code);
  const checks = catalogCodeChecks(draft.code, codeMax);
  const codeError = takenCode.errorFor(draft.code);
  const minOk = numberInRange(draft.minDistinctMajors, 1, 20);
  const minimumsOk = Object.values(minimums).every((value) => numberInRange(value, 0, 20));

  const save = useMutation({
    mutationFn: async () => {
      await api.put(`/api/v1/group-types/${groupType.id}`, { code, name: draft.name.trim(), minDistinctMajors: Number(draft.minDistinctMajors) });
      await api.put(
        `/api/v1/group-types/${groupType.id}/majors`,
        Object.entries(minimums)
          .filter(([, minMembers]) => Number(minMembers) > 0)
          .map(([majorId, minMembers]) => ({ majorId, minMembers: Number(minMembers) })),
      );
    },
    onSuccess: async () => {
      toast.success(`Đã lưu loại nhóm ${code}`);
      onClose();
      await onChanged();
    },
    onError: async (error) => {
      if (errorCodeOf(error) === "GROUP_TYPE_CODE_TAKEN") {
        takenCode.remember(code, error);
        setNote(null);
        return;
      }

      if (isNotFound(error)) {
        toast.error(errorText(error));
        onClose();
      } else {
        setNote(error);
      }

      await onChanged();
    },
  });
  const change = (patch: Partial<typeof draft>) => {
    setDraft({ ...draft, ...patch });
    setNote(null);
  };

  return (
    <FormDialog
      title={`Sửa loại nhóm ${groupType.code}`}
      canSubmit={checks.usable && codeError === undefined && draft.name.trim() !== "" && draft.name.length <= nameMax && minOk && minimumsOk}
      pending={save.isPending}
      note={note}
      onClose={onClose}
      onSubmit={() => save.mutate()}
    >
      <Notice tone="warn">Quy định mới có hiệu lực ngay với mọi phòng đang dùng loại này, kể cả phòng đang mở. Phòng đang đủ điều kiện có thể trở thành chưa đủ.</Notice>
      <div className="grid gap-3.5 sm:grid-cols-2">
        <Field label="Mã" error={codeError} counter={{ value: draft.code.trim().length, max: codeMax }}>
          <Input aria-required="true" aria-invalid={codeError !== undefined || !checks.shortEnough} placeholder="VD: EXE" value={draft.code} onChange={(event) => change({ code: event.target.value })} />
        </Field>
        <Field label="Tên" counter={{ value: draft.name.length, max: nameMax }}>
          <Input aria-required="true" value={draft.name} onChange={(event) => change({ name: event.target.value })} />
        </Field>
        <Field label="Số ngành khác nhau tối thiểu" hint={minHint} error={minOk ? undefined : "Số ngành phải từ 1 đến 20."}>
          <Input type="number" min={1} max={20} aria-invalid={!minOk} value={draft.minDistinctMajors} onChange={(event) => change({ minDistinctMajors: event.target.value })} />
        </Field>
      </div>
      <div className="space-y-0.5">
        <h3 className="text-sm font-bold">Số người tối thiểu theo ngành</h3>
        <p className="text-[13px] text-muted-foreground">Đặt 0 nếu không bắt buộc ngành đó.</p>
      </div>
      {majorsLoading && (
        <div className="grid gap-3.5 sm:grid-cols-2" aria-busy="true" aria-label="Đang tải">
          <Skeleton className="h-16 rounded-xl" />
          <Skeleton className="h-16 rounded-xl" />
        </div>
      )}
      {majorsError !== null && <Failure error={majorsError} title="Không tải được danh sách ngành" onRetry={onRetryMajors} />}
      {majors.length > 0 && (
        <div className="grid gap-3.5 sm:grid-cols-2">
          {majors.map((major) => {
            const value = minimums[major.id] ?? "0";
            const ok = numberInRange(value, 0, 20);
            return (
              <label key={major.id} className="flex flex-col gap-1.5 text-[13px] font-bold">
                <span className="flex flex-wrap items-center gap-2">
                  <MajorTag code={major.code} />
                  <span className="text-xs font-normal text-muted-foreground">{major.name}</span>
                </span>
                <Input
                  type="number"
                  min={0}
                  max={20}
                  aria-label={`Tối thiểu ${major.code}`}
                  aria-invalid={!ok}
                  className={ok ? undefined : "border-destructive"}
                  value={value}
                  onChange={(event) => {
                    setMinimums({ ...minimums, [major.id]: event.target.value });
                    setNote(null);
                  }}
                />
                <span className="text-xs font-normal text-muted-foreground">Từ 0 đến 20</span>
              </label>
            );
          })}
        </div>
      )}
    </FormDialog>
  );
}

function SemesterAllowance({ groupTypes }: { groupTypes: GroupType[] }) {
  const { api } = useAuth();
  const queryClient = useQueryClient();
  const [semesterId, setSemesterId] = useState("");
  const [draft, setDraft] = useState<Set<string> | null>(null);

  const semesters = useQuery({ queryKey: ["semesters", "all"], queryFn: () => api.get<Semester[]>("/api/v1/semesters", { pageSize: 100, sort: "-startDate" }) });
  const allowed = useQuery({
    queryKey: ["semesterGroupTypes", semesterId],
    queryFn: () => api.get<GroupType[]>(`/api/v1/semesters/${semesterId}/group-types`),
    enabled: semesterId !== "",
  });
  const current = draft ?? new Set((allowed.data?.data ?? []).map((groupType) => groupType.id));

  const save = useMutation({
    mutationFn: () => api.put(`/api/v1/semesters/${semesterId}/group-types`, { groupTypeIds: [...current] }),
    onSuccess: async () => {
      toast.success("Đã lưu loại nhóm của học kỳ");
      setDraft(null);
      await queryClient.invalidateQueries({ queryKey: ["semesterGroupTypes", semesterId] });
    },
    onError: (error) => toast.error(errorText(error)),
  });

  return (
    <Section title="Loại nhóm dùng trong học kỳ" icon={CalendarRange} description="Chọn các loại nhóm được phép khi sinh phòng cho lớp của học kỳ.">
      {semesters.isError ? (
        <Failure error={semesters.error} title="Không tải được danh sách học kỳ" onRetry={() => void semesters.refetch()} />
      ) : (
        <Field label="Học kỳ" className="self-start sm:w-80">
          <NativeSelect
            value={semesterId}
            disabled={semesters.isLoading}
            onChange={(event) => {
              setSemesterId(event.target.value);
              setDraft(null);
            }}
          >
            <option value="">Chọn học kỳ</option>
            {semesters.data?.data.map((semester) => (
              <option key={semester.id} value={semester.id}>
                {semester.code}: {semester.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
      )}
      {semesterId === "" && !semesters.isError && <Notice tone="neutral">Chọn một học kỳ để xem và đổi loại nhóm được phép.</Notice>}
      {semesterId !== "" && allowed.isLoading && (
        <div className="space-y-2" aria-busy="true" aria-label="Đang tải">
          <Skeleton className="h-11 rounded-[10px]" />
          <Skeleton className="h-11 rounded-[10px]" />
        </div>
      )}
      {semesterId !== "" && allowed.isError && <Failure error={allowed.error} title="Không tải được loại nhóm của học kỳ" onRetry={() => void allowed.refetch()} />}
      {semesterId !== "" && allowed.isSuccess && (
        <>
          {groupTypes.length === 0 && <p className="text-sm text-muted-foreground">Chưa có loại nhóm nào để chọn.</p>}
          <ul className="flex list-none flex-col">
            {groupTypes.map((groupType) => (
              <li key={groupType.id} className="border-t py-[9px] first:border-t-0">
                <label className="flex cursor-pointer items-center gap-2.5 text-[13px]">
                  <Checkbox
                    checked={current.has(groupType.id)}
                    onCheckedChange={(checked) => {
                      const next = new Set(current);
                      if (checked) {
                        next.add(groupType.id);
                      } else {
                        next.delete(groupType.id);
                      }

                      setDraft(next);
                    }}
                  />
                  <span>
                    <span className="block font-semibold">{groupType.code}</span>
                    <span className="block text-xs text-muted-foreground">{groupType.name}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <Criteria>
            <Criterion label="Không bỏ được khỏi học kỳ nếu">Phòng của học kỳ còn dùng loại đó</Criterion>
          </Criteria>
          <div className="flex justify-end">
            <Button disabled={draft === null} pending={save.isPending} onClick={() => save.mutate()}>
              {!save.isPending && <Save aria-hidden />}
              {save.isPending ? "Đang lưu" : "Lưu cho học kỳ"}
            </Button>
          </div>
        </>
      )}
    </Section>
  );
}
