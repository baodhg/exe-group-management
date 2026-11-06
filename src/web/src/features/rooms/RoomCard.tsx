import { Crown, Shapes } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { cn } from "@/lib/utils";
import { roomStatusLabels } from "../common/messages";
import type { RoomSummary } from "../common/types";
import { Badge, type Tone } from "../common/ui";
import { missingMajors } from "./majorPalette";
import { MajorChips, SeatStrip } from "./seats";

const statusTones: Record<RoomSummary["status"], Tone> = { Open: "good", Locked: "warn", Finalized: "info" };

export function RoomStatusBadge({ status }: { status: RoomSummary["status"] }) {
  return <Badge tone={statusTones[status]}>{roomStatusLabels[status]}</Badge>;
}

export function RoomCard({
  room,
  mine = false,
  showGroupNo = false,
  footer,
  children,
}: {
  room: RoomSummary;
  mine?: boolean;
  showGroupNo?: boolean;
  footer?: ReactNode;
  children?: ReactNode;
}) {
  const missing = missingMajors(room.majors);
  const reserved = room.missingMajorSeats ?? 0;

  return (
    <article
      className={cn(
        "group relative flex flex-col gap-3 rounded-xl border bg-card p-4 transition-shadow hover:shadow-md focus-within:ring-3 focus-within:ring-ring/40",
        mine && "border-primary/50 ring-1 ring-primary/30",
      )}
    >
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {showGroupNo && room.groupNo !== null && <p className="text-xs font-medium text-muted-foreground">Nhóm {room.groupNo}</p>}
          <h3 className="truncate text-base font-semibold">
            <Link to={`/rooms/${room.id}`} className="outline-none after:absolute after:inset-0 after:rounded-xl">
              {room.name}
            </Link>
          </h3>
          <p className={cn("line-clamp-2 text-sm", room.topic ? "text-foreground/80" : "text-muted-foreground italic")}>{room.topic ?? "Chưa có đề tài"}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <RoomStatusBadge status={room.status} />
          {mine && <Badge tone="info">Phòng của bạn</Badge>}
        </div>
      </header>

      <div className="flex items-center justify-between gap-3">
        <SeatStrip capacity={room.capacity} memberCount={room.memberCount} majors={room.majors} missingMajorSeats={reserved} />
        <span className="tabular shrink-0 text-sm font-medium">
          {room.memberCount}/{room.capacity}
        </span>
      </div>

      <MajorChips majors={room.majors} />

      {missing.length > 0 && room.status !== "Finalized" && (
        <p className="text-xs text-deadline-ink">
          Còn thiếu ngành {missing.map((major) => major.majorCode).join(", ")}
          {reserved > 0 && `, ${reserved} chỗ được giữ cho các ngành này`}
        </p>
      )}

      {children}

      <footer className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 border-t pt-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Crown className="size-3.5" aria-hidden />
          {room.leaderName ?? "Chưa có trưởng phòng"}
        </span>
        <span className="flex items-center gap-1.5">
          <Shapes className="size-3.5" aria-hidden />
          {room.groupTypeCode}
        </span>
        {footer && <span className="relative z-10 ml-auto">{footer}</span>}
      </footer>
    </article>
  );
}
