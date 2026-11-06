import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { DoorOpen, Megaphone, Search, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "../../shared/auth/useAuth";
import type { RoomSummary } from "../common/types";
import { Choice, EmptyState, Failure, Loading, Notice, Pager, SearchField, Toggle, Toolbar } from "../common/ui";
import { useWatchCourse } from "../realtime/realtimeContext";
import { roomSorts } from "./roomActions";
import { boardFetchLimit, boardPageSize, filterLackingMajor, finalExceptionText, pageRooms, sortByFit, type RoomHint } from "./roomBoardLogic";
import { RoomCard } from "./RoomCard";
import { SeatLegend } from "./seats";
import { useCourseRooms } from "./useCourseRooms";

const fitSort = "fit";

export function RoomBoard({
  courseId,
  finalized = false,
  myRoomId = null,
  selectedRoomId = null,
  onSelectRoom,
  myMajorId = null,
  rankedIds,
  pendingRoomIds,
  hintFor,
  minGroupSize = 0,
  showLegend = true,
}: {
  courseId: string;
  finalized?: boolean;
  myRoomId?: string | null;
  selectedRoomId?: string | null;
  onSelectRoom?: (roomId: string) => void;
  myMajorId?: string | null;
  rankedIds?: readonly string[];
  pendingRoomIds?: readonly string[];
  hintFor?: (room: RoomSummary) => RoomHint | null;
  minGroupSize?: number;
  showLegend?: boolean;
}) {
  const { api } = useAuth();
  const [search, setSearch] = useState("");
  const [onlyWithSeat, setOnlyWithSeat] = useState(false);
  const [lackingOnly, setLackingOnly] = useState(false);
  const [sortChoice, setSortChoice] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  useWatchCourse(courseId);

  const choosing = myMajorId !== null;
  const lacking = choosing && lackingOnly;
  const fallbackSort = finalized ? "groupNo" : "name";
  const sort = sortChoice === null ? (choosing ? fitSort : fallbackSort) : sortChoice === fitSort && !choosing ? fallbackSort : sortChoice;
  const onClient = sort === fitSort || lacking;

  const everyRoom = useCourseRooms(courseId, { search, onlyWithSeat, sort: sort === fitSort ? "name" : sort, enabled: onClient });
  const onePage = useQuery({
    queryKey: ["rooms", courseId, { search, onlyWithSeat, sort, page }],
    queryFn: () =>
      api.get<RoomSummary[]>(`/api/v1/courses/${courseId}/rooms`, {
        search,
        hasSeat: onlyWithSeat ? true : undefined,
        sort,
        page,
        pageSize: boardPageSize,
      }),
    placeholderData: keepPreviousData,
    enabled: !onClient,
  });
  const rooms = onClient ? everyRoom : onePage;

  const fetched = everyRoom.data?.data;
  const clientPage = useMemo(() => {
    const kept = lacking && myMajorId ? filterLackingMajor(fetched ?? [], myMajorId) : (fetched ?? []);
    return pageRooms(sort === fitSort ? sortByFit(kept, rankedIds ?? []) : kept, page);
  }, [fetched, lacking, myMajorId, page, rankedIds, sort]);

  const items = onClient ? clientPage.items : (onePage.data?.data ?? []);
  const pagination = onClient ? clientPage.pagination : onePage.data?.pagination;
  const filtered = search !== "" || onlyWithSeat || lacking;
  const courseEmpty = rooms.isSuccess && items.length === 0 && !filtered;
  const truncated = onClient && (everyRoom.data?.pagination?.totalItems ?? 0) > boardFetchLimit;

  const sorts = [...(choosing ? [{ value: fitSort, label: "Hợp nhất" }] : []), ...(finalized ? [{ value: "groupNo", label: "Số nhóm" }] : []), ...roomSorts];

  function clearFilters() {
    setSearch("");
    setOnlyWithSeat(false);
    setLackingOnly(false);
    setPage(1);
  }

  if (rooms.isError && !rooms.data) {
    return <Failure error={rooms.error} title={finalized ? "Không tải được danh sách nhóm" : "Không tải được bảng phòng"} onRetry={() => void rooms.refetch()} />;
  }

  if (courseEmpty) {
    return <EmptyState icon={DoorOpen} title={finalized ? "Không có nhóm nào" : "Không có phòng nào"} description={finalized ? "Lớp không có nhóm chính thức." : "Lớp chưa có phòng."} />;
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <Toolbar>
        <SearchField
          value={search}
          placeholder="Tìm theo tên phòng hoặc đề tài"
          onChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
        />
        {choosing && (
          <Toggle
            checked={lackingOnly}
            label="Thiếu ngành của tôi"
            icon={Megaphone}
            onChange={(checked) => {
              setLackingOnly(checked);
              setPage(1);
            }}
          />
        )}
        {!finalized && (
          <Toggle
            checked={onlyWithSeat}
            label="Chỉ phòng còn chỗ"
            icon={DoorOpen}
            onChange={(checked) => {
              setOnlyWithSeat(checked);
              setPage(1);
            }}
          />
        )}
        <Choice
          label="Sắp xếp"
          icon={SlidersHorizontal}
          value={sort}
          options={sorts}
          onChange={(value) => {
            setSortChoice(value);
            setPage(1);
          }}
        />
      </Toolbar>
      {showLegend && !finalized && <SeatLegend className="px-[18px] pb-3" />}
      {truncated && (
        <Notice tone="info" className="mx-[18px] mb-3">
          Lớp có hơn {boardFetchLimit} phòng, chỉ lọc và xếp trong {boardFetchLimit} phòng đầu.
        </Notice>
      )}
      <Loading when={rooms.isLoading} rows={6} />
      {items.length > 0 && (
        <div className="border-t">
          {items.map((room) => (
            <RoomCard
              key={room.id}
              room={room}
              mine={room.id === myRoomId}
              showGroupNo={finalized}
              selected={room.id === selectedRoomId}
              onSelect={onSelectRoom && (() => onSelectRoom(room.id))}
              pending={pendingRoomIds?.includes(room.id) ?? false}
              hint={hintFor?.(room)}
              exception={finalized ? finalExceptionText(room, minGroupSize) : null}
            />
          ))}
        </div>
      )}
      {rooms.isSuccess && items.length === 0 && filtered && (
        <EmptyState
          icon={Search}
          title={finalized ? "Không có nhóm nào" : "Không có phòng nào"}
          description={finalized ? "Thử đổi từ khoá khác." : "Thử bỏ bớt bộ lọc."}
          action={
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Xoá bộ lọc
            </Button>
          }
        />
      )}
      <Pager pagination={pagination} page={pagination?.page ?? page} onPage={setPage} unit={finalized ? "nhóm" : "phòng"} className="mt-auto" />
    </div>
  );
}
