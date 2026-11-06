import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookMarked, Trash2, UsersRound } from "lucide-react";
import { useState } from "react";
import { useParams } from "react-router";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "../../shared/auth/useAuth";
import { ClearFilters, DeleteDialog, PageFailure, TableSkeleton } from "../admin/CatalogFrame";
import { isAccessFailure, isNotFound } from "../admin/catalogRules";
import { useClampedPage } from "../admin/useClampedPage";
import { formatDate } from "../common/messages";
import type { CatalogItem, Semester } from "../common/types";
import { Choice, EmptyState, Failure, PageHeader, PageLoading, Pager, SearchField, Section, Toolbar } from "../common/ui";
import { MajorTag } from "../rooms/seats";
import { dateText, type SemesterStudent } from "./semesterRules";

const heads = ["Sinh viên", "Mã", "Ngành", "Số lớp", "Thêm ngày", "Thao tác"];

export function SemesterStudentsPage() {
  const { semesterId = "" } = useParams();
  const { api } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [majorId, setMajorId] = useState("all");
  const [page, setPage] = useState(1);
  const [target, setTarget] = useState<SemesterStudent | null>(null);

  const semester = useQuery({ queryKey: ["semester", semesterId], queryFn: () => api.get<Semester>(`/api/v1/semesters/${semesterId}`) });
  const majors = useQuery({ queryKey: ["majors", "all"], queryFn: () => api.get<CatalogItem[]>("/api/v1/majors", { pageSize: 100, sort: "code" }) });
  const students = useQuery({
    queryKey: ["semesterStudents", semesterId, search, majorId, page],
    queryFn: () =>
      api.get<SemesterStudent[]>(`/api/v1/semesters/${semesterId}/students`, {
        search,
        majorId: majorId === "all" ? undefined : majorId,
        page,
        pageSize: 10,
        sort: "studentCode",
      }),
    placeholderData: keepPreviousData,
    enabled: semester.isSuccess,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["semesterStudents", semesterId] });
  const rows = students.data?.data ?? [];
  const pagination = students.data?.pagination;
  const filtered = search.trim() !== "" || majorId !== "all";
  useClampedPage(pagination, page, setPage);

  if (semester.isLoading) {
    return <PageLoading blocks={1} />;
  }

  if (isNotFound(semester.error)) {
    return <PageFailure error={semester.error} title="Không tìm thấy học kỳ" backTo="/admin/semesters" backLabel="Về danh sách học kỳ" />;
  }

  if (isAccessFailure(semester.error) || isAccessFailure(students.error)) {
    return <PageFailure error={semester.error ?? students.error} title="Không mở được sinh viên của học kỳ" backTo="/admin/semesters" backLabel="Về danh sách học kỳ" />;
  }

  if (!semester.data) {
    return (
      <Section>
        <Failure error={semester.error} title="Không tải được học kỳ" onRetry={() => void semester.refetch()} />
      </Section>
    );
  }

  const current = semester.data.data;

  return (
    <div className="space-y-4">
      <PageHeader
        crumbs={[{ label: "Dữ liệu nền" }, { label: "Học kỳ", to: "/admin/semesters" }, { label: `Sinh viên ${current.code}` }]}
        title={`Sinh viên học kỳ ${current.code}`}
        description={`${current.name}, từ ${dateText(current.startDate)} đến ${dateText(current.endDate)}. Sinh viên và ngành của họ trong học kỳ này.`}
      />

      <Section flush title="Danh sách sinh viên" icon={UsersRound}>
        <Toolbar>
          <SearchField
            value={search}
            placeholder="Tìm theo mã, tên hoặc email"
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
          />
          <Choice
            label="Lọc theo ngành"
            icon={BookMarked}
            value={majorId}
            options={[{ value: "all", label: "Mọi ngành" }, ...(majors.data?.data ?? []).map((major) => ({ value: major.id, label: major.code }))]}
            onChange={(value) => {
              setMajorId(value);
              setPage(1);
            }}
          />
        </Toolbar>
        {students.isLoading && <TableSkeleton heads={heads} />}
        {students.isError && <Failure error={students.error} title="Không tải được sinh viên của học kỳ" onRetry={() => void students.refetch()} />}
        {students.isSuccess && rows.length === 0 && (
          <EmptyState
            icon={UsersRound}
            title={filtered ? "Không có sinh viên khớp bộ lọc" : "Học kỳ chưa có sinh viên"}
            action={
              filtered ? (
                <ClearFilters
                  onClear={() => {
                    setSearch("");
                    setMajorId("all");
                    setPage(1);
                  }}
                />
              ) : undefined
            }
          />
        )}
        {!students.isError && rows.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sinh viên</TableHead>
                <TableHead>Mã</TableHead>
                <TableHead>Ngành</TableHead>
                <TableHead className="text-right">Số lớp</TableHead>
                <TableHead>Thêm ngày</TableHead>
                <TableHead className="w-px text-right whitespace-nowrap">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((student) => (
                <TableRow key={student.studentId}>
                  <TableCell>
                    <span className="block font-semibold">{student.fullName}</span>
                    <span className="block text-xs text-muted-foreground">{student.email}</span>
                  </TableCell>
                  <TableCell className="tabular">{student.studentCode}</TableCell>
                  <TableCell>
                    <MajorTag code={student.majorCode} />
                  </TableCell>
                  <TableCell className="tabular text-right">{student.courseCount}</TableCell>
                  <TableCell className="tabular">{formatDate(student.addedAt)}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon-sm" aria-label={`Gỡ ${student.fullName} khỏi học kỳ`} title={`Gỡ ${student.fullName} khỏi học kỳ`} onClick={() => setTarget(student)}>
                      <Trash2 aria-hidden />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {!students.isError && <Pager pagination={pagination} page={page} onPage={setPage} unit="sinh viên" />}
      </Section>

      {target && (
        <DeleteDialog
          key={target.studentId}
          title={`Gỡ ${target.fullName} khỏi học kỳ ${current.code}?`}
          criteria={[
            { label: "Gỡ được khi", value: "Không còn ghi danh lớp nào của học kỳ" },
            { label: "Sinh viên này đang ghi danh", value: `${target.courseCount} lớp` },
          ]}
          confirmLabel="Gỡ khỏi học kỳ"
          pendingLabel="Đang gỡ"
          successText={`Đã gỡ ${target.fullName} khỏi học kỳ ${current.code}`}
          run={() => api.delete(`/api/v1/semesters/${semesterId}/students/${target.studentId}`)}
          onDone={refresh}
          onClose={() => setTarget(null)}
        />
      )}
    </div>
  );
}
