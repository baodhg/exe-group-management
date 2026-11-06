import { useId } from "react";
import { cn } from "@/lib/utils";

type SeatKind = "taken" | "needed" | "free" | "yours";

const seatWidth = 64;
const seatHeight = 28;
const columnStep = 72;
const rowStep = 42;

const rooms: readonly (readonly SeatKind[])[] = [
  ["taken", "taken", "taken", "needed", "free", "free"],
  ["taken", "yours", "taken", "taken", "free", "free"],
  ["taken", "taken", "needed", "free", "free", "free"],
  ["taken", "taken", "taken", "taken", "yours", "free"],
  ["taken", "needed", "free", "free", "free", "free"],
  ["taken", "taken", "taken", "taken", "taken", "taken"],
];

const seatClass: Record<SeatKind, string> = {
  taken: "fill-muted stroke-none",
  needed: "fill-primary/15 stroke-primary [stroke-dasharray:4_3]",
  free: "fill-none stroke-input [stroke-dasharray:4_3]",
  yours: "fill-primary stroke-none",
};

export function SeatPattern({ className }: { className?: string }) {
  const id = useId();
  return (
    <svg className={cn("pointer-events-none absolute inset-0 size-full opacity-85", className)} aria-hidden>
      <defs>
        <pattern id={id} width={columnStep * 6} height={rowStep * rooms.length} patternUnits="userSpaceOnUse" patternTransform="rotate(-8)">
          {rooms.map((seats, row) =>
            seats.map((kind, column) => (
              <rect key={`${row}-${column}`} className={seatClass[kind]} x={column * columnStep + 4} y={row * rowStep + 7} width={seatWidth} height={seatHeight} rx={seatHeight / 2} />
            )),
          )}
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}
