import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { CircleAlert, CircleCheck, DoorOpen, Layers, SlidersHorizontal, UsersRound, X, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "../../shared/auth/useAuth";
import type { GroupType, RoomSummary } from "../common/types";
import { Badge, Choice, EmptyState, Failure, Loading, Pager, SearchField, Section, Toggle, Toolbar } from "../common/ui";
import { SeatLegend, SeatStrip } from "../rooms/seats";
import { changedRooms, roomConditions, roomIsEligible, type RoomConditionKind } from "./overview";
import { RoomStatusChip } from "./PhaseChip";

const conditionIcons: Record<RoomConditionKind, LucideIcon> = {
  eligible: CircleCheck,
  empty: DoorOpen,
  members: UsersRound,
  majors: CircleAlert,
  otherMajors: CircleAlert,
};

export function RoomConditionChips({ room, minGroupSize }: { room: RoomSummary; minGroupSize: number }) {
  return (
    <span className="flex flex-wrap gap-1.5">
      {roomConditions(room, minGroupSize).map((condition) => (
        <Badge key={condition.kind} tone={condition.tone} icon={conditionIcons[condition.kind]}>
          {condition.text}
        </Badge>
      ))}
    </span>
  );
}

const baseSorts = [
  { value: "name", label: "Tên phòng" },
  { value: "-memberCount", label: "Đông người trước" },
  { value: "memberCount", label: "Ít người trước" },
  { value: "status", label: "Trạng thái" },
];

export function CourseRoomsTable({
  courseId,
  minGroupSize,
  finalized = false,
  layout,
  title,
  groupTypes,
  issueCount,
  actions,
  rowActions,
  emptyAction,
  highlight = [],
  onChanged,
}: {
  courseId: string;
  minGroupSize: number;
  finalized?: boolean;
  layout: "manage" | "overview" | "compact";
  title: string;
  groupTypes?: readonly GroupType[];
  issueCount?: number;
  actions?: ReactNode;
  rowActions?: (room: RoomSummary) => ReactNode;
  emptyAction?: ReactNode;
  highlight?: readonly string[];
  onChanged?: (names: string[]) => void;
}) {
  const { api } = useAuth();
  const [search, setSearch] = useState("");
  const [groupTypeId, setGroupTypeId] = useState("all");
  const [onlyWithSeat, setOnlyWithSeat] = useState(false);
  const [onlyIssues, setOnlyIssues] = useState(false);
  const [sort, setSort] = useState(finalized ? "groupNo" : "name");
  const [page, setPage] = useState(1);
  const pageSize = onlyIssues ? 100 : 20;

  const rooms = useQuery({
    queryKey: ["rooms", courseId, "table", { search, groupTypeId, onlyWithSeat, onlyIssues, sort, page }],
    queryFn: () =>
      api.get<RoomSummary[]>(`/api/v1/courses/${courseId}/rooms`, {
        search,
        groupTypeId: groupTypeId === "all" ? undefined : groupTypeId,
        hasSeat: onlyWithSeat ? true : undefined,
        sort,
        page: onlyIssues ? 1 : page,
        pageSize,
      }),
    placeholderData: keepPreviousData,
  });

  const seen = useRef<RoomSummary[] | null>(null);
  const loaded = rooms.data?.data;
  useEffect(() => {
    if (!loaded) {
      return;
    }

    if (seen.current && onChanged) {
      const names = changedRooms(seen.current, loaded);
      if (names.length > 0) {
        onChanged(names);
      }
    }

    seen.current = loaded;
  }, [loaded, onChanged]);

  const all = loaded ?? [];
  const items = onlyIssues ? all.filter((room) => !roomIsEligible(room, minGroupSize)) : all;
  const filtered = search !== "" || groupTypeId !== "all" || onlyWithSeat || onlyIssues;
  const sorts = finalized ? [{ value: "groupNo", label: "Số nhóm" }, ...baseSorts] : baseSorts;
  const change = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value);
    setPage(1);
  };

  function clearFilters() {
    setSearch("");
    setGroupTypeId("all");
    setOnlyWithSeat(false);
    setOnlyIssues(false);
    setPage(1);
  }

  return (
    <Section flush title={title} icon={DoorOpen} actions={!finalized && items.length > 0 ? <SeatLegend /> : undefined}>
      <Toolbar actions={actions}>
        <SearchField value={search} placeholder="Tìm theo tên phòng hoặc đề tài" onChange={change(setSearch)} />
        {groupTypes && (
          <Choice
            label="Loại nhóm"
            icon={Layers}
            value={groupTypeId}
            options={[{ value: "all", label: "Mọi loại nhóm" }, ...groupTypes.map((type) => ({ value: type.id, label: type.code }))]}
            onChange={change(setGroupTypeId)}
          />
        )}
        {!finalized && <Toggle checked={onlyWithSeat} label="Chỉ phòng còn chỗ" icon={DoorOpen} onChange={change(setOnlyWithSeat)} />}
        {!finalized && issueCount !== undefined && <Toggle checked={onlyIssues} label="Cần xử lý" icon={CircleAlert} count={issueCount} onChange={change(setOnlyIssues)} />}
        <Choice label="Sắp xếp" icon={SlidersHorizontal} value={sort} options={sorts} onChange={change(setSort)} />
      </Toolbar>
      <Loading when={rooms.isLoading} rows={6} />
      {rooms.isError && <Failure error={rooms.error} title="Không tải được danh sách phòng" onRetry={() => void rooms.refetch()} />}
      {rooms.isSuccess && items.length === 0 && !filtered && <EmptyState icon={DoorOpen} title={layout === "manage" ? "Lớp chưa có phòng." : "Không có phòng nào"} description={layout === "manage" ? "Chọn loại nhóm rồi sinh phòng ở trang thiết lập lớp." : "Lớp chưa có phòng."} action={emptyAction} />}
      {rooms.isSuccess && items.length === 0 && filtered && (
        <EmptyState
          icon={DoorOpen}
          title="Không có phòng nào"
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
              <TableHead>{layout === "compact" && finalized ? "Nhóm" : "Phòng"}</TableHead>
              {layout === "manage" && <TableHead>Loại nhóm</TableHead>}
              {layout === "overview" && <TableHead>Đề tài</TableHead>}
              <TableHead>Trưởng nhóm</TableHead>
              <TableHead>Ghế</TableHead>
              <TableHead>Trạng thái</TableHead>
              {layout !== "compact" && <TableHead>Điều kiện</TableHead>}
              {rowActions && <TableHead className="w-px text-right">Thao tác</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((room) => (
              <TableRow key={room.id} data-state={highlight.includes(room.name) ? "selected" : undefined}>
                <TableCell>
                  <Link to={`/rooms/${room.id}`} className="font-semibold whitespace-nowrap underline-offset-2 hover:underline">
                    {room.groupNo ? `Nhóm ${room.groupNo}: ${room.name}` : room.name}
                  </Link>
                  {layout !== "overview" && <span className="block max-w-64 truncate text-xs text-muted-foreground">{room.topic ?? "Chưa có đề tài"}</span>}
                </TableCell>
                {layout === "manage" && (
                  <TableCell>
                    <Badge icon={Layers}>{room.groupTypeCode}</Badge>
                  </TableCell>
                )}
                {layout === "overview" && <TableCell className="max-w-64 truncate">{room.topic ?? <span className="text-muted-foreground">Chưa có đề tài</span>}</TableCell>}
                <TableCell className="whitespace-nowrap">{room.leaderName || <span className="text-muted-foreground">Chưa có</span>}</TableCell>
                <TableCell className="min-w-44">
                  <SeatStrip capacity={room.capacity} memberCount={room.memberCount} majors={room.majors} missingMajorSeats={room.missingMajorSeats} />
                </TableCell>
                <TableCell>
                  {layout === "compact" ? (
                    <span className="flex flex-wrap gap-1.5">
                      <RoomStatusChip status={room.status} />
                      <RoomConditionChips room={room} minGroupSize={minGroupSize} />
                    </span>
                  ) : (
                    <RoomStatusChip status={room.status} />
                  )}
                </TableCell>
                {layout !== "compact" && (
                  <TableCell>
                    <RoomConditionChips room={room} minGroupSize={minGroupSize} />
                  </TableCell>
                )}
                {rowActions && <TableCell className="text-right whitespace-nowrap">{rowActions(room)}</TableCell>}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {!onlyIssues && <Pager pagination={rooms.data?.pagination} page={page} onPage={setPage} unit="phòng" />}
    </Section>
  );
}
