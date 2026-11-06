import { Award, CircleAlert, Crown, DoorOpen, Inbox, Info, Layers, Lock, UsersRound, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { cn } from "@/lib/utils";
import { roomStatusLabels } from "../common/messages";
import type { RoomSummary } from "../common/types";
import { Badge, type Tone } from "../common/ui";
import { roomHint, type RoomHint } from "./roomBoardLogic";
import { SeatStrip } from "./seats";

const statusStyles: Record<RoomSummary["status"], { tone: Tone; icon: LucideIcon }> = {
  Open: { tone: "good", icon: DoorOpen },
  Locked: { tone: "warn", icon: Lock },
  Finalized: { tone: "good", icon: Award },
};

export function RoomStatusBadge({ status }: { status: RoomSummary["status"] }) {
  const style = statusStyles[status];
  return (
    <Badge tone={style.tone} icon={style.icon}>
      {roomStatusLabels[status]}
    </Badge>
  );
}

const hintStyles: Record<RoomHint["tone"], { className: string; icon: LucideIcon }> = {
  bad: { className: "text-danger-ink", icon: CircleAlert },
  muted: { className: "text-muted-foreground", icon: UsersRound },
  ink: { className: "text-ink", icon: Info },
};

function HintLine({ hint }: { hint: RoomHint }) {
  const style = hintStyles[hint.tone];
  const Icon = style.icon;
  return (
    <p className={cn("flex items-center gap-1.5 text-[13px] md:col-start-1", style.className)}>
      <Icon className="size-3.5 shrink-0" aria-hidden />
      {hint.text}
    </p>
  );
}

export function RoomCard({
  room,
  mine = false,
  showGroupNo = false,
  footer,
  children,
  selected = false,
  onSelect,
  pending = false,
  hint,
  exception = null,
  compact = false,
}: {
  room: RoomSummary;
  mine?: boolean;
  showGroupNo?: boolean;
  footer?: ReactNode;
  children?: ReactNode;
  selected?: boolean;
  onSelect?: () => void;
  pending?: boolean;
  hint?: RoomHint | null;
  exception?: string | null;
  compact?: boolean;
}) {
  const title = showGroupNo && room.groupNo !== null ? `Nhóm ${room.groupNo}: ${room.name}` : room.name;
  const line = hint === undefined ? roomHint(room) : hint;
  const stretched = "text-left outline-none after:absolute after:inset-0 focus-visible:after:ring-2 focus-visible:after:ring-ring focus-visible:after:ring-inset";

  return (
    <article className={cn("relative grid grid-cols-1 items-center gap-x-5 gap-y-1 border-t px-4 py-3 transition-colors first:border-t-0 hover:bg-muted md:grid-cols-[minmax(0,1fr)_250px]", (selected || (mine && !onSelect)) && "bg-primary/10 hover:bg-primary/10")}>
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 md:col-start-1">
        <h3 className="text-[15px] font-bold">
          {onSelect ? (
            <button type="button" aria-pressed={selected} onClick={onSelect} className={stretched}>
              {title}
            </button>
          ) : (
            <Link to={`/rooms/${room.id}`} className={stretched}>
              {title}
            </Link>
          )}
        </h3>
        <RoomStatusBadge status={room.status} />
        {exception && (
          <Badge tone="warn" icon={CircleAlert}>
            Ngoại lệ
          </Badge>
        )}
        {mine && (
          <Badge tone="info" icon={DoorOpen}>
            Phòng của bạn
          </Badge>
        )}
        {pending && (
          <Badge tone="info" icon={Inbox}>
            Đơn đang chờ
          </Badge>
        )}
      </div>
      <p className="text-[13px] text-muted-foreground md:col-start-1">{room.topic ?? "Chưa có đề tài"}</p>
      <SeatStrip capacity={room.capacity} memberCount={room.memberCount} majors={room.majors} missingMajorSeats={room.missingMajorSeats ?? 0} className="my-1 md:col-start-2 md:row-span-3 md:row-start-1 md:my-0" />
      {!compact && (
        <div className="flex flex-wrap items-center gap-1.5 md:col-start-1">
          <Badge icon={UsersRound}>
            <span className="tabular">
              {room.memberCount}/{room.capacity}
            </span>
          </Badge>
          <Badge icon={Layers}>{room.groupTypeCode}</Badge>
          <span className={cn("inline-flex items-center gap-1.5 text-[13px] text-muted-foreground", !room.leaderName && "font-semibold")}>
            <Crown className="size-3.5 shrink-0" aria-hidden />
            {room.leaderName ? `Trưởng nhóm: ${room.leaderName}` : "Chưa có trưởng nhóm"}
          </span>
          {footer && <span className="relative z-10 ml-auto">{footer}</span>}
        </div>
      )}
      {exception ? (
        <p className="flex items-center gap-1.5 text-[13px] text-ink md:col-start-1">
          <CircleAlert className="size-3.5 shrink-0" aria-hidden />
          {exception}
        </p>
      ) : (
        line && <HintLine hint={line} />
      )}
      {children && <div className="md:col-start-1">{children}</div>}
    </article>
  );
}
