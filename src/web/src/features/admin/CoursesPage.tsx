import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Plus } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "../../shared/auth/useAuth";
import { errorText, formatDateTime, phaseLabels } from "../common/messages";
import type { Course, CoursePhase, Semester } from "../common/types";
import { Choice, EmptyState, ErrorNote, Loading, PageHeader, Pager, SearchField, Section, Toolbar } from "../common/ui";
import { PhaseBadge } from "../courses/CourseCard";
import { CourseForm } from "./CourseForm";
import { newCourse, settingsOf } from "./courseDraft";

const phases: CoursePhase[] = ["Setup", "Published", "Expired", "Finalized"];

export function CoursesPage() {
  const { api } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [semesterId, setSemesterId] = useState("all");
  const [phase, setPhase] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);

  const semesters = useQuery({ queryKey: ["semesters", "all"], queryFn: () => api.get<Semester[]>("/api/v1/semesters", { pageSize: 100, sort: "-startDate" }) });
  const courses = useQuery({
    queryKey: ["courses", "admin", semesterId, phase, search, page],
    queryFn: () =>
      api.get<Course[]>("/api/v1/courses", {
        semesterId: semesterId === "all" ? undefined : semesterId,
        phase: phase === "all" ? undefined : phase,
        search,
        page,
        pageSize: 20,
      }),
    placeholderData: keepPreviousData,
  });

  const create = useMutation({
    mutationFn: (draft: Parameters<typeof settingsOf>[0]) => api.post<Course>("/api/v1/courses", { semesterId: draft.semesterId, subjectId: draft.subjectId, ...settingsOf(draft) }),
    onSuccess: async (result) => {
      toast.success("Đã tạo course");
      setCreating(false);
      await queryClient.invalidateQueries({ queryKey: ["courses"] });
      navigate(`/admin/courses/${result.data.id}`);
    },
    onError: (error) => toast.error(errorText(error)),
  });
  const items = courses.data?.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Course"
        description="Mỗi course là một môn của một lớp trong học kỳ. Mở course để import sinh viên, sinh phòng và theo dõi đến khi chốt nhóm."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus />
            Tạo course
          </Button>
        }
      />
      <Section>
        <Toolbar>
          <SearchField
            value={search}
            placeholder="Tìm theo lớp"
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
          />
          <Choice
            label="Học kỳ"
            value={semesterId}
            options={[{ value: "all", label: "Mọi học kỳ" }, ...(semesters.data?.data ?? []).map((semester) => ({ value: semester.id, label: semester.code }))]}
            onChange={(value) => {
              setSemesterId(value);
              setPage(1);
            }}
          />
          <Choice
            label="Giai đoạn"
            value={phase}
            options={[{ value: "all", label: "Mọi giai đoạn" }, ...phases.map((item) => ({ value: item, label: phaseLabels[item] }))]}
            onChange={(value) => {
              setPhase(value);
              setPage(1);
            }}
          />
        </Toolbar>
        <ErrorNote error={courses.error} />
        <Loading when={courses.isLoading} rows={5} />
        {courses.isSuccess && items.length === 0 && (
          <EmptyState icon={BookOpen} title="Chưa có course nào" description="Tạo course đầu tiên cho học kỳ này." action={<Button onClick={() => setCreating(true)}>Tạo course</Button>} />
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((course) => (
                <TableRow key={course.id}>
                  <TableCell>
                    <Link to={`/admin/courses/${course.id}`} className="font-medium hover:underline">
                      {course.subjectCode} {course.classCode}
                    </Link>
                    <p className="max-w-64 truncate text-xs text-muted-foreground">{course.subjectName}</p>
                  </TableCell>
                  <TableCell>{course.semesterCode}</TableCell>
                  <TableCell>{course.lecturerName ?? <span className="text-muted-foreground">Chưa phân công</span>}</TableCell>
                  <TableCell className="tabular text-right">{course.studentCount}</TableCell>
                  <TableCell className="tabular text-right">{course.roomCount}</TableCell>
                  <TableCell>
                    <PhaseBadge phase={course.phase} />
                  </TableCell>
                  <TableCell className="tabular whitespace-nowrap">{formatDateTime(course.expireAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <Pager pagination={courses.data?.pagination} page={page} onPage={setPage} unit="course" />
      </Section>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Tạo course</DialogTitle>
            <DialogDescription>Sau khi tạo, bạn import danh sách lớp và sinh phòng trước khi mở tìm nhóm.</DialogDescription>
          </DialogHeader>
          {creating && <CourseForm initial={newCourse} creating locked={false} busy={create.isPending} submitLabel="Tạo course" onSubmit={(draft) => create.mutate(draft)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
