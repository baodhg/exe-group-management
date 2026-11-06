import { Code2, Globe, Megaphone, Palette, Shapes, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MajorCount } from "../common/types";
import { seatsFor } from "./seatLayout";

function MajorIcon({ code }: { code: string }) {
  const className = "size-3.5 shrink-0";
  switch (code) {
    case "SE":
      return <Code2 className={className} aria-hidden />;
    case "MKT":
      return <Megaphone className={className} aria-hidden />;
    case "GD":
      return <Palette className={className} aria-hidden />;
    case "IB":
      return <Globe className={className} aria-hidden />;
    default:
      return <Shapes className={className} aria-hidden />;
  }
}

export function MajorTag({ code, className }: { code: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border border-input px-2 py-px text-xs/[18px] font-medium whitespace-nowrap", className)}>
      <MajorIcon code={code} />
      {code}
    </span>
  );
}

export function SeatLegend({ className }: { className?: string }) {
  const item = (label: string, swatch: string) => (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("h-3 w-[22px] shrink-0 rounded-full", swatch)} aria-hidden />
      {label}
    </span>
  );

  return (
    <div className={cn("flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-xs text-muted-foreground", className)}>
      {item("Đã có người, ghi theo ngành", "bg-seat")}
      {item("Giữ cho ngành còn thiếu", "border border-dashed border-primary bg-deadline-soft")}
      {item("Còn trống", "border border-dashed border-border")}
    </div>
  );
}

export function SeatStrip({
  capacity,
  memberCount,
  majors,
  missingMajorSeats = 0,
  className,
}: {
  capacity: number;
  memberCount: number;
  majors?: readonly MajorCount[];
  missingMajorSeats?: number;
  className?: string;
}) {
  const seats = seatsFor(capacity, memberCount, majors, missingMajorSeats);
  const reserved = seats.filter((seat) => seat.kind === "reserved").length;
  const label = reserved > 0 ? `${memberCount} trên ${capacity} chỗ có người, ${reserved} chỗ phải dành cho ngành còn thiếu` : `${memberCount} trên ${capacity} chỗ có người`;

  return (
    <div role="img" aria-label={label} className={cn("grid w-full auto-cols-fr grid-flow-col gap-1", className)}>
      {seats.map((seat, index) => (
        <span
          key={index}
          className={cn(
            "flex h-6 min-w-0 items-center justify-center rounded-full text-[10px] font-semibold",
            seat.kind === "member" && "bg-seat text-seat-foreground",
            seat.kind === "reserved" && "border border-dashed border-primary bg-deadline-soft text-ink",
            seat.kind === "free" && "border border-dashed border-border",
          )}
        >
          {seat.kind === "free" ? null : seat.code ?? (seat.kind === "reserved" ? "Khác" : null)}
        </span>
      ))}
    </div>
  );
}

export function MajorChip({ major, showRequired = true }: { major: MajorCount; showRequired?: boolean }) {
  const short = major.members < major.required;

  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border border-input px-2 py-px text-xs/[18px] font-medium whitespace-nowrap", short && "border-current text-ink")}>
      <MajorIcon code={major.majorCode} />
      {major.majorCode}
      <span className="tabular">{showRequired && major.required > 0 ? `${major.members}/${major.required}` : major.members}</span>
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

export function SkillTags({ skills }: { skills: readonly { skillCode: string; level: number }[] }) {
  if (skills.length === 0) {
    return <span className="text-xs text-muted-foreground">Chưa tự chấm kỹ năng</span>;
  }

  return (
    <span className="flex flex-wrap gap-1.5">
      {skills.map((skill) => (
        <span key={skill.skillCode} className="inline-flex items-center gap-1.5 rounded-full border border-input px-2 py-px text-xs/[18px] font-medium">
          <Star className="size-3.5 shrink-0" aria-hidden />
          {skill.skillCode}
          <span className="tabular">{skill.level}</span>
        </span>
      ))}
    </span>
  );
}
