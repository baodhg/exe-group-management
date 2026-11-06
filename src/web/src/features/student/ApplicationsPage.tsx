import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Filter, GraduationCap, Inbox, LayoutGrid, Search, SlidersHorizontal, X } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "../../shared/auth/useAuth";
import { errorText, formatDateTime, requestStatusLabels } from "../common/messages";
import type { Course, JoinRequest } from "../common/types";
import { Choice, EmptyState, Failure, LinkButton, Loading, PageHeader, Pager, SearchField, Section, Toolbar } from "../common/ui";
import { RequestStatusBadge, PageDenied } from "./courseParts";
import { WithdrawDialog } from "./JoinDialogs";
import { deniedStatus, publishedCourse, requestReason } from "./studentCourse";

const allValue = "all";
const pageSize = 20;

const statusOptions = [
  { value: allValue, label: "Mọi trạng thái" },
  ...(["Pending", "Approved", "Rejected", "Cancelled"] as const).map((status) => ({ value: status, label: requestStatusLabels[status] })),
];

const sortOptions = [
  { value: "-createdAt", label: "Gửi mới nhất" },
  { value: "createdAt", label: "Gửi cũ nhất" },
  { value: "-decidedAt", label: "Xử lý mới nhất" },
  { value: "roomName", label: "Tên phòng" },
  { value: "status", label: "Trạng thái" },
];

export function ApplicationsPage() {
  const { api } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [courseId, setCourseId] = useState(allValue);
  const [status, setStatus] = useState(allValue);
  const [sort, setSort] = useState("-createdAt");
  const [page, setPage] = useState(1);
  const [target, setTarget] = useState<JoinRequest | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);

  const courses = useQuery({
    queryKey: ["courses", "mine"],
    queryFn: () => api.get<Course[]>("/api/v1/courses", { mine: true, pageSize: 100, sort: "-expireAt" }),
  });
  const requests = useQuery({
    queryKey: ["joinRequests", "mine", "list", { search, courseId, status, sort, page }],
    queryFn: () =>
      api.get<JoinRequest[]>("/api/v1/join-requests", {
        search,
        courseId: courseId === allValue ? undefined : courseId,
        status: status === allValue ? undefined : status,
        sort,
        page,
        pageSize,
      }),
    placeholderData: keepPreviousData,
  });

  const withdraw = useMutation({
    mutationFn: (requestId: string) => api.post<JoinRequest>(`/api/v1/join-requests/${requestId}/withdraw`),
    onSuccess: async () => {
      setTarget(null);
      setDialogError(null);
      toast.success("Đã rút đơn");
      await queryClient.invalidateQueries({ queryKey: ["joinRequests"] });
    },
    onError: async (error) => {
      setDialogError(errorText(error));
      await queryClient.invalidateQueries({ queryKey: ["joinRequests"] });
    },
  });

  const denied = deniedStatus(requests.error);
  if (denied && !requests.data) {
    return denied === 403 ? (
      <PageDenied status={403} title="Bạn không có quyền mở trang này" text="Bạn không có quyền làm thao tác này." />
    ) : (
      <PageDenied status={404} title="Không tìm thấy trang" text="Không tìm thấy dữ liệu. Đường dẫn có thể đã cũ." />
    );
  }

  const myCourses = courses.data?.data ?? [];
  const courseOf = new Map(myCourses.map((course) => [course.id, course]));
  const courseOptions = [{ value: allValue, label: "Mọi lớp" }, ...myCourses.map((course) => ({ value: course.id, label: `${course.subjectCode} lớp ${course.classCode}` }))];
  const rows = requests.data?.data ?? [];
  const filtered = search !== "" || courseId !== allValue || status !== allValue;
  const nothingSent = requests.isSuccess && rows.length === 0 && !filtered;
  const open = publishedCourse(myCourses);

  function clearFilters() {
    setSearch("");
    setCourseId(allValue);
    setStatus(allValue);
    setPage(1);
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Đơn của tôi" description="Mọi đơn xin vào phòng bạn đã gửi, cùng trạng thái, lý do và ngày xử lý." />

      <Section flush title="Đơn xin vào phòng" icon={Inbox}>
        {requests.isError && !requests.data && <Failure error={requests.error} title="Không tải được đơn xin vào phòng" onRetry={() => void requests.refetch()} />}
        <Loading when={requests.isLoading} rows={5} />
        {nothingSent && (
          <EmptyState
            icon={Inbox}
            title="Bạn chưa gửi đơn nào"
            description="Đơn gửi vào phòng đang khoá sẽ hiện ở đây."
            action={
              open ? (
                <LinkButton variant="outline" size="sm" to={`/student/courses/${open.id}`}>
                  <LayoutGrid aria-hidden />
                  Xem bảng phòng
                </LinkButton>
              ) : (
                <LinkButton variant="outline" size="sm" to="/student">
                  <GraduationCap aria-hidden />
                  Về lớp của tôi
                </LinkButton>
              )
            }
          />
        )}
        {requests.data && !nothingSent && (
          <>
            <Toolbar>
              <SearchField
                value={search}
                placeholder="Tìm theo tên phòng hoặc lời nhắn"
                onChange={(value) => {
                  setSearch(value);
                  setPage(1);
                }}
              />
              <Choice
                label="Lọc theo lớp"
                icon={GraduationCap}
                value={courseId}
                options={courseOptions}
                onChange={(value) => {
                  setCourseId(value);
                  setPage(1);
                }}
              />
              <Choice
                label="Lọc theo trạng thái"
                icon={Filter}
                value={status}
                options={statusOptions}
                onChange={(value) => {
                  setStatus(value);
                  setPage(1);
                }}
              />
              <Choice
                label="Sắp xếp"
                icon={SlidersHorizontal}
                value={sort}
                options={sortOptions}
                onChange={(value) => {
                  setSort(value);
                  setPage(1);
                }}
              />
            </Toolbar>
            {rows.length > 0 && (
              <div className="overflow-x-auto border-t">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Phòng</TableHead>
                      <TableHead>Trạng thái</TableHead>
                      <TableHead>Lý do</TableHead>
                      <TableHead>Ngày gửi</TableHead>
                      <TableHead>Ngày xử lý</TableHead>
                      <TableHead className="text-right">Thao tác</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((request) => {
                      const course = courseOf.get(request.courseId);
                      return (
                        <TableRow key={request.id}>
                          <TableCell className="whitespace-normal">
                            <Link to={`/rooms/${request.roomId}`} className="block font-semibold hover:underline">
                              {request.roomName}
                            </Link>
                            {course && (
                              <span className="block text-xs text-muted-foreground">
                                {course.subjectCode} lớp {course.classCode}
                              </span>
                            )}
                            {request.message && <span className="block max-w-sm text-xs break-words text-muted-foreground">Lời nhắn: {request.message}</span>}
                          </TableCell>
                          <TableCell>
                            <RequestStatusBadge status={request.status} />
                          </TableCell>
                          <TableCell className="whitespace-normal">
                            <span className="block font-medium">{requestReason(request)}</span>
                            {request.reasonText && <span className="block max-w-xs text-xs break-words text-muted-foreground">{request.reasonText}</span>}
                          </TableCell>
                          <TableCell className="tabular whitespace-nowrap">{formatDateTime(request.createdAt)}</TableCell>
                          <TableCell className="tabular whitespace-nowrap">{request.decidedAt ? formatDateTime(request.decidedAt) : "Chưa xử lý"}</TableCell>
                          <TableCell className="text-right">
                            {request.status === "Pending" && (
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Rút đơn vào ${request.roomName}`}
                                title="Rút đơn"
                                onClick={() => {
                                  setDialogError(null);
                                  setTarget(request);
                                }}
                              >
                                <X aria-hidden />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
            {rows.length === 0 && (
              <EmptyState
                icon={Search}
                title="Không có đơn nào"
                description="Thử bỏ bớt bộ lọc."
                action={
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    Xoá bộ lọc
                  </Button>
                }
              />
            )}
            <Pager pagination={requests.data.pagination} page={page} onPage={setPage} unit="đơn" />
          </>
        )}
      </Section>

      {target && (
        <WithdrawDialog
          open
          roomName={target.roomName}
          pending={withdraw.isPending}
          error={dialogError}
          onClose={() => {
            setTarget(null);
            setDialogError(null);
          }}
          onConfirm={() => {
            setDialogError(null);
            withdraw.mutate(target.id);
          }}
        />
      )}
    </div>
  );
}
