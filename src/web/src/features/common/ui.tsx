import { Check, ChevronDown, ChevronLeft, ChevronRight, CircleAlert, CircleCheck, Info, RefreshCw, Search, TriangleAlert, X, type LucideIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { Pagination } from "../../shared/api/types";
import { errorText, traceIdOf } from "./messages";

export type Tone = "neutral" | "good" | "warn" | "bad" | "info";

const toneClasses: Record<Tone, string> = {
  neutral: "text-muted-foreground border-input",
  good: "text-success-ink border-current",
  warn: "text-ink border-current",
  bad: "text-danger-ink border-current",
  info: "text-info-ink border-current",
};

export function Badge({ tone = "neutral", icon: Icon, children, className }: { tone?: Tone; icon?: LucideIcon; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2 py-px text-xs/[18px] font-medium whitespace-nowrap", toneClasses[tone], className)}>
      {Icon && <Icon className="size-3.5 shrink-0" aria-hidden />}
      {children}
    </span>
  );
}

export function Count({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("tabular inline-flex min-w-[18px] justify-center rounded-full bg-primary px-1.5 text-xs/[18px] font-bold text-primary-foreground", className)}>{children}</span>;
}

export function ErrorNote({ error, className }: { error: unknown; className?: string }) {
  if (!error) {
    return null;
  }

  return <Notice tone="bad" className={className}>{errorText(error)}</Notice>;
}

export function Failure({ error, title = "Không tải được dữ liệu", onRetry, action, className }: { error?: unknown; title?: string; onRetry?: () => void; action?: ReactNode; className?: string }) {
  const trace = error ? traceIdOf(error) : null;
  return (
    <div role="alert" className={cn("flex flex-col items-center gap-2 px-[18px] py-8 text-center text-sm text-muted-foreground", className)}>
      <span className="flex size-11 items-center justify-center rounded-full bg-danger-soft text-danger-ink">
        <CircleAlert className="size-[18px]" aria-hidden />
      </span>
      <p className="font-semibold text-foreground">{title}</p>
      {error !== undefined && error !== null && <p className="max-w-md">{errorText(error)}</p>}
      {trace && <p className="tabular text-xs">Mã lỗi: {trace}</p>}
      {(onRetry || action) && (
        <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
          {onRetry && (
            <Button variant="outline" size="sm" onClick={onRetry}>
              <RefreshCw aria-hidden />
              Thử lại
            </Button>
          )}
          {action}
        </div>
      )}
    </div>
  );
}

export function Pager({ pagination, page, onPage, unit, className }: { pagination?: Pagination; page: number; onPage: (page: number) => void; unit: string; className?: string }) {
  if (!pagination || pagination.totalItems === 0) {
    return null;
  }

  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-2 border-t px-[18px] py-3.5 text-[13px] text-muted-foreground", className)}>
      <span className="tabular">
        {pagination.totalItems} {unit}
      </span>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon-sm" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Trang trước">
          <ChevronLeft />
        </Button>
        <span className="tabular min-w-14 text-center">
          {pagination.page} / {Math.max(pagination.totalPages, 1)}
        </span>
        <Button variant="outline" size="icon-sm" disabled={page >= pagination.totalPages} onClick={() => onPage(page + 1)} aria-label="Trang sau">
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}

export function Loading({ when, rows = 3, className }: { when: boolean; rows?: number; className?: string }) {
  if (!when) {
    return null;
  }

  return (
    <div className={cn("space-y-2 px-[18px] py-3.5", className)} aria-busy="true" aria-label="Đang tải">
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-11 w-full rounded-[10px]" />
      ))}
    </div>
  );
}

export function PageLoading({ blocks = 2 }: { blocks?: number }) {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Đang tải">
      <Skeleton className="h-8 w-72 rounded-full" />
      <Skeleton className="h-3 w-96 max-w-full rounded-full" />
      {Array.from({ length: blocks }, (_, index) => (
        <Skeleton key={index} className="h-72 w-full rounded-xl" />
      ))}
    </div>
  );
}

export interface Crumb {
  label: string;
  to?: string;
}

export function Crumbs({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <nav aria-label="Đường dẫn" className="flex flex-wrap items-center gap-1.5 text-[13px] text-muted-foreground">
      {crumbs.map((crumb, index) => (
        <span key={`${crumb.label}-${index}`} className="inline-flex items-center gap-1.5">
          {index > 0 && <span className="text-input" aria-hidden>/</span>}
          {crumb.to ? (
            <Link to={crumb.to} className="hover:text-foreground hover:underline">
              {crumb.label}
            </Link>
          ) : (
            <span aria-current="page" className="font-semibold text-foreground">{crumb.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

export function PageHeader({ title, description, crumbs, actions, meta, aside, lead }: { title: ReactNode; description?: ReactNode; crumbs?: Crumb[]; actions?: ReactNode; meta?: ReactNode; aside?: ReactNode; lead?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4 pt-5 pb-2.5">
      <div className="flex min-w-0 flex-[1_1_460px] flex-col items-start gap-2">
        {crumbs && crumbs.length > 0 && <Crumbs crumbs={crumbs} />}
        {lead}
        <h1 className="text-[clamp(1.75rem,2.2vw,2.25rem)]/[1.2] font-extrabold tracking-[-0.02em]">{title}</h1>
        {description && <p className="max-w-3xl text-[15px]/normal text-muted-foreground">{description}</p>}
        {meta && <div className="flex flex-wrap items-center gap-2">{meta}</div>}
      </div>
      {actions && <div className="flex flex-none flex-wrap items-center gap-2">{actions}</div>}
      {aside && <div className="flex-[0_1_270px] self-start">{aside}</div>}
    </header>
  );
}

export function SummaryCard({ icon: Icon, label, value, children, className }: { icon?: LucideIcon; label: ReactNode; value?: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-1.5 rounded-[18px] border bg-card px-4 py-3.5 shadow-card", className)}>
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        {Icon && <Icon className="size-3.5" aria-hidden />}
        {label}
      </span>
      {value !== undefined && <strong className="tabular text-2xl/tight font-extrabold tracking-[-0.02em]">{value}</strong>}
      {children}
    </div>
  );
}

export function Section({
  title,
  icon: Icon,
  description,
  actions,
  children,
  flush = false,
  className,
}: {
  title?: ReactNode;
  icon?: LucideIcon;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  flush?: boolean;
  className?: string;
}) {
  return (
    <section className={cn("flex flex-col rounded-xl border bg-card shadow-card", flush ? "overflow-hidden" : "gap-3 p-[18px]", className)}>
      {(title || actions) && (
        <div className={cn("flex flex-wrap items-start justify-between gap-x-3 gap-y-2", flush && "px-[18px] pt-3.5 pb-1")}>
          <div className="min-w-0 space-y-0.5">
            {title && (
              <h2 className="flex items-center gap-2 text-lg font-extrabold tracking-[-0.015em]">
                {Icon && <Icon className="size-5 shrink-0" aria-hidden />}
                {title}
              </h2>
            )}
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
    <div className="flex flex-col items-center gap-2 px-[18px] py-8 text-center text-sm text-muted-foreground">
      <span className="flex size-11 items-center justify-center rounded-full bg-muted">
        <Icon className="size-[18px]" aria-hidden />
      </span>
      <p className="font-semibold text-foreground">{title}</p>
      {description && <p className="max-w-md">{description}</p>}
      {action && <div className="pt-1">{action}</div>}
    </div>
  );
}

export function StatTile({ icon: Icon, label, value, hint, progress }: { icon?: LucideIcon; label: string; value: ReactNode; hint?: ReactNode; progress?: { value: number; max: number } }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border bg-card p-[18px] shadow-card">
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        {Icon && <Icon className="size-3.5" aria-hidden />}
        {label}
      </span>
      <span className="tabular text-[28px]/tight font-extrabold tracking-[-0.02em]">{value}</span>
      {progress && <progress value={progress.value} max={Math.max(progress.max, 1)} aria-label={label} />}
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  );
}

export function Criteria({ columns = 2, children, className }: { columns?: 2 | 3 | 4; children: ReactNode; className?: string }) {
  return <ul className={cn("grid list-none grid-cols-1 gap-2", columns === 2 && "sm:grid-cols-2", columns === 3 && "sm:grid-cols-2 xl:grid-cols-3", columns === 4 && "sm:grid-cols-2 xl:grid-cols-4", className)}>{children}</ul>;
}

export function Criterion({ icon: Icon, label, children, wide = false }: { icon?: LucideIcon; label: ReactNode; children: ReactNode; wide?: boolean }) {
  return (
    <li className={cn("flex flex-col gap-1 rounded-[14px] bg-muted px-3 py-2.5", wide && "col-span-full")}>
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {Icon && <Icon className="size-3.5" aria-hidden />}
        {label}
      </span>
      <strong className="text-[15px] font-bold">{children}</strong>
    </li>
  );
}

export function Checks({ single = false, children, className }: { single?: boolean; children: ReactNode; className?: string }) {
  return <ul className={cn("grid list-none grid-cols-1 gap-1.5", !single && "sm:grid-cols-2", className)}>{children}</ul>;
}

export function CheckItem({ ok, label, value }: { ok: boolean; label: ReactNode; value: ReactNode }) {
  const Icon = ok ? Check : X;
  return (
    <li className="flex items-center justify-between gap-1.5 rounded-full bg-hairline px-3 py-[5px] text-[13px]">
      <span>{label}</span>
      <strong className={cn("inline-flex items-center gap-1 whitespace-nowrap", ok ? "text-success-ink" : "text-ink")}>
        <Icon className="size-3.5" aria-hidden />
        {value}
      </strong>
    </li>
  );
}

export function Field({ label, hint, error, counter, children, className }: { label: string; hint?: ReactNode; error?: ReactNode; counter?: { value: number; max: number }; children: ReactNode; className?: string }) {
  return (
    <label className={cn("flex flex-col gap-1.5 text-[13px] font-bold", error ? "[&_[data-slot=input]]:border-destructive [&_[data-slot=textarea]]:border-destructive [&_[data-slot=select-trigger]]:border-destructive" : undefined, className)}>
      <span>{label}</span>
      {children}
      {counter && <span className={cn("tabular self-end text-xs font-normal", counter.value > counter.max ? "text-danger-ink" : "text-muted-foreground")}>{counter.value}/{counter.max}</span>}
      {error && (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-danger-ink">
          <CircleAlert className="size-3.5 shrink-0" aria-hidden />
          {error}
        </span>
      )}
      {hint && <span className="text-xs font-normal text-muted-foreground">{hint}</span>}
    </label>
  );
}

export function SearchField({ value, onChange, placeholder, className }: { value: string; onChange: (value: string) => void; placeholder: string; className?: string }) {
  return (
    <div className={cn("relative min-w-48 flex-[1_1_200px] sm:max-w-80", className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <Input type="search" value={value} placeholder={placeholder} aria-label={placeholder} className="pl-[38px]" onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

export interface ChoiceOption<T extends string> {
  value: T;
  label: string;
}

export function Choice<T extends string>({ value, onChange, options, label, icon: Icon, disabled, className }: { value: T; onChange: (value: T) => void; options: readonly ChoiceOption<T>[]; label: string; icon?: LucideIcon; disabled?: boolean; className?: string }) {
  return (
    <Select items={options} value={value} disabled={disabled} onValueChange={(next) => next !== null && onChange(next as T)}>
      <SelectTrigger aria-label={label} className={cn("data-[size=default]:h-10 min-w-36", className)}>
        {Icon && <Icon className="size-4 shrink-0" aria-hidden />}
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

export function Toggle({ checked, onChange, label, icon: Icon, count }: { checked: boolean; onChange: (checked: boolean) => void; label: string; icon?: LucideIcon; count?: number }) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "inline-flex h-10 flex-none items-center gap-[7px] rounded-full border border-input bg-card px-3.5 text-[13px] font-medium transition-colors outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
        checked && "border-primary bg-primary/15 font-semibold hover:bg-primary/15",
      )}
    >
      {Icon && <Icon className="size-4 shrink-0" aria-hidden />}
      {label}
      {count !== undefined && <Count>{count}</Count>}
    </button>
  );
}

export function Toolbar({ children, actions, className }: { children: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2 px-[18px] py-3.5", className)}>
      {children}
      {actions && <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function NativeSelect({ className, ...props }: ComponentProps<"select">) {
  return (
    <div className={cn("relative", className)}>
      <select
        className="h-10 w-full appearance-none rounded-full border border-input bg-card pr-9 pl-3.5 text-[13px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
        {...props}
      />
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
    </div>
  );
}

const noticeStyles: Record<"neutral" | Exclude<Tone, "neutral">, { box: string; icon: LucideIcon }> = {
  neutral: { box: "bg-muted text-foreground", icon: Info },
  good: { box: "bg-success-soft text-success-ink", icon: CircleCheck },
  warn: { box: "bg-deadline-soft text-ink", icon: TriangleAlert },
  bad: { box: "bg-danger-soft text-danger-ink", icon: CircleAlert },
  info: { box: "bg-info-soft text-info-ink", icon: Info },
};

export function Notice({ tone = "info", icon, title, children, className }: { tone?: Tone; icon?: LucideIcon; title?: ReactNode; children?: ReactNode; className?: string }) {
  const style = noticeStyles[tone];
  const Icon = icon ?? style.icon;
  return (
    <div role={tone === "bad" ? "alert" : "status"} className={cn("flex items-start gap-2 rounded-xl px-3 py-2.5 text-[13px]/normal", style.box, className)}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0 space-y-0.5">
        {title && <p className="font-bold">{title}</p>}
        {children}
      </div>
    </div>
  );
}

export function Steps({ steps, current, allDone = false, className }: { steps: { label: string; hint?: ReactNode }[]; current: number; allDone?: boolean; className?: string }) {
  return (
    <ol className={cn("flex list-none flex-wrap items-center gap-y-1", className)}>
      {steps.map((step, index) => {
        const done = allDone || index < current;
        const active = !allDone && index === current;
        return (
          <li key={step.label} className="flex items-center">
            {index > 0 && <span className="mx-2 h-px w-5 bg-input" aria-hidden />}
            <span className={cn("flex min-h-7 items-center gap-2 text-[13px] font-medium text-muted-foreground", (active || (allDone && index === steps.length - 1)) && "font-bold text-foreground")} aria-current={active ? "step" : undefined}>
              <span className={cn("grid size-[22px] shrink-0 place-items-center rounded-full border border-input text-[11px] font-extrabold", done && "border-success-ink text-success-ink", active && "border-primary bg-primary text-primary-foreground")}>
                {done ? <Check className="size-3" aria-hidden /> : index + 1}
              </span>
              <span className="flex flex-col leading-tight">
                {step.label}
                {step.hint && <span className="text-xs font-normal text-muted-foreground">{step.hint}</span>}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function LinkButton({
  to,
  variant = "default",
  size = "default",
  className,
  children,
}: {
  to: string;
  variant?: "default" | "secondary" | "outline" | "ghost" | "destructive" | "link";
  size?: "default" | "xs" | "sm" | "lg" | "icon" | "icon-sm";
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link to={to} className={cn(buttonVariants({ variant, size }), className)}>
      {children}
    </Link>
  );
}
