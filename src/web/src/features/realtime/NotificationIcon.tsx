import { Award, Clock, Crown, DoorOpen, Inbox, MoveRight, Users, X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Look = { icon: LucideIcon; tone: string };

const good = "bg-success-soft text-success-ink";
const warn = "bg-deadline-soft text-ink";
const info = "bg-info-soft text-info-ink";
const plain = "bg-muted text-foreground";

function lookOf(type: string, title: string): Look {
  if (type.startsWith("JoinRequestSubmitted")) return { icon: Inbox, tone: warn };
  if (type.startsWith("JoinRequestDecided")) return title.includes("duyệt") ? { icon: DoorOpen, tone: good } : { icon: X, tone: warn };
  if (type.startsWith("RoomLeader")) return { icon: Crown, tone: info };
  if (type.startsWith("RoomMemberJoined")) return { icon: Users, tone: plain };
  if (type.startsWith("RoomMemberLeft")) return { icon: MoveRight, tone: warn };
  if (type.startsWith("CoursePhase") && title.includes("hết hạn")) return { icon: Clock, tone: warn };
  if (type.startsWith("CoursePhase")) return title.includes("chốt") ? { icon: Award, tone: good } : { icon: DoorOpen, tone: info };
  return { icon: Inbox, tone: plain };
}

export function NotificationIcon({ type, title, className }: { type: string; title: string; className?: string }) {
  const { icon: Icon, tone } = lookOf(type, title);
  return (
    <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", tone, className)} aria-hidden>
      <Icon className="size-4" />
    </span>
  );
}
