import { Award, Clock, DoorOpen, Lock, SlidersHorizontal, type LucideIcon } from "lucide-react";
import { phaseLabels, phaseTones } from "../common/messages";
import type { CoursePhase, RoomSummary } from "../common/types";
import { Badge, type Tone } from "../common/ui";

const phaseIcons: Record<CoursePhase, LucideIcon> = {
  Setup: SlidersHorizontal,
  Published: DoorOpen,
  Expired: Clock,
  Finalized: Award,
};

export function PhaseChip({ phase }: { phase: CoursePhase }) {
  return (
    <Badge tone={phaseTones[phase]} icon={phaseIcons[phase]}>
      {phaseLabels[phase]}
    </Badge>
  );
}

const roomStatuses: Record<RoomSummary["status"], { label: string; tone: Tone; icon: LucideIcon }> = {
  Open: { label: "Đang mở", tone: "info", icon: DoorOpen },
  Locked: { label: "Đã khoá", tone: "neutral", icon: Lock },
  Finalized: { label: "Chính thức", tone: "good", icon: Award },
};

export function RoomStatusChip({ status }: { status: RoomSummary["status"] }) {
  const view = roomStatuses[status];
  return (
    <Badge tone={view.tone} icon={view.icon}>
      {view.label}
    </Badge>
  );
}
