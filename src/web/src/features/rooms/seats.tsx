import { cn } from "@/lib/utils";
import type { MajorCount } from "../common/types";
import { seatsFor, useMajorColor } from "./majorPalette";

export function SeatStrip({
  capacity,
  memberCount,
  majors,
  missingMajorSeats = 0,
  size = "md",
  className,
}: {
  capacity: number;
  memberCount: number;
  majors?: readonly MajorCount[];
  missingMajorSeats?: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const color = useMajorColor();
  const seats = seatsFor(capacity, memberCount, majors, missingMajorSeats);
  const reserved = seats.filter((seat) => seat.kind === "reserved").length;
  const label = reserved > 0 ? `${memberCount} trên ${capacity} chỗ có người, ${reserved} chỗ phải dành cho ngành còn thiếu` : `${memberCount} trên ${capacity} chỗ có người`;

  return (
    <div role="img" aria-label={label} className={cn("flex flex-wrap gap-1", className)}>
      {seats.map((seat, index) => (
        <span
          key={index}
          className={cn(
            "shrink-0 rounded-[4px]",
            size === "sm" && "size-3",
            size === "md" && "size-4",
            size === "lg" && "size-5",
            seat.kind === "reserved" && "border-[1.5px] border-dashed border-deadline bg-deadline-soft",
            seat.kind === "free" && "border-[1.5px] border-dashed border-input",
          )}
          style={seat.kind === "member" ? { backgroundColor: seat.majorId ? color(seat.majorId) : "var(--muted-foreground)" } : undefined}
        />
      ))}
    </div>
  );
}

export function MajorChip({ major, showRequired = true }: { major: MajorCount; showRequired?: boolean }) {
  const color = useMajorColor();
  const short = major.members < major.required;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border bg-card px-2 py-0.5 text-xs font-medium",
        short && "border-deadline/40 bg-deadline-soft text-deadline-ink",
      )}
    >
      <span className="size-2.5 shrink-0 rounded-[3px]" style={{ backgroundColor: color(major.majorId) }} aria-hidden />
      {major.majorCode}
      <span className={cn("tabular", short ? "text-deadline-ink" : "text-muted-foreground")}>
        {showRequired && major.required > 0 ? `${major.members}/${major.required}` : major.members}
      </span>
    </span>
  );
}

export function MajorChips({ majors, className }: { majors?: readonly MajorCount[]; className?: string }) {
  const shown = (majors ?? []).filter((major) => major.members > 0 || major.required > 0);
  if (shown.length === 0) {
    return null;
  }

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {shown.map((major) => (
        <MajorChip key={major.majorId} major={major} />
      ))}
    </div>
  );
}

export function MajorTag({ majorId, code }: { majorId: string; code: string }) {
  const color = useMajorColor();

  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border bg-card px-2 py-0.5 text-xs font-medium">
      <span className="size-2.5 shrink-0 rounded-[3px]" style={{ backgroundColor: color(majorId) }} aria-hidden />
      {code}
    </span>
  );
}

export function SkillTags({ skills }: { skills: readonly { skillCode: string; level: number }[] }) {
  if (skills.length === 0) {
    return <span className="text-xs text-muted-foreground">Chưa tự chấm skill</span>;
  }

  return (
    <span className="flex flex-wrap gap-1">
      {skills.map((skill) => (
        <span key={skill.skillCode} className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-xs">
          {skill.skillCode}
          <span className="tabular font-semibold">{skill.level}</span>
        </span>
      ))}
    </span>
  );
}
