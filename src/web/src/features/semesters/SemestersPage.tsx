import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarRange, Clock, Pencil, Plus, Trash2, UsersRound } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "../../shared/auth/useAuth";
import { ClearFilters, DeleteDialog, FormDialog, PageFailure, TableSkeleton } from "../admin/CatalogFrame";
import { errorCodeOf, isAccessFailure, isNotFound } from "../admin/catalogRules";
import { useClampedPage } from "../admin/useClampedPage";
import { errorText } from "../common/messages";
import type { Semester } from "../common/types";
import { Badge, CheckItem, Checks, EmptyState, Failure, Field, PageHeader, Pager, SearchField, Section, Toolbar } from "../common/ui";
import { dateText, dayAfter, isCurrentSemester, semesterDraftState, semesterNameMax } from "./semesterRules";

type Open = { kind: "add" } | { kind: "edit"; semester: Semester } | { kind: "delete"; semester: Semester } | null;

const heads = ["Mã", "Tên", "Thời gian", "Thao tác"];
const blockers = ["Lớp", "Sinh viên", "Loại nhóm được phép"];

export function SemestersPage() {
  const { api } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<Open>(null);
  const [today] = useState(() => new Date().toLocaleDateString("en-CA"));

  const semesters = useQuery({
    queryKey: ["semesters", search, page],
    queryFn: () => api.get<Semester[]>("/api/v1/semesters", { search, page, pageSize: 10, sort: "-startDate" }),
    placeholderData: keepPreviousData,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["semesters"] });
  const rows = semesters.data?.data ?? [];
  const pagination = semesters.data?.pagination;
  const filtered = search.trim() !== "";
  useClampedPage(pagination, page, setPage);

  const header = <PageHeader crumbs={[{ label: "Dữ liệu nền" }, { label: "Học kỳ" }]} title="Học kỳ" description="Lớp, hồ sơ sinh viên và loại nhóm được phép đều gắn với một học kỳ." />;

  if (isAccessFailure(semesters.error)) {
    return (
      <div className="space-y-4">
        {header}
        <PageFailure error={semesters.error} title="Không mở được trang học kỳ" backTo="/admin" backLabel="Về tổng quan" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {header}

      <Section flush title="Danh sách học kỳ" icon={CalendarRange}>
        <Toolbar
          actions={
            <Button onClick={() => setOpen({ kind: "add" })}>
              <Plus aria-hidden />
              Thêm
            </Button>
          }
        >
          <SearchField
            value={search}
            placeholder="Tìm theo mã hoặc tên"
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
          />
        </Toolbar>
        {semesters.isLoading && <TableSkeleton heads={heads} />}
        {semesters.isError && <Failure error={semesters.error} title="Không tải được danh sách học kỳ" onRetry={() => void semesters.refetch()} />}
        {semesters.isSuccess && rows.length === 0 && (
          <EmptyState
            icon={CalendarRange}
            title={filtered ? "Không có kết quả" : "Chưa có học kỳ nào"}
            action={
              filtered ? (
                <ClearFilters
                  onClear={() => {
                    setSearch("");
                    setPage(1);
                  }}
                />
              ) : undefined
            }
          />
        )}
        {!semesters.isError && rows.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mã</TableHead>
                <TableHead>Tên</TableHead>
                <TableHead>Thời gian</TableHead>
                <TableHead className="w-px text-right whitespace-nowrap">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((semester) => (
                <TableRow key={semester.id}>
                  <TableCell>
                    <span className="inline-flex items-center gap-2 whitespace-nowrap">
                      <span className="font-semibold">{semester.code}</span>
                      {isCurrentSemester(semester, today) && (
                        <Badge tone="good" icon={Clock}>
                          Đang diễn ra
                        </Badge>
                      )}
                    </span>
                  </TableCell>
                  <TableCell>{semester.name}</TableCell>
                  <TableCell className="tabular whitespace-nowrap">
                    {dateText(semester.startDate)} đến {dateText(semester.endDate)}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="inline-flex items-center justify-end gap-1">
                      <Link to={`/admin/semesters/${semester.id}/students`} aria-label={`Sinh viên của học kỳ ${semester.code}`} title={`Sinh viên của học kỳ ${semester.code}`} className={buttonVariants({ variant: "ghost", size: "icon-sm" })}>
                        <UsersRound aria-hidden />
                      </Link>
                      <Button variant="ghost" size="icon-sm" aria-label={`Sửa ${semester.code}`} onClick={() => setOpen({ kind: "edit", semester })}>
                        <Pencil aria-hidden />
                      </Button>
                      <Button variant="ghost" size="icon-sm" aria-label={`Xoá ${semester.code}`} onClick={() => setOpen({ kind: "delete", semester })}>
                        <Trash2 aria-hidden />
                      </Button>
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {!semesters.isError && <Pager pagination={pagination} page={page} onPage={setPage} unit="học kỳ" />}
      </Section>

      {open?.kind === "add" && <SemesterForm key="add" onClose={() => setOpen(null)} onSaved={refresh} />}
      {open?.kind === "edit" && <SemesterForm key={open.semester.id} semester={open.semester} onClose={() => setOpen(null)} onSaved={refresh} />}
      {open?.kind === "delete" && (
        <DeleteDialog
          key={open.semester.id}
          title={`Xoá học kỳ ${open.semester.code}?`}
          columns={3}
          criteria={blockers.map((value) => ({ label: "Không xoá được nếu còn", value }))}
          successText={`Đã xoá học kỳ ${open.semester.code}`}
          run={() => api.delete(`/api/v1/semesters/${open.semester.id}`)}
          onDone={refresh}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}

function SemesterForm({ semester, onClose, onSaved }: { semester?: Semester; onClose: () => void; onSaved: () => Promise<unknown> }) {
  const { api } = useAuth();
  const [draft, setDraft] = useState({ code: semester?.code ?? "", name: semester?.name ?? "", startDate: semester?.startDate ?? "", endDate: semester?.endDate ?? "" });
  const [taken, setTaken] = useState<{ code: string; text: string } | null>(null);
  const [note, setNote] = useState<unknown>(null);
  const state = semesterDraftState(draft);
  const isTaken = taken?.code === state.code;
  const codeError = isTaken ? taken?.text : state.codeBad ? "Mã học kỳ phải có dạng SP, SU hoặc FA và hai chữ số, ví dụ FA26." : undefined;

  const save = useMutation({
    mutationFn: () => {
      const body = { code: state.code, name: draft.name.trim(), startDate: draft.startDate, endDate: draft.endDate };
      return semester ? api.put(`/api/v1/semesters/${semester.id}`, body) : api.post("/api/v1/semesters", body);
    },
    onSuccess: async () => {
      toast.success(semester ? `Đã lưu học kỳ ${state.code}` : `Đã thêm học kỳ ${state.code}`);
      onClose();
      await onSaved();
    },
    onError: async (error) => {
      if (errorCodeOf(error) === "SEMESTER_CODE_TAKEN") {
        setTaken({ code: state.code, text: errorText(error) });
        setNote(null);
        return;
      }

      if (isNotFound(error)) {
        toast.error(errorText(error));
        onClose();
        await onSaved();
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
    <FormDialog title={semester ? `Sửa học kỳ ${semester.code}` : "Thêm học kỳ"} canSubmit={state.canSave && !isTaken} pending={save.isPending} note={note} onClose={onClose} onSubmit={() => save.mutate()}>
      <div className="grid gap-3.5 sm:grid-cols-2">
        <Field label="Mã" error={codeError}>
          <Input aria-required="true" aria-invalid={codeError !== undefined} placeholder="VD: FA26" value={draft.code} onChange={(event) => change({ code: event.target.value })} />
        </Field>
        <Field label="Tên" counter={{ value: draft.name.length, max: semesterNameMax }}>
          <Input aria-required="true" placeholder="VD: Fall 2026" value={draft.name} onChange={(event) => change({ name: event.target.value })} />
        </Field>
        <Field label="Bắt đầu">
          <Input type="date" aria-required="true" value={draft.startDate} onChange={(event) => change({ startDate: event.target.value })} />
        </Field>
        <Field label="Kết thúc" error={state.endsTooEarly ? "Ngày kết thúc phải sau ngày bắt đầu." : undefined}>
          <Input type="date" aria-required="true" aria-invalid={state.endsTooEarly} min={dayAfter(draft.startDate) || undefined} value={draft.endDate} onChange={(event) => change({ endDate: event.target.value })} />
        </Field>
      </div>
      <Checks single>
        <CheckItem ok={state.shapeOk} label="Mã gồm SP, SU hoặc FA và hai chữ số" value={state.shapeOk ? "Đạt" : "Chưa đạt"} />
        <CheckItem ok={state.datesOk} label="Ngày kết thúc sau ngày bắt đầu" value={state.datesOk ? "Đạt" : "Chưa đạt"} />
      </Checks>
    </FormDialog>
  );
}
