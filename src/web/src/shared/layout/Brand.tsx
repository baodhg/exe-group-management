import { UsersRound } from "lucide-react";
import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground", className)} aria-hidden>
      <UsersRound className="size-3.5" />
    </span>
  );
}

export function Brand({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <BrandMark />
      {!compact && <span className="text-[17px] font-extrabold tracking-[-0.02em] whitespace-nowrap">EXE Group</span>}
    </span>
  );
}
