import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "../../shared/auth/useAuth";
import type { CourseOverview } from "../common/types";
import { ErrorNote, Section, StatTile } from "../common/ui";
import { MajorChips, SeatStrip } from "../rooms/seats";
import { missingMajorsText, missingMembersText } from "./overview";

export function OverviewPanel({ courseId }: { courseId: string }) {
  const { api } = useAuth();
  const overview = useQuery({
    queryKey: ["overview", courseId],
    queryFn: () => api.get<CourseOverview>(`/api/v1/courses/${courseId}/overview`),
  });

  if (overview.isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-24 rounded-xl" />
        ))}
      </div>
    );
  }

  if (!overview.data) {
    return <ErrorNote error={overview.error} />;
  }

  const data = overview.data.data;
  const activeRooms = data.roomCount - data.emptyRoomCount;
  const placedShare = data.studentCount > 0 ? Math.round((data.placedCount / data.studentCount) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Đã có phòng" value={`${data.placedCount}/${data.studentCount}`} hint={`${placedShare}% sinh viên`} tone={data.unplaced.length === 0 ? "good" : "info"} />
        <StatTile label="Chưa có phòng" value={data.unplaced.length} hint={data.unplaced.length > 0 ? "Cần xếp trước khi chốt" : "Không còn ai"} tone={data.unplaced.length > 0 ? "warn" : "good"} />
        <StatTile
          label="Phòng đủ điều kiện"
          value={`${data.eligibleRoomCount}/${activeRooms}`}
          hint="Trên số phòng đã có người"
          tone={data.eligibleRoomCount === activeRooms ? "good" : "warn"}
        />
        <StatTile label="Phòng trống" value={data.emptyRoomCount} hint={`Trong ${data.roomCount} phòng`} />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">Tiến độ xếp phòng</span>
          <span className="tabular text-muted-foreground">{placedShare}%</span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={placedShare} aria-label="Tiến độ xếp phòng">
          <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${placedShare}%` }} />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Section title="Phòng chưa đủ điều kiện" description="Thiếu người hoặc thiếu ngành theo loại nhóm.">
          {data.ineligibleRooms.length === 0 ? (
            <p className="text-sm text-muted-foreground">Không có phòng nào thiếu người hoặc thiếu ngành.</p>
          ) : (
            <ul className="divide-y">
              {data.ineligibleRooms.map((item) => (
                <li key={item.room.id} className="space-y-2 py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between gap-3">
                    <Link to={`/rooms/${item.room.id}`} className="font-medium hover:underline">
                      {item.room.name}
                    </Link>
                    <SeatStrip size="sm" capacity={item.room.capacity} memberCount={item.room.memberCount} majors={item.majors} missingMajorSeats={item.missingMajorSeats} />
                  </div>
                  <MajorChips majors={item.majors} />
                  <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
                    <dt className="text-muted-foreground">Thiếu người</dt>
                    <dd>{missingMembersText(item, data.minGroupSize)}</dd>
                    <dt className="text-muted-foreground">Thiếu ngành</dt>
                    <dd>{missingMajorsText(item)}</dd>
                  </dl>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Sinh viên chưa có phòng" description={data.unplaced.length > 0 ? `${data.unplaced.length} sinh viên` : undefined}>
          {data.unplaced.length === 0 ? (
            <p className="text-sm text-muted-foreground">Mọi sinh viên đã có phòng.</p>
          ) : (
            <ul className="max-h-96 divide-y overflow-y-auto">
              {data.unplaced.map((student) => (
                <li key={student.studentId} className="flex items-center justify-between gap-3 py-2 text-sm first:pt-0">
                  <span className="min-w-0 truncate">
                    <span className="font-medium">{student.fullName}</span>
                    <span className="ml-2 text-muted-foreground">{student.studentCode}</span>
                  </span>
                  <span className="shrink-0 rounded-md bg-muted px-2 py-0.5 text-xs font-medium">{student.majorCode}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </div>
  );
}
