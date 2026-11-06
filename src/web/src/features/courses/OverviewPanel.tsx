import { CircleAlert, CircleCheck, Clock, DoorOpen, TriangleAlert, UsersRound } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link } from "react-router";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { CourseOverview } from "../common/types";
import { Badge, Criteria, Criterion, EmptyState, Pager, Section, StatTile } from "../common/ui";
import { MajorTag, SeatStrip } from "../rooms/seats";
import { attentionTitle, missingMajorsText, missingMembersText, unplacedByMajor, type Attention } from "./overview";

function placedShareOf(data: Pick<CourseOverview, "placedCount" | "studentCount">): number {
  return data.studentCount > 0 ? Math.round((data.placedCount / data.studentCount) * 100) : 0;
}

export function OverviewTiles({ data, columns = 4 }: { data: CourseOverview; columns?: 2 | 4 }) {
  const activeRooms = data.roomCount - data.emptyRoomCount;
  return (
    <div className={columns === 4 ? "grid gap-4 sm:grid-cols-2 xl:grid-cols-4" : "grid gap-4 sm:grid-cols-2"}>
      <StatTile icon={UsersRound} label="Đã có phòng" value={`${data.placedCount}/${data.studentCount}`} hint={`${placedShareOf(data)}% sinh viên`} />
      <StatTile icon={Clock} label="Chưa có phòng" value={data.unplaced.length} hint={data.unplaced.length > 0 ? "Cần xếp trước khi chốt" : "Không còn ai"} />
      <StatTile icon={CircleCheck} label="Phòng đủ điều kiện" value={`${data.eligibleRoomCount}/${activeRooms}`} hint="Trên số phòng đã có người" />
      <StatTile icon={DoorOpen} label="Phòng trống" value={data.emptyRoomCount} hint={`Trong ${data.roomCount} phòng`} />
    </div>
  );
}

export function PlacementProgress({ data }: { data: CourseOverview }) {
  return (
    <Section>
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <UsersRound className="size-3.5" aria-hidden />
          Tiến độ xếp phòng
        </span>
        <strong className="tabular">{placedShareOf(data)}%</strong>
      </div>
      <progress value={data.placedCount} max={Math.max(data.studentCount, 1)} aria-label="Tiến độ xếp phòng" />
    </Section>
  );
}

export function UnplacedMajors({ data, compact = false }: { data: Pick<CourseOverview, "unplaced">; compact?: boolean }) {
  const majors = unplacedByMajor(data.unplaced);
  return (
    <Section title={compact ? "Chưa có phòng theo ngành" : undefined} icon={compact ? DoorOpen : undefined}>
      {!compact && (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <DoorOpen className="size-3.5" aria-hidden />
          Chưa có phòng theo ngành
        </span>
      )}
      <ul className="divide-y">
        {majors.map((major) => (
          <li key={major.code} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
            <MajorTag code={major.code} />
            <strong className="tabular">{major.count}</strong>
          </li>
        ))}
      </ul>
    </Section>
  );
}

export function AttentionCard({ attention }: { attention: Attention }) {
  return (
    <Section>
      <Badge tone="warn" icon={TriangleAlert} className="self-start">
        Cần chú ý
      </Badge>
      <strong className="text-[15px] font-bold">{attentionTitle(attention)}</strong>
      <Criteria>
        <Criterion label={`Phòng cần ${attention.majorCode}`}>{attention.rooms.join(", ")}</Criterion>
        <Criterion label={`${attention.majorCode} chưa có phòng`}>{attention.people} bạn</Criterion>
      </Criteria>
    </Section>
  );
}

export function IneligibleRooms({ data }: { data: CourseOverview }) {
  return (
    <Section title="Phòng chưa đủ điều kiện" icon={CircleAlert} description="Thiếu người hoặc thiếu ngành theo loại nhóm.">
      {data.ineligibleRooms.length === 0 ? (
        <EmptyState icon={CircleCheck} title="Không có phòng nào thiếu người hoặc thiếu ngành." />
      ) : (
        <ul className="divide-y">
          {data.ineligibleRooms.map((item) => (
            <li key={item.room.id} className="space-y-2 py-3 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link to={`/rooms/${item.room.id}`} className="font-semibold underline-offset-2 hover:underline">
                  {item.room.name}
                </Link>
                <span className="flex flex-wrap items-center gap-1.5">
                  {item.missingMembers > 0 && <Badge icon={UsersRound}>Thiếu {missingMembersText(item, data.minGroupSize)}</Badge>}
                  {item.missingMajorSeats > 0 && <Badge icon={DoorOpen}>Thiếu ngành: {missingMajorsText(item)}</Badge>}
                </span>
              </div>
              <SeatStrip capacity={item.room.capacity} memberCount={item.room.memberCount} majors={item.room.majors} missingMajorSeats={item.missingMajorSeats} />
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

const unplacedPageSize = 8;

export function UnplacedStudents({ data, emptyAction }: { data: CourseOverview; emptyAction?: ReactNode }) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(Math.ceil(data.unplaced.length / unplacedPageSize), 1);
  const current = Math.min(page, totalPages);
  const shown = data.unplaced.slice((current - 1) * unplacedPageSize, current * unplacedPageSize);

  return (
    <Section flush title="Sinh viên chưa có phòng" icon={UsersRound}>
      {data.unplaced.length === 0 ? (
        <EmptyState icon={CircleCheck} title={data.studentCount === 0 ? "Lớp chưa có sinh viên" : "Mọi sinh viên đã có phòng."} action={data.studentCount === 0 ? emptyAction : undefined} />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sinh viên</TableHead>
                <TableHead>Ngành</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((student) => (
                <TableRow key={student.studentId}>
                  <TableCell>
                    <span className="block font-semibold">{student.fullName}</span>
                    <span className="block text-xs text-muted-foreground">{student.studentCode}</span>
                  </TableCell>
                  <TableCell>
                    <MajorTag code={student.majorCode} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pager pagination={{ page: current, pageSize: unplacedPageSize, totalItems: data.unplaced.length, totalPages }} page={current} onPage={setPage} unit="sinh viên" />
        </>
      )}
    </Section>
  );
}

export function OverviewSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Đang tải">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-20 rounded-xl" />
      <Skeleton className="h-72 rounded-xl" />
    </div>
  );
}
