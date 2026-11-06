import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, CalendarRange, Flag, GraduationCap, Library, Plus, SlidersHorizontal, Trash2, X } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ApiError } from "../../shared/api/apiClient";
import { useAuth } from "../../shared/auth/useAuth";
import { formatDateTime, phaseLabels } from "../common/messages";
import type { CatalogItem, Course, CoursePhase, Semester } from "../common/types";
import { Badge, Choice, Criteria, Criterion, EmptyState, Failure, Loading, Notice, PageHeader, Pager, SearchField, Section, Toolbar } from "../common/ui";
import { CourseFailure } from "../courses/CourseFailure";
import { PhaseChip } from "../courses/PhaseChip";
import { courseErrorText, errorTraceText, failureToast } from "./courseErrors";
import { CourseForm } from "./CourseForm";
import { courseFieldErrors, newCourse, settingsOf, validateDraft, type CourseDraft, type CourseFieldErrors } from "./courseDraft";
import { FailureNote } from "./CourseHeader";

const phases: CoursePhase[] = ["Setup", "Published", "Expired", "Finalized"];

const sorts = [
  { value: "-expireAt", label: "Hạn xa nhất" },
  { value: "expireAt", label: "Hạn gần nhất" },
  { value: "classCode", label: "Lớp A đến Z" },
  { value: "subjectCode", label: "Môn học" },
  { value: "semesterCode", label: "Học kỳ" },
  { value: "phase", label: "Giai đoạn" },
  { value: "-studentCount", label: "Nhiều sinh viên trước" },
];

interface FormFailure {
  text: string;
  trace: string | null;
}

function CreateCourseDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (open: boolean) => void; onCreated: (course: Course) => void }) {
  const { api } = useAuth();
  const [draft, setDraft] = useState<CourseDraft>(newCourse);
  const [errors, setErrors] = useState<CourseFieldErrors>({});
  const [failure, setFailure] = useState<FormFailure | null>(null);

  const create = useMutation({
    mutationFn: (value: CourseDraft) => api.post<Course>("/api/v1/courses", { semesterId: value.semesterId, subjectId: value.subjectId, ...settingsOf(value) }),
    onSuccess: (result) => {
      setDraft(newCourse);
      onCreated(result.data);
    },
    onError: (error) => {
      const fields = courseFieldErrors(error);
      if (Object.keys(fields).length > 0 || (error instanceof ApiError && error.code === "VALIDATION_FAILED")) {
        setErrors(fields);
        setFailure({ text: error instanceof ApiError && error.code === "VALIDATION_FAILED" ? "Dữ liệu chưa hợp lệ." : courseErrorText(error), trace: errorTraceText(error) });
        return;
      }

      failureToast(error);
    },
  });

  function submit() {
    const found = validateDraft(draft, "Setup", draft);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      setFailure({ text: "Dữ liệu chưa hợp lệ.", trace: null });
      return;
    }

    setFailure(null);
    create.mutate(draft);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Tạo lớp</DialogTitle>
          <DialogDescription>Sau khi tạo, bạn nhập danh sách lớp và tạo phòng trước khi mở tìm nhóm.</DialogDescription>
        </DialogHeader>
        <CourseForm
          creating
          phase="Setup"
          draft={draft}
          errors={errors}
          onChange={(next, field) => {
            setDraft(next);
            setErrors((current) => ({ ...current, [field]: undefined }));
            setFailure(null);
          }}
        />
        {failure && (
          <Notice tone="bad" title={failure.text}>
            {failure.trace && <p className="tabular text-xs">{failure.trace}</p>}
          </Notice>
        )}
        <DialogFooter>
          <Button variant="ghost" disabled={create.isPending} onClick={() => onOpenChange(false)}>
            Huỷ
          </Button>
          <Button pending={create.isPending} disabled={!draft.semesterId || !draft.subjectId || !draft.classCode.trim()} onClick={submit}>
            {!create.isPending && <Plus />}
            {create.isPending ? "Đang tạo lớp" : "Tạo lớp"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteCourseDialog({ course, onClose }: { course: Course; onClose: () => void }) {
  const { api } = useAuth();
  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: () => api.delete(`/api/v1/courses/${course.id}`),
    onSuccess: async () => {
      toast.success(`Đã xoá lớp ${course.subjectCode} ${course.classCode}`);
      onClose();
      await queryClient.invalidateQueries({ queryKey: ["courses"] });
    },
  });

  return (
    <Dialog open onOpenChange={(open) => !open && !remove.isPending && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Xoá lớp {course.subjectCode} {course.classCode}?
          </DialogTitle>
        </DialogHeader>
        <Criteria>
          <Criterion label="Phòng của lớp">Xoá cùng {course.roomCount} phòng</Criterion>
          <Criterion label="Danh sách lớp">Bỏ ghi danh {course.studentCount} sinh viên</Criterion>
          <Criterion label="Xoá được khi">Lớp còn ở Chuẩn bị</Criterion>
          <Criterion label="Hoàn tác">Không thể</Criterion>
        </Criteria>
        <FailureNote error={remove.error} />
        <DialogFooter>
          <Button variant="ghost" disabled={remove.isPending} onClick={onClose}>
            Huỷ
          </Button>
          <Button variant="destructive" pending={remove.isPending} disabled={remove.isError} onClick={() => remove.mutate()}>
            {!remove.isPending && <Trash2 />}
            Xoá lớp
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CoursesPage() {
  const { api } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [semesterId, setSemesterId] = useState("all");
  const [subjectId, setSubjectId] = useState("all");
  const [phase, setPhase] = useState("all");
  const [sort, setSort] = useState("-expireAt");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Course | null>(null);

  const semesters = useQuery({ queryKey: ["semesters", "all"], queryFn: () => api.get<Semester[]>("/api/v1/semesters", { pageSize: 100, sort: "-startDate" }) });
  const subjects = useQuery({ queryKey: ["subjects", "all"], queryFn: () => api.get<CatalogItem[]>("/api/v1/subjects", { pageSize: 100, sort: "code" }) });
  const courses = useQuery({
    queryKey: ["courses", "admin", semesterId, subjectId, phase, sort, search, page],
    queryFn: () =>
      api.get<Course[]>("/api/v1/courses", {
        semesterId: semesterId === "all" ? undefined : semesterId,
        subjectId: subjectId === "all" ? undefined : subjectId,
        phase: phase === "all" ? undefined : phase,
        sort,
        search,
        page,
        pageSize: 20,
      }),
    placeholderData: keepPreviousData,
  });
  const items = courses.data?.data ?? [];
  const filtered = search !== "" || semesterId !== "all" || subjectId !== "all" || phase !== "all";
  const change = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    setPage(1);
  };

  function clearFilters() {
    setSearch("");
    setSemesterId("all");
    setSubjectId("all");
    setPhase("all");
    setPage(1);
  }

  if (courses.error instanceof ApiError && (courses.error.status === 403 || courses.error.status === 404)) {
    return <CourseFailure error={courses.error} onRetry={() => void courses.refetch()} failTitle="Không tải được danh sách lớp" forbiddenText="Quản lý lớp chỉ dành cho giáo vụ." missingText="Trang này không còn tồn tại hoặc đường dẫn đã sai." backTo="/admin" backLabel="Về trang tổng quan" />;
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Các lớp" description="Mỗi lớp là một môn trong một học kỳ. Mở lớp để nhập sinh viên, tạo phòng và theo dõi đến khi chốt nhóm." />
      <Section flush>
        <Toolbar
          actions={
            <Button onClick={() => setCreating(true)}>
              <Plus />
              Tạo lớp
            </Button>
          }
        >
          <SearchField value={search} placeholder="Tìm theo lớp" onChange={change(setSearch)} />
          <Choice label="Học kỳ" icon={CalendarRange} value={semesterId} options={[{ value: "all", label: "Mọi học kỳ" }, ...(semesters.data?.data ?? []).map((semester) => ({ value: semester.id, label: semester.code }))]} onChange={change(setSemesterId)} />
          <Choice label="Môn học" icon={Library} value={subjectId} options={[{ value: "all", label: "Mọi môn học" }, ...(subjects.data?.data ?? []).map((subject) => ({ value: subject.id, label: subject.code }))]} onChange={change(setSubjectId)} />
          <Choice label="Giai đoạn" icon={Flag} value={phase} options={[{ value: "all", label: "Mọi giai đoạn" }, ...phases.map((item) => ({ value: item, label: phaseLabels[item] }))]} onChange={change(setPhase)} />
          <Choice label="Sắp xếp" icon={SlidersHorizontal} value={sort} options={sorts} onChange={change(setSort)} />
        </Toolbar>
        <Loading when={courses.isLoading} rows={8} />
        {courses.isError && <Failure error={courses.error} title="Không tải được danh sách lớp" onRetry={() => void courses.refetch()} />}
        {courses.isSuccess && items.length === 0 && !filtered && (
          <EmptyState
            icon={GraduationCap}
            title="Chưa có lớp nào"
            description="Tạo lớp đầu tiên cho học kỳ này."
            action={
              <Button onClick={() => setCreating(true)}>
                <Plus />
                Tạo lớp
              </Button>
            }
          />
        )}
        {courses.isSuccess && items.length === 0 && filtered && (
          <EmptyState
            icon={BookOpen}
            title="Không có lớp nào khớp bộ lọc"
            description="Thử bỏ bớt bộ lọc."
            action={
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X />
                Xoá bộ lọc
              </Button>
            }
          />
        )}
        {items.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Môn và lớp</TableHead>
                <TableHead>Học kỳ</TableHead>
                <TableHead>Giảng viên</TableHead>
                <TableHead className="text-right">Sinh viên</TableHead>
                <TableHead className="text-right">Phòng</TableHead>
                <TableHead>Giai đoạn</TableHead>
                <TableHead>Hạn tìm nhóm</TableHead>
                <TableHead className="w-px text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((course) => (
                <TableRow key={course.id} className="cursor-pointer" onClick={() => navigate(`/admin/courses/${course.id}`)}>
                  <TableCell>
                    <Link to={`/admin/courses/${course.id}`} className="font-semibold underline-offset-2 hover:underline" onClick={(event) => event.stopPropagation()}>
                      {course.subjectCode} {course.classCode}
                    </Link>
                    <span className="block max-w-64 truncate text-xs text-muted-foreground">{course.subjectName}</span>
                  </TableCell>
                  <TableCell>
                    <Badge icon={CalendarRange}>{course.semesterCode}</Badge>
                  </TableCell>
                  <TableCell>{course.lecturerName ?? <span className="text-muted-foreground">Chưa phân công</span>}</TableCell>
                  <TableCell className="tabular text-right">{course.studentCount}</TableCell>
                  <TableCell className="tabular text-right">{course.roomCount}</TableCell>
                  <TableCell>
                    <PhaseChip phase={course.phase} />
                  </TableCell>
                  <TableCell className="tabular whitespace-nowrap">{course.expireAt ? formatDateTime(course.expireAt) : "Chưa đặt"}</TableCell>
                  <TableCell className="text-right">
                    {course.phase === "Setup" && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Xoá lớp ${course.subjectCode} ${course.classCode}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          setDeleting(course);
                        }}
                      >
                        <Trash2 />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <Pager pagination={courses.data?.pagination} page={page} onPage={setPage} unit="lớp" />
      </Section>

      <CreateCourseDialog
        open={creating}
        onOpenChange={setCreating}
        onCreated={(course) => {
          setCreating(false);
          clearFilters();
          toast.success("Đã tạo lớp", { description: `${course.subjectCode} ${course.classCode} đang ở giai đoạn Chuẩn bị.` });
          void queryClient.invalidateQueries({ queryKey: ["courses"] });
          navigate(`/admin/courses/${course.id}`);
        }}
      />
      {deleting && <DeleteCourseDialog course={deleting} onClose={() => setDeleting(null)} />}
    </div>
  );
}
