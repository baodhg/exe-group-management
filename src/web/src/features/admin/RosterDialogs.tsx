import { useMutation, useQuery } from "@tanstack/react-query";
import { FileUp, GraduationCap, Plus, RefreshCw, Upload, UsersRound } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "../../shared/auth/useAuth";
import type { CatalogItem, Course } from "../common/types";
import { Badge, CheckItem, Checks, Criteria, Criterion, EmptyState, Failure, Field, Loading, Notice, SearchField } from "../common/ui";
import { useAllRoster } from "../courses/courseData";
import { listAll } from "../courses/listAll";
import { MajorTag } from "../rooms/seats";
import { FailureNote } from "./CourseHeader";
import {
  courseLoadText,
  enrolPool,
  importFailureOf,
  importStages,
  ImportStoppedError,
  importStudents,
  maxImportRows,
  maxPasswordLength,
  overImportCap,
  parseStudentCsv,
  passwordProblem,
  type ImportFailure,
  type ImportStage,
  type ImportSummary,
  type SemesterStudent,
} from "./studentImport";

const previewRows = 6;

export function ImportDialog({ course, onClose, onImported }: { course: Course; onClose: () => void; onImported: () => Promise<unknown> }) {
  const { api } = useAuth();
  const [csv, setCsv] = useState("");
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [failure, setFailure] = useState<ImportFailure | null>(null);
  const [stages, setStages] = useState<ImportStage[] | null>(null);
  const parsed = csv.trim() ? parseStudentCsv(csv) : null;
  const rows = parsed?.rows.length ?? 0;
  const overCap = overImportCap(rows);
  const shownPasswordError = passwordError ?? passwordProblem(password);

  const runImport = useMutation({
    mutationFn: async () => {
      const majors = await listAll<CatalogItem>(api, "/api/v1/majors");
      return importStudents(api, { semesterId: course.semesterId, courseId: course.id, rows: parsed?.rows ?? [], majors, defaultPassword: password });
    },
    onSuccess: async (result) => {
      setFailure(null);
      setStages(null);
      setSummary(result);
      setCsv("");
      setPassword("");
      toast.success(`Đã ghi danh ${result.enrolled} sinh viên`);
      await onImported();
    },
    onError: async (error) => {
      const view = importFailureOf(error);
      setFailure(view);
      setPasswordError(view.passwordError);
      if (error instanceof ImportStoppedError) {
        setStages(importStages(error, course.semesterCode, course.classCode));
        await onImported();
      }
    },
  });

  function changeCsv(value: string) {
    setCsv(value);
    setSummary(null);
    setFailure(null);
    setStages(null);
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !runImport.isPending && onClose()}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nhập danh sách lớp</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Criteria columns={4}>
            <Criterion label="Tài khoản">Tạo hoặc dùng lại</Criterion>
            <Criterion label={`Học kỳ ${course.semesterCode}`}>Thêm với ngành đã ghi</Criterion>
            <Criterion label={`Lớp ${course.classCode}`}>Ghi danh</Criterion>
            <Criterion label="Mỗi lần nhập">Tối đa {maxImportRows} dòng</Criterion>
          </Criteria>
          <div className="flex flex-wrap items-center gap-3">
            <label className={buttonVariants({ variant: "outline" })}>
              <FileUp />
              Chọn tệp CSV
              <input
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    changeCsv(await file.text());
                  }
                }}
              />
            </label>
            <span className="text-xs text-muted-foreground">Cột bắt buộc: email, fullName, userCode, majorCode</span>
          </div>
          <Field label="Hoặc dán nội dung CSV">
            <Textarea rows={5} className="font-mono text-xs" placeholder="email,fullName,userCode,majorCode" value={csv} onChange={(event) => changeCsv(event.target.value)} />
          </Field>

          {parsed && rows > 0 && (
            <div className="space-y-2">
              <p className="text-[13px] font-bold">{rows} sinh viên hợp lệ</p>
              <ul className="divide-y rounded-xl border">
                {parsed.rows.slice(0, previewRows).map((row) => (
                  <li key={row.email} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                    <span className="flex min-w-0 flex-wrap items-center gap-x-2">
                      <span className="font-semibold">{row.fullName}</span>
                      <span className="text-muted-foreground">{row.userCode}</span>
                      <span className="text-muted-foreground">{row.email}</span>
                    </span>
                    <MajorTag code={row.majorCode} />
                  </li>
                ))}
              </ul>
              {rows > previewRows && <p className="text-xs text-muted-foreground">và {rows - previewRows} dòng nữa.</p>}
            </div>
          )}
          {parsed && parsed.problems.length > 0 && (
            <Notice tone="warn" title={`${parsed.problems.length} dòng bị bỏ qua`}>
              {parsed.problems.slice(0, 8).map((problem) => (
                <p key={problem}>{problem}</p>
              ))}
            </Notice>
          )}
          {overCap && (
            <Notice tone="bad" title={`Tệp có ${rows} dòng hợp lệ, vượt giới hạn ${maxImportRows} dòng.`}>
              Hãy chia tệp thành nhiều lần nhập, mỗi lần tối đa {maxImportRows} dòng.
            </Notice>
          )}

          <Field label="Mật khẩu mặc định cho tài khoản mới" hint="Chỉ cần khi có tài khoản mới, từ 8 đến 100 ký tự. Tài khoản đã có không đổi mật khẩu." error={shownPasswordError} counter={{ value: password.length, max: maxPasswordLength }}>
            <Input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setPasswordError(null);
                setFailure(null);
              }}
            />
          </Field>

          {failure && (
            <Notice tone="bad" title={failure.text}>
              {failure.trace && <p className="tabular text-xs">{failure.trace}</p>}
            </Notice>
          )}
          {stages && (
            <div className="space-y-2">
              <p className="text-[13px] font-bold">Nhập gồm ba bước riêng, bước đã xong vẫn được giữ</p>
              <Checks single>
                {stages.map((stage) => (
                  <CheckItem key={stage.label} ok={stage.status === "done"} label={stage.label} value={stage.state} />
                ))}
              </Checks>
              <Notice tone="neutral" icon={RefreshCw}>
                Nhập lại cùng tệp là an toàn: tài khoản đã có được dùng lại, sinh viên đã ghi danh được bỏ qua.
              </Notice>
            </div>
          )}
          {summary && (
            <Notice tone="good" title="Nhập xong">
              <p>
                Tài khoản mới {summary.accountsCreated}, đã có sẵn {summary.accountsExisting}.
              </p>
              <p>
                Thêm vào học kỳ {summary.addedToSemester}, cập nhật {summary.updatedInSemester}.
              </p>
              <p>
                Ghi danh {summary.enrolled}, đã ghi danh trước đó {summary.alreadyEnrolled}.
              </p>
            </Notice>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" disabled={runImport.isPending} onClick={onClose}>
            Đóng
          </Button>
          <Button pending={runImport.isPending} disabled={rows === 0 || overCap || passwordProblem(password) !== null} onClick={() => runImport.mutate()}>
            {!runImport.isPending && <Upload />}
            {runImport.isPending ? "Đang nhập" : `Nhập ${rows} sinh viên`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function EnrolDialog({ course, onClose, onEnrolled }: { course: Course; onClose: () => void; onEnrolled: () => Promise<unknown> }) {
  const { api } = useAuth();
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
  const semester = useQuery({
    queryKey: ["semesterStudents", course.semesterId, "all"],
    queryFn: () => listAll<SemesterStudent>(api, `/api/v1/semesters/${course.semesterId}/students`, { sort: "studentCode" }),
  });
  const roster = useAllRoster(course.id);
  const enrolled = new Set((roster.data ?? []).map((student) => student.studentId));
  const pool = enrolPool(semester.data ?? [], enrolled, search);
  const enrol = useMutation({
    mutationFn: () => api.post<{ enrolled: number; alreadyEnrolled: number }>(`/api/v1/courses/${course.id}/students`, { studentIds: [...picked] }),
    onSuccess: async (result) => {
      toast.success(`Đã ghi danh ${result.data.enrolled} sinh viên`);
      onClose();
      await onEnrolled();
    },
  });
  const loading = semester.isLoading || roster.isLoading;
  const loadError = semester.error ?? roster.error;

  function toggle(studentId: string) {
    const next = new Set(picked);
    if (!next.delete(studentId)) {
      next.add(studentId);
    }

    setPicked(next);
    enrol.reset();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !enrol.isPending && onClose()}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Ghi danh từ học kỳ</DialogTitle>
          <DialogDescription>
            Chọn sinh viên đã có trong học kỳ {course.semesterCode} nhưng chưa ở lớp này.
          </DialogDescription>
        </DialogHeader>
        <SearchField value={search} placeholder="Tìm theo MSSV, tên hoặc email" className="sm:max-w-none" onChange={setSearch} />
        <Loading when={loading} rows={4} className="px-0" />
        {loadError && (
          <Failure
            error={loadError}
            title="Không tải được sinh viên của học kỳ"
            onRetry={() => {
              void semester.refetch();
              void roster.refetch();
            }}
          />
        )}
        {!loading && !loadError && pool.length === 0 && search === "" && <EmptyState icon={UsersRound} title="Không còn sinh viên nào để ghi danh" description="Mọi sinh viên của học kỳ đã ở lớp này. Sinh viên mới cần nhập từ tệp CSV." />}
        {!loading && !loadError && pool.length === 0 && search !== "" && <EmptyState icon={UsersRound} title="Không có sinh viên khớp bộ lọc" description="Thử từ khoá khác." />}
        {pool.length > 0 && (
          <ul className="max-h-80 divide-y overflow-y-auto rounded-xl border">
            {pool.map((student) => (
              <li key={student.studentId} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5">
                  <Checkbox aria-label={`Chọn ${student.fullName}`} checked={picked.has(student.studentId)} onCheckedChange={() => toggle(student.studentId)} />
                  <span className="min-w-0">
                    <span className="block font-semibold">{student.fullName}</span>
                    <span className="block text-xs text-muted-foreground">{student.studentCode}</span>
                  </span>
                </label>
                <span className="flex items-center gap-1.5">
                  <Badge icon={GraduationCap}>{courseLoadText(student.courseCount)}</Badge>
                  <MajorTag code={student.majorCode} />
                </span>
              </li>
            ))}
          </ul>
        )}
        <FailureNote error={enrol.error} />
        <DialogFooter>
          <Button variant="ghost" disabled={enrol.isPending} onClick={onClose}>
            Huỷ
          </Button>
          <Button pending={enrol.isPending} disabled={picked.size === 0} onClick={() => enrol.mutate()}>
            {!enrol.isPending && <Plus />}
            Ghi danh {picked.size} sinh viên
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
