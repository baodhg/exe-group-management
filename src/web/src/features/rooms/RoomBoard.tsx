import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { DoorOpen } from "lucide-react";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "../../shared/auth/useAuth";
import type { RoomSummary } from "../common/types";
import { Choice, EmptyState, ErrorNote, Pager, SearchField, Toggle, Toolbar } from "../common/ui";
import { useWatchCourse } from "../realtime/realtimeContext";
import { roomSorts } from "./roomActions";
import { RoomCard } from "./RoomCard";

export function SeatLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span className="size-3 rounded-[4px]" style={{ backgroundColor: "var(--major-1)" }} aria-hidden />
        Đã có người, màu theo ngành
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-3 rounded-[4px] border-[1.5px] border-dashed border-deadline bg-deadline-soft" aria-hidden />
        Giữ cho ngành còn thiếu
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-3 rounded-[4px] border-[1.5px] border-dashed border-input" aria-hidden />
        Còn trống
      </span>
    </div>
  );
}

export function RoomBoard({ courseId, finalized = false, myRoomId = null }: { courseId: string; finalized?: boolean; myRoomId?: string | null }) {
  const { api } = useAuth();
  const [search, setSearch] = useState("");
  const [onlyWithSeat, setOnlyWithSeat] = useState(false);
  const [sort, setSort] = useState<string>(finalized ? "groupNo" : "name");
  const [page, setPage] = useState(1);
  useWatchCourse(courseId);

  const rooms = useQuery({
    queryKey: ["rooms", courseId, { search, onlyWithSeat, sort, page }],
    queryFn: () =>
      api.get<RoomSummary[]>(`/api/v1/courses/${courseId}/rooms`, {
        search,
        hasSeat: onlyWithSeat ? true : undefined,
        sort,
        page,
        pageSize: 24,
      }),
    placeholderData: keepPreviousData,
  });
  const sorts = finalized ? [{ value: "groupNo", label: "Số nhóm" }, ...roomSorts] : roomSorts;
  const items = rooms.data?.data ?? [];

  return (
    <div>
      <Toolbar>
        <SearchField
          value={search}
          placeholder="Tìm theo tên phòng hoặc đề tài"
          onChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
        />
        {!finalized && (
          <Toggle
            checked={onlyWithSeat}
            label="Chỉ phòng còn chỗ"
            onChange={(checked) => {
              setOnlyWithSeat(checked);
              setPage(1);
            }}
          />
        )}
        <Choice label="Sắp xếp" value={sort} options={sorts} onChange={setSort} />
      </Toolbar>
      {!finalized && <SeatLegend />}
      <ErrorNote error={rooms.error} />
      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {rooms.isLoading && Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-52 rounded-xl" />)}
        {items.map((room) => (
          <RoomCard key={room.id} room={room} mine={room.id === myRoomId} showGroupNo={finalized} />
        ))}
      </div>
      {rooms.isSuccess && items.length === 0 && (
        <EmptyState icon={DoorOpen} title="Không có phòng nào" description={search || onlyWithSeat ? "Thử bỏ bớt bộ lọc." : "Course chưa có phòng."} />
      )}
      <Pager pagination={rooms.data?.pagination} page={page} onPage={setPage} unit="phòng" />
    </div>
  );
}
