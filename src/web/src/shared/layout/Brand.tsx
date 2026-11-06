import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8 shrink-0", className)} aria-hidden>
      <rect className="fill-(--logo-plate)" width="32" height="32" rx="8" />
      <rect className="fill-(--logo-blue)" x="7" y="7" width="8" height="8" rx="2" />
      <rect className="fill-(--logo-orange)" x="17" y="7" width="8" height="8" rx="2" />
      <rect className="fill-(--logo-green)" x="7" y="17" width="8" height="8" rx="2" />
      <rect className="fill-none stroke-(--logo-line) [stroke-dasharray:2_1.6]" x="17.75" y="17.75" width="6.5" height="6.5" rx="1.5" strokeWidth="1.5" />
    </svg>
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
