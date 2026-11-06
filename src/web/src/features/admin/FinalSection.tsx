import { Award, Crown, DoorOpen, Eye, Info, Layers, SlidersHorizontal, TriangleAlert, UsersRound, X } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "../common/messages";
import type { Course, RoomSummary } from "../common/types";
import { Badge, Choice, Criteria, Criterion, EmptyState, Failure, LinkButton, Notice, Pager, SearchField, Section, SummaryCard, Toolbar } from "../common/ui";
import { useAllRooms } from "../courses/courseData";
import { foldText, missingMajorsText, roomIsEligible } from "../courses/overview";
import { MajorChips, SeatStrip } from "../rooms/seats";
import { CourseHeader } from "./CourseHeader";
import type { FinalizeResult } from "./placement";

const sorts = [
  { value: "groupNo", label: "Số nhóm" },
  { value: "name", label: "Tên phòng" },
  { value: "-memberCount", label: "Đông người trước" },
  { value: "memberCount", label: "Ít người trước" },
];

const comparers: Record<string, (first: RoomSummary, second: RoomSummary) => number> = {
  groupNo: (first, second) => (first.groupNo ?? 0) - (second.groupNo ?? 0),
  name: (first, second) => first.name.localeCompare(second.name, "vi"),
  "-memberCount": (first, second) => second.memberCount - first.memberCount || (first.groupNo ?? 0) - (second.groupNo ?? 0),
  memberCount: (first, second) => first.memberCount - second.memberCount || (first.groupNo ?? 0) - (second.groupNo ?? 0),
};

const pageSize = 12;

function GroupCard({ room, exception }: { room: RoomSummary; exception: boolean }) {
  return (
    <Link to={`/rooms/${room.id}`} aria-label={`Nhóm ${room.groupNo}, ${room.name}`} className="flex flex-col gap-2.5 rounded-xl border bg-card p-[18px] shadow-card transition-colors outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
      <span className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-bold">
          Nhóm {room.groupNo}: {room.name}
        </span>
        <span className="flex flex-wrap gap-1.5">
          <Badge tone="good" icon={Award}>
            Chính thức
          </Badge>
          {exception && (
            <Badge tone="warn" icon={TriangleAlert}>
              Ngoại lệ
            </Badge>
          )}
        </span>
      </span>
      <span className="text-[13px] text-muted-foreground">{room.topic ?? "Chưa có đề tài"}</span>
      <span className="flex flex-wrap items-center gap-1.5">
        <Badge icon={Crown}>{room.leaderName || "Chưa có"}</Badge>
        <Badge icon={UsersRound}>
          {room.memberCount}/{room.capacity} người
        </Badge>
        <Badge icon={Layers}>{room.groupTypeCode}</Badge>
        <MajorChips majors={room.majors} />
        {exception && (
          <Badge tone="warn" icon={TriangleAlert}>
            Thiếu ngành: {missingMajorsText({ missingMajorSeats: room.missingMajorSeats ?? 0, majors: room.majors ?? [] })}
          </Badge>
        )}
      </span>
      <SeatStrip capacity={room.capacity} memberCount={room.memberCount} majors={room.majors} missingMajorSeats={room.missingMajorSeats} />
    </Link>
  );
}

export function FinalSection({ course, result }: { course: Course; result: FinalizeResult | null }) {
  const rooms = useAllRooms(course.id);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("groupNo");
  const [page, setPage] = useState(1);
  const all = rooms.data ?? [];
  const query = foldText(search.trim());
  const matches = all.filter((room) => foldText(`${room.name} ${room.topic ?? ""}`).includes(query)).sort(comparers[sort]);
  const exceptions = all.filter((room) => !roomIsEligible(room, course.minGroupSize));
  const seated = all.reduce((sum, room) => sum + room.memberCount, 0);
  const totalPages = Math.max(Math.ceil(matches.length / pageSize), 1);
  const current = Math.min(page, totalPages);
  const shown = matches.slice((current - 1) * pageSize, current * pageSize);

  return (
    <div className="space-y-5">
      <CourseHeader
        course={course}
        hideLecturer
        title="Nhóm chính thức"
        description="Danh sách đã chốt và chỉ xem."
        meta={
          <>
            <Badge icon={Eye}>Chỉ xem</Badge>
            <LinkButton to={`/admin/courses/${course.id}/roster`} variant="link" size="sm" className="h-auto p-0">
              <UsersRound />
              Danh sách sinh viên, chỉ xem
            </LinkButton>
          </>
        }
        aside={
          <SummaryCard icon={Award} label="Đã chốt nhóm" value={`${all.length} nhóm`}>
            <span className="text-xs">
              {seated}/{course.studentCount} sinh viên đã có nhóm
            </span>
            {exceptions.length > 0 && (
              <Badge tone="warn" icon={TriangleAlert} className="self-start">
                {exceptions.length} nhóm ngoại lệ
              </Badge>
            )}
            <span className="text-xs text-muted-foreground">Chốt nhóm lúc {formatDateTime(course.finalizedAt)}</span>
          </SummaryCard>
        }
      />

      {result && (
        <Section title={`Đã chốt ${result.groups} nhóm, xoá ${result.deletedRooms} phòng trống`} icon={Award}>
          <Criteria columns={3}>
            <Criterion label="Nhóm chính thức">{result.groups} nhóm</Criterion>
            <Criterion label="Phòng trống đã xoá">{result.deletedRooms} phòng</Criterion>
            <Criterion label="Sinh viên và giảng viên">Đã nhận thông báo chốt nhóm</Criterion>
          </Criteria>
          <Notice tone="neutral" icon={Info}>
            Số phòng đã xoá chỉ hiện lần này. Sau đó không xem lại được.
          </Notice>
        </Section>
      )}

      <Section flush>
        <Toolbar>
          <SearchField
            value={search}
            placeholder="Tìm theo tên phòng hoặc đề tài"
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
          />
          <Choice label="Sắp xếp" icon={SlidersHorizontal} value={sort} options={sorts} onChange={setSort} />
        </Toolbar>
        {rooms.isLoading && (
          <div className="grid gap-4 px-[18px] pb-[18px] lg:grid-cols-2" aria-busy="true" aria-label="Đang tải">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-44 rounded-xl" />
            ))}
          </div>
        )}
        {rooms.isError && <Failure error={rooms.error} title="Không tải được danh sách nhóm" onRetry={() => void rooms.refetch()} />}
        {rooms.isSuccess && all.length === 0 && <EmptyState icon={DoorOpen} title="Không có nhóm nào" description="Lớp không có phòng nào có người khi chốt." />}
        {rooms.isSuccess && all.length > 0 && matches.length === 0 && (
          <EmptyState
            icon={DoorOpen}
            title="Không có nhóm nào"
            description="Thử bỏ bớt bộ lọc."
            action={
              <Button variant="ghost" size="sm" onClick={() => setSearch("")}>
                <X />
                Xoá bộ lọc
              </Button>
            }
          />
        )}
        {shown.length > 0 && (
          <div className="grid gap-4 px-[18px] pb-[18px] lg:grid-cols-2">
            {shown.map((room) => (
              <GroupCard key={room.id} room={room} exception={!roomIsEligible(room, course.minGroupSize)} />
            ))}
          </div>
        )}
        {matches.length > 0 && <Pager pagination={{ page: current, pageSize, totalItems: matches.length, totalPages }} page={current} onPage={setPage} unit="nhóm" />}
      </Section>

      {exceptions.length > 0 && (
        <Criteria columns={3}>
          <Criterion label="Nhóm ngoại lệ">{exceptions.length} nhóm chưa đủ điều kiện</Criterion>
          <Criterion label="Vẫn là nhóm">Chính thức, do giáo vụ chấp nhận khi chốt</Criterion>
          <Criterion label="Sửa lại">Không thể sau khi chốt</Criterion>
        </Criteria>
      )}
    </div>
  );
}
