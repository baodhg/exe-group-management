import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8 shrink-0", className)} aria-hidden>
      <rect width="32" height="32" rx="8" fill="#263a59" />
      <rect x="7" y="7" width="8" height="8" rx="2" fill="#2a78d6" />
      <rect x="17" y="7" width="8" height="8" rx="2" fill="#eb6834" />
      <rect x="7" y="17" width="8" height="8" rx="2" fill="#1baf7a" />
      <rect x="17.75" y="17.75" width="6.5" height="6.5" rx="1.5" fill="none" stroke="#dfe6f1" strokeWidth="1.5" strokeDasharray="2 1.6" />
    </svg>
  );
}

export function Brand({ tone = "dark", className }: { tone?: "dark" | "light"; className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <BrandMark />
      <span className="leading-tight">
        <span className={cn("block text-[0.95rem] font-semibold", tone === "dark" ? "text-sidebar-primary" : "text-foreground")}>EXE Group</span>
        <span className={cn("block text-xs", tone === "dark" ? "text-sidebar-muted" : "text-muted-foreground")}>Ghép nhóm liên ngành</span>
      </span>
    </span>
  );
}
