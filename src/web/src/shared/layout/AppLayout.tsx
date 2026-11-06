import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronLeft, ChevronRight, LogOut, Menu, Moon, Sun, UserRound } from "lucide-react";
import { Suspense, useState, type ReactNode } from "react";
import { Link, NavLink, Outlet, useLocation, useMatch, useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { homeFor } from "../auth/homeFor";
import type { Role } from "../auth/sessionStore";
import { useAuth } from "../auth/useAuth";
import { useTheme } from "../theme/theme";
import { Brand } from "./Brand";
import { adminCourseSection, initialsOf, navItemActive, navSections, roleLabels, type CoursePhaseName, type NavSection } from "./navigation";

const collapseKey = "exe-group.sidebar";

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(collapseKey) === "collapsed";
  } catch {
    return false;
  }
}

function useCourseSection(): NavSection | null {
  const { api, user } = useAuth();
  const match = useMatch("/admin/courses/:courseId/*");
  const courseId = match?.params.courseId;
  const course = useQuery({
    queryKey: ["course", courseId],
    queryFn: () => api.get<{ phase: CoursePhaseName; classCode: string }>(`/api/v1/courses/${courseId}`),
    enabled: Boolean(courseId) && Boolean(user?.roles.includes("Administrator")),
  });

  return courseId && course.data ? adminCourseSection(courseId, course.data.data.phase, course.data.data.classCode) : null;
}

function SideNav({ roles, collapsed, onNavigate }: { roles: Role[]; collapsed: boolean; onNavigate?: () => void }) {
  const courseSection = useCourseSection();
  const { pathname } = useLocation();
  const sections = navSections.filter((section) => section.roles.some((role) => roles.includes(role)));
  const shown = courseSection ? [...sections.slice(0, 1), courseSection, ...sections.slice(1)] : sections;

  return (
    <nav aria-label="Điều hướng chính" className="flex min-h-0 flex-1 flex-col gap-4 overflow-x-hidden overflow-y-auto [scrollbar-color:var(--input)_transparent] [scrollbar-width:thin]">
      {shown.map((section) => (
        <div key={section.title} className="flex flex-col gap-0.5">
          {!collapsed && <p className="px-2.5 pb-1 text-xs font-semibold text-sidebar-muted">{section.title}</p>}
          {section.items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              title={item.label}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  "relative flex min-h-10 items-center gap-2.5 rounded-[10px] px-2.5 text-sm font-medium whitespace-nowrap transition-colors outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                  collapsed && "justify-center px-0",
                  (isActive || navItemActive(item, pathname)) && "bg-sidebar-accent font-bold [&>svg]:text-ink",
                )
              }
            >
              <item.icon className="size-[17px] shrink-0" aria-hidden />
              {!collapsed && <span className="min-w-0 flex-1 truncate">{item.label}</span>}
              {item.count !== undefined && item.count > 0 && <span className={cn("tabular rounded-full bg-primary px-1.5 text-xs/[18px] font-bold text-primary-foreground", collapsed && "absolute top-px right-0.5")}>{item.count}</span>}
            </NavLink>
          ))}
        </div>
      ))}
    </nav>
  );
}

function ThemeSwitch({ collapsed }: { collapsed: boolean }) {
  const { theme, setTheme } = useTheme();
  const option = (value: "light" | "dark", label: string, Icon: typeof Sun) => (
    <button
      type="button"
      title={label}
      aria-pressed={theme === value}
      onClick={() => setTheme(value)}
      className={cn(
        "inline-flex min-h-8 flex-1 items-center justify-center gap-1.5 rounded-full text-[12.5px] font-semibold text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring",
        theme === value && "bg-card text-foreground shadow-card dark:bg-foreground dark:text-background",
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {!collapsed && label}
    </button>
  );

  return (
    <div role="group" aria-label="Giao diện" className={cn("flex gap-0.5 rounded-full bg-muted p-[3px]", collapsed && "flex-col")}>
      {option("light", "Sáng", Sun)}
      {option("dark", "Tối", Moon)}
    </div>
  );
}

function UserCard({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const name = user?.name ?? user?.email ?? "Tài khoản";
  const role = user?.roles.map((item) => roleLabels[item]).join(", ");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        title={name}
        aria-label={`Tài khoản của ${name}`}
        className={cn("flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-sidebar-ring", collapsed && "justify-center px-0")}
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-extrabold">{initialsOf(user?.name ?? user?.email)}</span>
        {!collapsed && (
          <>
            <span className="flex min-w-0 flex-1 flex-col leading-tight">
              <strong className="truncate text-[13.5px]">{name}</strong>
              <span className="truncate text-xs text-muted-foreground">{role}</span>
            </span>
            <ChevronDown className="size-4 shrink-0" aria-hidden />
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="end" sideOffset={10} className="w-64 rounded-[14px]">
        <div className="space-y-0.5 px-2 py-2">
          <p className="truncate text-sm font-bold">{name}</p>
          {user?.email && <p className="truncate text-xs text-muted-foreground">{user.email}</p>}
          <p className="text-xs text-muted-foreground">{role}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => { onNavigate?.(); navigate("/account"); }}>
          <UserRound aria-hidden />
          Tài khoản của tôi
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            signOut();
            navigate("/login");
          }}
        >
          <LogOut aria-hidden />
          Đăng xuất
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SidebarBody({ roles, home, bell, status, collapsed, onCollapse, onNavigate }: { roles: Role[]; home: string; bell?: ReactNode; status?: ReactNode; collapsed: boolean; onCollapse?: () => void; onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col gap-3.5 px-3 pt-3.5 pb-3">
      <div className={cn("flex min-h-10 items-center justify-between gap-1.5 pl-1.5", collapsed && "flex-col pl-0")}>
        <Link to={home} onClick={onNavigate} title="EXE Group" className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring">
          <Brand compact={collapsed} />
        </Link>
        {onCollapse && (
          <Button variant="ghost" size="icon-sm" onClick={onCollapse} aria-label={collapsed ? "Mở rộng thanh bên" : "Thu gọn thanh bên"} className="hidden lg:inline-flex">
            {collapsed ? <ChevronRight /> : <ChevronLeft />}
          </Button>
        )}
      </div>
      <SideNav roles={roles} collapsed={collapsed} onNavigate={onNavigate} />
      <div className="flex flex-col gap-2 border-t pt-2.5">
        {!collapsed && status}
        {bell}
        <ThemeSwitch collapsed={collapsed} />
        <UserCard collapsed={collapsed} onNavigate={onNavigate} />
      </div>
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="space-y-4 pt-5" aria-busy="true" aria-label="Đang tải">
      <Skeleton className="h-9 w-72 rounded-full" />
      <Skeleton className="h-3 w-96 max-w-full rounded-full" />
      <Skeleton className="h-48 w-full rounded-xl" />
      <Skeleton className="h-72 w-full rounded-xl" />
    </div>
  );
}

export function AppLayout({ bell, status }: { bell?: (collapsed: boolean) => ReactNode; status?: ReactNode }) {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [menuOpenAt, setMenuOpenAt] = useState<string | null>(null);
  if (menuOpenAt !== null && menuOpenAt !== pathname) {
    setMenuOpenAt(null);
  }

  const menuOpen = menuOpenAt === pathname;
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const roles = user?.roles ?? [];
  const home = homeFor(roles);

  function toggleCollapsed() {
    setCollapsed((current) => {
      try {
        localStorage.setItem(collapseKey, current ? "expanded" : "collapsed");
      } catch {
        return !current;
      }
      return !current;
    });
  }

  return (
    <div className="flex min-h-svh flex-col lg:flex-row">
      <aside className={cn("sticky top-0 z-30 hidden h-svh flex-none border-r bg-sidebar transition-[width] duration-200 lg:block", collapsed ? "w-[68px]" : "w-[252px]")}>
        <SidebarBody roles={roles} home={home} bell={bell?.(collapsed)} status={status} collapsed={collapsed} onCollapse={toggleCollapsed} />
      </aside>
      <header className="sticky top-0 z-30 flex min-h-14 items-center justify-between gap-2 border-b bg-card px-3 py-2 lg:hidden">
        <Button variant="ghost" size="icon-sm" aria-label="Mở menu" onClick={() => setMenuOpenAt(pathname)}>
          <Menu />
        </Button>
        <Link to={home} aria-label="Trang chủ">
          <Brand />
        </Link>
        {bell?.(true)}
      </header>
      <Sheet open={menuOpen} onOpenChange={(next) => setMenuOpenAt(next ? pathname : null)}>
        <SheetContent side="left" showCloseButton={false} className="w-[280px] max-w-[86vw] gap-0 bg-sidebar p-0">
          <SheetTitle className="sr-only">Điều hướng</SheetTitle>
          <SidebarBody roles={roles} home={home} bell={bell?.(false)} status={status} collapsed={false} onNavigate={() => setMenuOpenAt(null)} />
        </SheetContent>
      </Sheet>
      <main className="mx-auto flex w-full max-w-[1376px] min-w-0 flex-1 flex-col px-3 pb-6 lg:px-7 lg:pb-7">
        <Suspense fallback={<PageSkeleton />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}
