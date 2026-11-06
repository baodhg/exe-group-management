import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Blocks, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAuth } from "../../shared/auth/useAuth";
import { useDialogs } from "../common/dialogsContext";
import { errorText } from "../common/messages";
import type { CatalogItem, GroupType, Semester } from "../common/types";
import { EmptyState, ErrorNote, Field, Loading, NativeSelect, PageHeader, Section } from "../common/ui";
import { MajorTag } from "../rooms/seats";

const emptyDraft = { code: "", name: "", minDistinctMajors: 1 };

export function GroupTypesPage() {
  const { api } = useAuth();
  const { confirm } = useDialogs();
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState(emptyDraft);
  const [selected, setSelected] = useState<string | null>(null);

  const groupTypes = useQuery({ queryKey: ["groupTypes"], queryFn: () => api.get<GroupType[]>("/api/v1/group-types", { pageSize: 100, sort: "code" }) });
  const majors = useQuery({ queryKey: ["majors", "all"], queryFn: () => api.get<CatalogItem[]>("/api/v1/majors", { pageSize: 100, sort: "code" }) });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["groupTypes"] });

  const create = useMutation({
    mutationFn: () => api.post<GroupType>("/api/v1/group-types", { ...draft, code: draft.code.trim(), name: draft.name.trim() }),
    onSuccess: async (result) => {
      toast.success(`Đã thêm loại nhóm ${result.data.code}, hãy đặt số tối thiểu cho từng ngành`);
      setDraft(emptyDraft);
      setCreating(false);
      await refresh();
      setSelected(result.data.id);
    },
    onError: (error) => toast.error(errorText(error)),
  });
  const remove = useMutation({
    mutationFn: (groupType: GroupType) => api.delete(`/api/v1/group-types/${groupType.id}`).then(() => groupType),
    onSuccess: async (groupType) => {
      toast.success(`Đã xóa loại nhóm ${groupType.code}`);
      await refresh();
    },
    onError: (error) => toast.error(errorText(error)),
  });

  const items = groupTypes.data?.data ?? [];
  const current = items.find((groupType) => groupType.id === selected) ?? null;

  return (
    <div className="space-y-6">
      <PageHeader
        crumbs={[{ label: "Dữ liệu nền" }, { label: "Loại nhóm" }]}
        title="Loại nhóm"
        description="Mỗi loại nhóm quy định số ngành khác nhau tối thiểu và số người tối thiểu của từng ngành. Phòng chỉ nhận thêm người khi vẫn còn đủ chỗ cho các ngành còn thiếu."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus />
            Thêm loại nhóm
          </Button>
        }
      />

      <ErrorNote error={groupTypes.error} />
      <Loading when={groupTypes.isLoading} rows={3} />
      {groupTypes.isSuccess && items.length === 0 && <EmptyState icon={Blocks} title="Chưa có loại nhóm nào" action={<Button onClick={() => setCreating(true)}>Thêm loại nhóm</Button>} />}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.map((groupType) => (
          <article key={groupType.id} className="flex flex-col gap-3 rounded-xl border bg-card p-5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-base font-semibold">{groupType.code}</h3>
                <p className="text-sm text-muted-foreground">{groupType.name}</p>
              </div>
              <div className="flex">
                <Button variant="ghost" size="icon-sm" aria-label={`Sửa ${groupType.code}`} onClick={() => setSelected(groupType.id)}>
                  <Pencil />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Xóa ${groupType.code}`}
                  disabled={remove.isPending}
                  onClick={async () => {
                    if (await confirm({ title: `Xóa loại nhóm ${groupType.code}?`, description: "Không xóa được nếu đã có phòng dùng loại này.", confirmLabel: "Xóa", destructive: true })) {
                      remove.mutate(groupType);
                    }
                  }}
                >
                  <Trash2 />
                </Button>
              </div>
            </div>
            <p className="text-sm">Ít nhất {groupType.minDistinctMajors} ngành khác nhau</p>
            <div className="mt-auto flex flex-wrap gap-1.5 border-t pt-3">
              {groupType.majors.length === 0 && <span className="text-xs text-muted-foreground">Không yêu cầu ngành cụ thể</span>}
              {groupType.majors.map((major) => (
                <span key={major.majorId} className="inline-flex items-center gap-1">
                  <MajorTag majorId={major.majorId} code={major.majorCode} />
                  <span className="tabular text-xs text-muted-foreground">từ {major.minMembers}</span>
                </span>
              ))}
            </div>
          </article>
        ))}
      </div>

      <SemesterAllowance groupTypes={items} />

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Thêm loại nhóm</DialogTitle>
            <DialogDescription>Sau khi thêm, đặt số người tối thiểu cho từng ngành.</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              create.mutate();
            }}
          >
            <Field label="Mã">
              <Input required className="h-9" placeholder="VD: EXE" value={draft.code} onChange={(event) => setDraft({ ...draft, code: event.target.value })} />
            </Field>
            <Field label="Tên">
              <Input required className="h-9" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
            </Field>
            <Field label="Số ngành khác nhau tối thiểu">
              <Input
                type="number"
                className="h-9"
                min={1}
                max={10}
                value={draft.minDistinctMajors}
                onChange={(event) => setDraft({ ...draft, minDistinctMajors: Number(event.target.value) })}
              />
            </Field>
            <DialogFooter>
              <Button type="submit" disabled={create.isPending}>
                Thêm
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={current !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-lg">
          {current && <GroupTypeEditor key={current.id} groupType={current} majors={majors.data?.data ?? []} onDone={() => setSelected(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function GroupTypeEditor({ groupType, majors, onDone }: { groupType: GroupType; majors: CatalogItem[]; onDone: () => void }) {
  const { api } = useAuth();
  const queryClient = useQueryClient();
  const [name, setName] = useState(groupType.name);
  const [minDistinctMajors, setMinDistinctMajors] = useState(groupType.minDistinctMajors);
  const [minimums, setMinimums] = useState<Record<string, number>>(Object.fromEntries(groupType.majors.map((major) => [major.majorId, major.minMembers])));

  const save = useMutation({
    mutationFn: async () => {
      await api.put(`/api/v1/group-types/${groupType.id}`, { code: groupType.code, name: name.trim(), minDistinctMajors });
      await api.put(
        `/api/v1/group-types/${groupType.id}/majors`,
        Object.entries(minimums)
          .filter(([, minMembers]) => minMembers > 0)
          .map(([majorId, minMembers]) => ({ majorId, minMembers })),
      );
    },
    onSuccess: async () => {
      toast.success(`Đã lưu loại nhóm ${groupType.code}`);
      await queryClient.invalidateQueries({ queryKey: ["groupTypes"] });
      onDone();
    },
  });

  return (
    <>
      <DialogHeader>
        <DialogTitle>Sửa loại nhóm {groupType.code}</DialogTitle>
        <DialogDescription>Đặt 0 nếu không bắt buộc ngành đó.</DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_9rem]">
          <Field label="Tên">
            <Input className="h-9" value={name} onChange={(event) => setName(event.target.value)} />
          </Field>
          <Field label="Số ngành tối thiểu">
            <Input type="number" className="h-9" min={1} max={10} value={minDistinctMajors} onChange={(event) => setMinDistinctMajors(Number(event.target.value))} />
          </Field>
        </div>
        <div className="rounded-lg border">
          <p className="border-b px-3 py-2 text-sm font-medium">Số người tối thiểu theo ngành</p>
          <ul className="divide-y">
            {majors.map((major) => (
              <li key={major.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="flex min-w-0 items-center gap-2 text-sm">
                  <MajorTag majorId={major.id} code={major.code} />
                  <span className="truncate text-muted-foreground">{major.name}</span>
                </span>
                <Input
                  type="number"
                  min={0}
                  max={20}
                  className="h-8 w-20 text-right"
                  value={minimums[major.id] ?? 0}
                  onChange={(event) => setMinimums({ ...minimums, [major.id]: Number(event.target.value) })}
                  aria-label={`Tối thiểu ${major.code}`}
                />
              </li>
            ))}
          </ul>
        </div>
        {save.error && <ErrorNote error={save.error} />}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onDone}>
          Thôi
        </Button>
        <Button disabled={save.isPending} onClick={() => save.mutate()}>
          Lưu
        </Button>
      </DialogFooter>
    </>
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
    <Section title="Loại nhóm dùng trong học kỳ" description="Khi sinh phòng cho một course, chỉ chọn được các loại nhóm học kỳ đó cho phép.">
      <div className="space-y-4">
        <Field label="Học kỳ" className="sm:w-80">
          <NativeSelect
            value={semesterId}
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
        {semesterId !== "" && allowed.isSuccess && (
          <>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {groupTypes.map((groupType) => (
                <label key={groupType.id} className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm has-data-checked:border-primary/50 has-data-checked:bg-accent/50">
                  <Checkbox
                    className="mt-0.5"
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
                    <span className="block font-medium">{groupType.code}</span>
                    <span className="block text-xs text-muted-foreground">{groupType.name}</span>
                  </span>
                </label>
              ))}
            </div>
            <div className="flex justify-end">
              <Button disabled={draft === null || save.isPending} onClick={() => save.mutate()}>
                Lưu cho học kỳ
              </Button>
            </div>
          </>
        )}
        <ErrorNote error={allowed.error} />
      </div>
    </Section>
  );
}
