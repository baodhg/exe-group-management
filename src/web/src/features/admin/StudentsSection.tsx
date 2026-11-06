import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileUp, UserMinus, UsersRound } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "../../shared/api/apiClient";
import { useAuth } from "../../shared/auth/useAuth";
import { useDialogs } from "../common/dialogsContext";
import { errorText } from "../common/messages";
import type { CatalogItem, Course, RosterEntry } from "../common/types";
import { Choice, EmptyState, ErrorNote, Field, Loading, Notice, Pager, SearchField, Section, Toolbar } from "../common/ui";
import { importStudents, parseStudentCsv, type ImportSummary } from "./studentImport";

const previewRows = 6;

function importErrorText(error: unknown): string {
  return error instanceof Error && !(error instanceof ApiError) ? error.message : errorText(error);
}

function ImportDialog({ course, open, onOpenChange, onImported }: { course: Course; open: boolean; onOpenChange: (open: boolean) => void; onImported: () => Promise<unknown> }) {
  const { api } = useAuth();
  const [csv, setCsv] = useState("");
  const [password, setPassword] = useState("");
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const parsed = csv.trim() ? parseStudentCsv(csv) : null;

  const runImport = useMutation({
    mutationFn: async () => {
      const majors = await api.get<CatalogItem[]>("/api/v1/majors", { pageSize: 100 });
      return importStudents(api, { semesterId: course.semesterId, courseId: course.id, rows: parsed?.rows ?? [], majors: majors.data, defaultPassword: password });
    },
    onSuccess: async (result) => {
      setSummary(result);
      setCsv("");
      toast.success(`Đã ghi danh ${result.enrolled} sinh viên`);
      await onImported();
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import danh sách lớp</DialogTitle>
          <DialogDescription>
            Mỗi dòng tạo hoặc dùng lại tài khoản sinh viên, thêm vào học kỳ {course.semesterCode} với ngành đã ghi rồi ghi danh vào course.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors hover:border-primary/50 hover:bg-accent/40">
            <FileUp className="size-6 text-muted-foreground" aria-hidden />
            <span className="text-sm font-medium">Chọn tệp CSV</span>
            <span className="text-xs text-muted-foreground">
              Cột bắt buộc: <code className="rounded bg-muted px-1">email,fullName,userCode,majorCode</code>
            </span>
            <input
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (file) {
                  setSummary(null);
                  setCsv(await file.text());
                }
              }}
            />
          </label>
          <Field label="Hoặc dán nội dung CSV">
            <Textarea
              rows={5}
              className="font-mono text-xs"
              placeholder={"email,fullName,userCode,majorCode\nan@fpt.edu.vn,Nguyễn Văn An,SE180001,SE"}
              value={csv}
              onChange={(event) => {
                setSummary(null);
                setCsv(event.target.value);
              }}
            />
          </Field>

          {parsed && parsed.rows.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">{parsed.rows.length} sinh viên hợp lệ</p>
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>MSSV</TableHead>
                      <TableHead>Họ tên</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Ngành</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsed.rows.slice(0, previewRows).map((row) => (
                      <TableRow key={row.email}>
                        <TableCell>{row.userCode}</TableCell>
                        <TableCell>{row.fullName}</TableCell>
                        <TableCell className="text-muted-foreground">{row.email}</TableCell>
                        <TableCell>{row.majorCode}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {parsed.rows.length > previewRows && <p className="text-xs text-muted-foreground">và {parsed.rows.length - previewRows} dòng nữa.</p>}
            </div>
          )}
          {parsed && parsed.problems.length > 0 && (
            <Notice tone="warn" title={`${parsed.problems.length} dòng bị bỏ qua`}>
              <ul className="list-disc pl-4">
                {parsed.problems.slice(0, 8).map((problem) => (
                  <li key={problem}>{problem}</li>
                ))}
              </ul>
            </Notice>
          )}

          <Field label="Mật khẩu mặc định cho tài khoản mới" hint="Chỉ dùng cho tài khoản chưa có. Sinh viên đổi lại sau khi đăng nhập.">
            <Input type="password" className="h-9" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </Field>

          {runImport.error && <Notice tone="bad">{importErrorText(runImport.error)}</Notice>}
          {summary && (
            <Notice tone="good" title="Import xong">
              Tài khoản mới {summary.accountsCreated}, đã có sẵn {summary.accountsExisting}. Thêm vào học kỳ {summary.addedToSemester}, cập nhật {summary.updatedInSemester}. Ghi danh{" "}
              {summary.enrolled}, đã ghi danh trước đó {summary.alreadyEnrolled}.
            </Notice>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Đóng
          </Button>
          <Button disabled={!parsed || parsed.rows.length === 0 || password.length === 0 || runImport.isPending} onClick={() => runImport.mutate()}>
            {runImport.isPending ? "Đang import" : `Import ${parsed?.rows.length ?? 0} sinh viên`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function StudentsSection({ course }: { course: Course }) {
  const { api } = useAuth();
  const { confirm } = useDialogs();
  const queryClient = useQueryClient();
  const [importing, setImporting] = useState(false);
  const [hasRoom, setHasRoom] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const editable = course.phase !== "Finalized";

  const roster = useQuery({
    queryKey: ["roster", course.id, hasRoom, search, page],
    queryFn: () => api.get<RosterEntry[]>(`/api/v1/courses/${course.id}/students`, { hasRoom: hasRoom === "all" ? undefined : hasRoom, search, page, pageSize: 20 }),
    placeholderData: keepPreviousData,
  });
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["roster", course.id] }),
      queryClient.invalidateQueries({ queryKey: ["course", course.id] }),
      queryClient.invalidateQueries({ queryKey: ["overview", course.id] }),
    ]);
  const remove = useMutation({
    mutationFn: (studentId: string) => api.delete(`/api/v1/courses/${course.id}/students/${studentId}`),
    onSuccess: async () => {
      toast.success("Đã gỡ sinh viên khỏi course");
      await refresh();
    },
    onError: (error) => toast.error(errorText(error)),
  });
  const items = roster.data?.data ?? [];

  return (
    <Section
      title={`Sinh viên (${course.studentCount})`}
      actions={
        editable && (
          <Button variant="outline" onClick={() => setImporting(true)}>
            <FileUp />
            Import danh sách lớp
          </Button>
        )
      }
    >
      <Toolbar>
        <SearchField
          value={search}
          placeholder="Tìm theo MSSV, tên hoặc email"
          onChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
        />
        <Choice
          label="Lọc theo phòng"
          value={hasRoom}
          options={[
            { value: "all", label: "Tất cả" },
            { value: "true", label: "Đã có phòng" },
            { value: "false", label: "Chưa có phòng" },
          ]}
          onChange={(value) => {
            setHasRoom(value);
            setPage(1);
          }}
        />
      </Toolbar>
      <ErrorNote error={roster.error} />
      <Loading when={roster.isLoading} rows={5} />
      {roster.isSuccess && items.length === 0 && (
        <EmptyState
          icon={UsersRound}
          title={search || hasRoom !== "all" ? "Không có sinh viên khớp bộ lọc" : "Course chưa có sinh viên"}
          action={editable && !search && hasRoom === "all" ? <Button onClick={() => setImporting(true)}>Import danh sách lớp</Button> : undefined}
        />
      )}
      {items.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sinh viên</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Ngành</TableHead>
              <TableHead>Phòng</TableHead>
              {editable && <TableHead className="w-12" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((student) => (
              <TableRow key={student.studentId}>
                <TableCell>
                  <span className="font-medium">{student.fullName}</span>
                  <span className="block text-xs text-muted-foreground">{student.studentCode}</span>
                </TableCell>
                <TableCell className="text-muted-foreground">{student.email}</TableCell>
                <TableCell>{student.majorCode}</TableCell>
                <TableCell>{student.roomName ?? <span className="text-deadline-ink">Chưa có phòng</span>}</TableCell>
                {editable && (
                  <TableCell>
                    {student.roomId === null && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Gỡ ${student.fullName} khỏi course`}
                        disabled={remove.isPending}
                        onClick={async () => {
                          if (await confirm({ title: `Gỡ ${student.fullName} khỏi course?`, description: "Tài khoản và hồ sơ học kỳ vẫn giữ nguyên.", confirmLabel: "Gỡ", destructive: true })) {
                            remove.mutate(student.studentId);
                          }
                        }}
                      >
                        <UserMinus />
                      </Button>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <Pager pagination={roster.data?.pagination} page={page} onPage={setPage} unit="sinh viên" />
      {editable && <ImportDialog course={course} open={importing} onOpenChange={setImporting} onImported={refresh} />}
    </Section>
  );
}
