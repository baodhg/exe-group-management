import { ChevronDown, ChevronLeft, ChevronRight, CircleAlert, CircleCheck, Info, Search, TriangleAlert, type LucideIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { Pagination } from "../../shared/api/types";
import { errorText } from "./messages";

export type Tone = "neutral" | "good" | "warn" | "bad" | "info";

const toneClasses: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground",
  good: "bg-success-soft text-success-ink",
  warn: "bg-deadline-soft text-deadline-ink",
  bad: "bg-danger-soft text-danger-ink",
  info: "bg-info-soft text-info-ink",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap", toneClasses[tone], className)}>{children}</span>;
}

export function ErrorNote({ error }: { error: unknown }) {
  if (!error) {
    return null;
  }

  return (
    <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/25 bg-danger-soft px-3 py-2.5 text-sm text-danger-ink">
      <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{errorText(error)}</span>
    </div>
  );
}

export function Pager({ pagination, page, onPage, unit }: { pagination?: Pagination; page: number; onPage: (page: number) => void; unit: string }) {
  if (!pagination || pagination.totalItems === 0) {
    return null;
  }

  return (
    <div className="flex items-center justify-between gap-3 pt-4 text-sm text-muted-foreground">
      <span className="tabular">
        {pagination.totalItems} {unit}
      </span>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Trang trước">
          <ChevronLeft />
        </Button>
        <span className="tabular min-w-16 text-center">
          {pagination.page} / {Math.max(pagination.totalPages, 1)}
        </span>
        <Button variant="outline" size="sm" disabled={page >= pagination.totalPages} onClick={() => onPage(page + 1)} aria-label="Trang sau">
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}

export function Loading({ when, rows = 3 }: { when: boolean; rows?: number }) {
  if (!when) {
    return null;
  }

  return (
    <div className="space-y-3" aria-busy="true" aria-label="Đang tải">
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-12 w-full" />
      ))}
    </div>
  );
}

export interface Crumb {
  label: string;
  to?: string;
}

export function PageHeader({ title, description, crumbs, actions, meta }: { title: ReactNode; description?: ReactNode; crumbs?: Crumb[]; actions?: ReactNode; meta?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 space-y-1.5">
        {crumbs && crumbs.length > 0 && (
          <nav aria-label="Đường dẫn" className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
            {crumbs.map((crumb, index) => (
              <span key={`${crumb.label}-${index}`} className="flex items-center gap-1">
                {index > 0 && <ChevronRight className="size-3.5" aria-hidden />}
                {crumb.to ? (
                  <Link to={crumb.to} className="hover:text-foreground hover:underline">
                    {crumb.label}
                  </Link>
                ) : (
                  <span>{crumb.label}</span>
                )}
              </span>
            ))}
          </nav>
        )}
        <h1 className="text-2xl font-semibold tracking-tight sm:text-[1.75rem]">{title}</h1>
        {description && <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>}
        {meta && <div className="flex flex-wrap items-center gap-2 pt-1">{meta}</div>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Section({ title, description, actions, children, className }: { title?: ReactNode; description?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-xl border bg-card p-5 sm:p-6", className)}>
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            {title && <h2 className="text-lg font-semibold">{title}</h2>}
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function EmptyState({ icon: Icon, title, description, action }: { icon: LucideIcon; title: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-6 py-10 text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-5" aria-hidden />
      </span>
      <p className="font-medium">{title}</p>
      {description && <p className="max-w-md text-sm text-muted-foreground">{description}</p>}
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
}

const stripes: Record<Tone, string> = {
  neutral: "",
  good: "border-l-4 border-l-success",
  warn: "border-l-4 border-l-deadline",
  bad: "border-l-4 border-l-destructive",
  info: "border-l-4 border-l-primary",
};

export function StatTile({ label, value, hint, tone = "neutral" }: { label: string; value: ReactNode; hint?: ReactNode; tone?: Tone }) {
  return (
    <div className={cn("rounded-xl border bg-card p-4", stripes[tone])}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="tabular mt-1 text-2xl font-semibold">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function Field({ label, hint, children, className }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cn("grid gap-1.5 text-sm", className)}>
      <span className="font-medium">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

export function SearchField({ value, onChange, placeholder, className }: { value: string; onChange: (value: string) => void; placeholder: string; className?: string }) {
  return (
    <div className={cn("relative w-full sm:w-72", className)}>
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <Input type="search" value={value} placeholder={placeholder} aria-label={placeholder} className="h-9 pl-8" onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

export interface ChoiceOption<T extends string> {
  value: T;
  label: string;
}

export function Choice<T extends string>({ value, onChange, options, label, className }: { value: T; onChange: (value: T) => void; options: readonly ChoiceOption<T>[]; label: string; className?: string }) {
  return (
    <Select items={options} value={value} onValueChange={(next) => next !== null && onChange(next as T)}>
      <SelectTrigger aria-label={label} className={cn("h-9 min-w-36 data-[size=default]:h-9", className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (checked: boolean) => void; label: string }) {
  return (
    <label className="flex h-9 cursor-pointer items-center gap-2 rounded-lg border bg-card px-3 text-sm select-none">
      <Checkbox checked={checked} onCheckedChange={(next) => onChange(next === true)} />
      {label}
    </label>
  );
}

export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="mb-4 flex flex-wrap items-center gap-2">{children}</div>;
}

export function NativeSelect({ className, ...props }: ComponentProps<"select">) {
  return (
    <div className={cn("relative", className)}>
      <select
        className="h-9 w-full appearance-none rounded-lg border border-input bg-card pr-8 pl-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
        {...props}
      />
      <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
    </div>
  );
}

const noticeStyles: Record<Exclude<Tone, "neutral">, { box: string; icon: LucideIcon }> = {
  good: { box: "border-success/30 bg-success-soft text-success-ink", icon: CircleCheck },
  warn: { box: "border-deadline/30 bg-deadline-soft text-deadline-ink", icon: TriangleAlert },
  bad: { box: "border-destructive/25 bg-danger-soft text-danger-ink", icon: CircleAlert },
  info: { box: "border-primary/20 bg-info-soft text-info-ink", icon: Info },
};

export function Notice({ tone = "info", title, children, className }: { tone?: Exclude<Tone, "neutral">; title?: ReactNode; children?: ReactNode; className?: string }) {
  const style = noticeStyles[tone];
  return (
    <div role={tone === "bad" ? "alert" : "status"} className={cn("flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-sm", style.box, className)}>
      <style.icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="space-y-0.5">
        {title && <p className="font-medium">{title}</p>}
        {children}
      </div>
    </div>
  );
}
