import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { BookMarked, Clock, DoorOpen, SlidersHorizontal, UsersRound, X } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "../../shared/auth/useAuth";
import type { RosterEntry } from "../common/types";
import { Badge, Choice, EmptyState, Failure, Loading, Pager, SearchField, Section, Toolbar } from "../common/ui";
import { MajorTag } from "../rooms/seats";
import { useAllRooms, useMajors } from "./courseData";

const sorts = [
  { value: "studentCode", label: "Mã sinh viên" },
  { value: "fullName", label: "Tên A đến Z" },
  { value: "majorCode", label: "Ngành" },
  { value: "roomName", label: "Phòng" },
  { value: "enrolledAt", label: "Ghi danh sớm trước" },
];

export function RosterTable({
  courseId,
  total,
  finalized,
  actions,
  rowAction,
  empty,
}: {
  courseId: string;
  total: number;
  finalized: boolean;
  actions?: ReactNode;
  rowAction?: (student: RosterEntry) => ReactNode;
  empty: ReactNode;
}) {
  const { api } = useAuth();
  const [search, setSearch] = useState("");
  const [hasRoom, setHasRoom] = useState("all");
  const [majorId, setMajorId] = useState("all");
  const [sort, setSort] = useState("studentCode");
  const [page, setPage] = useState(1);
  const majors = useMajors();
  const rooms = useAllRooms(courseId, finalized);
  const groupNumbers = useMemo(() => new Map((rooms.data ?? []).map((room) => [room.id, room.groupNo])), [rooms.data]);

  const roster = useQuery({
    queryKey: ["roster", courseId, { hasRoom, majorId, sort, search, page }],
    queryFn: () =>
      api.get<RosterEntry[]>(`/api/v1/courses/${courseId}/students`, {
        hasRoom: hasRoom === "all" ? undefined : hasRoom,
        majorId: majorId === "all" ? undefined : majorId,
        sort,
        search,
        page,
        pageSize: 20,
      }),
    placeholderData: keepPreviousData,
  });
  const items = roster.data?.data ?? [];
  const filtered = search !== "" || hasRoom !== "all" || majorId !== "all";
  const change = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    setPage(1);
  };

  function clearFilters() {
    setSearch("");
    setHasRoom("all");
    setMajorId("all");
    setPage(1);
  }

  function roomLabel(student: RosterEntry): string {
    const groupNo = student.roomId ? groupNumbers.get(student.roomId) : null;
    return groupNo ? `Nhóm ${groupNo}: ${student.roomName}` : (student.roomName ?? "");
  }

  return (
    <Section flush title={`Sinh viên (${total})`} icon={UsersRound}>
      <Toolbar actions={actions}>
        <SearchField value={search} placeholder="Tìm theo MSSV, tên hoặc email" onChange={change(setSearch)} />
        <Choice
          label="Lọc theo phòng"
          icon={DoorOpen}
          value={hasRoom}
          options={[
            { value: "all", label: "Tất cả" },
            { value: "true", label: "Đã có phòng" },
            { value: "false", label: "Chưa có phòng" },
          ]}
          onChange={change(setHasRoom)}
        />
        <Choice label="Lọc theo ngành" icon={BookMarked} value={majorId} options={[{ value: "all", label: "Mọi ngành" }, ...(majors.data ?? []).map((major) => ({ value: major.id, label: major.code }))]} onChange={change(setMajorId)} />
        <Choice label="Sắp xếp" icon={SlidersHorizontal} value={sort} options={sorts} onChange={change(setSort)} />
      </Toolbar>
      <Loading when={roster.isLoading} rows={8} />
      {roster.isError && <Failure error={roster.error} title="Không tải được danh sách sinh viên" onRetry={() => void roster.refetch()} />}
      {roster.isSuccess && items.length === 0 && !filtered && empty}
      {roster.isSuccess && items.length === 0 && filtered && (
        <EmptyState
          icon={UsersRound}
          title="Không có sinh viên khớp bộ lọc"
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
              <TableHead>Sinh viên</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Ngành</TableHead>
              <TableHead>Phòng</TableHead>
              {rowAction && <TableHead className="w-px text-right">Thao tác</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((student) => (
              <TableRow key={student.studentId}>
                <TableCell>
                  <span className="block font-semibold">{student.fullName}</span>
                  <span className="block text-xs text-muted-foreground">{student.studentCode}</span>
                </TableCell>
                <TableCell className="text-muted-foreground">{student.email}</TableCell>
                <TableCell>
                  <MajorTag code={student.majorCode} />
                </TableCell>
                <TableCell>
                  {student.roomId ? (
                    <Badge icon={DoorOpen}>{roomLabel(student)}</Badge>
                  ) : (
                    <Badge tone="warn" icon={Clock}>
                      Chưa có phòng
                    </Badge>
                  )}
                </TableCell>
                {rowAction && <TableCell className="text-right">{rowAction(student)}</TableCell>}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <Pager pagination={roster.data?.pagination} page={page} onPage={setPage} unit="sinh viên" />
    </Section>
  );
}
