import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarRange, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "../../shared/auth/useAuth";
import { useDialogs } from "../common/dialogsContext";
import { errorText } from "../common/messages";
import type { Semester } from "../common/types";
import { Badge, EmptyState, ErrorNote, Field, Loading, PageHeader, Pager, SearchField, Section, Toolbar } from "../common/ui";

const empty = { code: "", name: "", startDate: "", endDate: "" };

function dateText(value: string): string {
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function isCurrent(semester: Semester, today: string): boolean {
  return semester.startDate <= today && today <= semester.endDate;
}

export function SemestersPage() {
  const { api } = useAuth();
  const { confirm } = useDialogs();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [draft, setDraft] = useState(empty);
  const [today] = useState(() => new Date().toLocaleDateString("en-CA"));

  const semesters = useQuery({
    queryKey: ["semesters", search, page],
    queryFn: () => api.get<Semester[]>("/api/v1/semesters", { search, page, pageSize: 10, sort: "-startDate" }),
    placeholderData: keepPreviousData,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["semesters"] });

  const create = useMutation({
    mutationFn: () => api.post("/api/v1/semesters", { ...draft, code: draft.code.trim().toUpperCase(), name: draft.name.trim() }),
    onSuccess: async () => {
      toast.success(`Đã thêm học kỳ ${draft.code.trim().toUpperCase()}`);
      setDraft(empty);
      await refresh();
    },
    onError: (error) => toast.error(errorText(error)),
  });
  const remove = useMutation({
    mutationFn: (semester: Semester) => api.delete(`/api/v1/semesters/${semester.id}`).then(() => semester),
    onSuccess: async (semester) => {
      toast.success(`Đã xóa học kỳ ${semester.code}`);
      await refresh();
    },
    onError: (error) => toast.error(errorText(error)),
  });
  const rows = semesters.data?.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader crumbs={[{ label: "Dữ liệu nền" }, { label: "Học kỳ" }]} title="Học kỳ" description="Course, hồ sơ sinh viên và loại nhóm được phép đều gắn với một học kỳ." />

      <Section title="Thêm học kỳ">
        <form
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[10rem_1fr_11rem_11rem_auto] lg:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate();
          }}
        >
          <Field label="Mã">
            <Input required className="h-9" placeholder="VD: FA26" value={draft.code} onChange={(event) => setDraft({ ...draft, code: event.target.value })} />
          </Field>
          <Field label="Tên">
            <Input required className="h-9" placeholder="VD: Fall 2026" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
          </Field>
          <Field label="Bắt đầu">
            <Input required type="date" className="h-9" value={draft.startDate} onChange={(event) => setDraft({ ...draft, startDate: event.target.value })} />
          </Field>
          <Field label="Kết thúc">
            <Input required type="date" className="h-9" min={draft.startDate || undefined} value={draft.endDate} onChange={(event) => setDraft({ ...draft, endDate: event.target.value })} />
          </Field>
          <Button type="submit" className="h-9" disabled={create.isPending}>
            <Plus />
            Thêm
          </Button>
        </form>
      </Section>

      <Section>
        <Toolbar>
          <SearchField
            value={search}
            placeholder="Tìm theo mã hoặc tên"
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
          />
        </Toolbar>
        <ErrorNote error={semesters.error} />
        <Loading when={semesters.isLoading} rows={4} />
        {semesters.isSuccess && rows.length === 0 && <EmptyState icon={CalendarRange} title={search ? "Không có kết quả" : "Chưa có học kỳ nào"} />}
        {rows.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mã</TableHead>
                <TableHead>Tên</TableHead>
                <TableHead>Thời gian</TableHead>
                <TableHead className="w-16 text-right">Xóa</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((semester) => (
                <TableRow key={semester.id}>
                  <TableCell className="font-medium">
                    {semester.code}
                    {isCurrent(semester, today) && (
                      <Badge tone="good" className="ml-2">
                        Đang diễn ra
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{semester.name}</TableCell>
                  <TableCell className="tabular">
                    {dateText(semester.startDate)} đến {dateText(semester.endDate)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Xóa ${semester.code}`}
                      disabled={remove.isPending}
                      onClick={async () => {
                        if (await confirm({ title: `Xóa học kỳ ${semester.code}?`, description: "Không xóa được nếu học kỳ đã có course hoặc sinh viên.", confirmLabel: "Xóa", destructive: true })) {
                          remove.mutate(semester);
                        }
                      }}
                    >
                      <Trash2 />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <Pager pagination={semesters.data?.pagination} page={page} onPage={setPage} unit="học kỳ" />
      </Section>
    </div>
  );
}
