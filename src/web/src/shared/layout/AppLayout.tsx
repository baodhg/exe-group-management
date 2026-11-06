import { ChevronDown, LogOut, Menu } from "lucide-react";
import { Suspense, useState, type ReactNode } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { homeFor } from "../auth/homeFor";
import type { Role } from "../auth/sessionStore";
import { useAuth } from "../auth/useAuth";
import { Brand } from "./Brand";
import { initialsOf, navSections, roleLabels } from "./navigation";

function SideNav({ roles, onNavigate }: { roles: Role[]; onNavigate?: () => void }) {
  return (
    <nav aria-label="Điều hướng chính" className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 py-4">
      {navSections
        .filter((section) => section.roles.some((role) => roles.includes(role)))
        .map((section) => (
          <div key={section.title} className="space-y-0.5">
            <p className="px-3 pb-1.5 text-xs font-medium text-sidebar-muted">{section.title}</p>
            {section.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={onNavigate}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/80 transition-colors outline-none hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                    isActive && "bg-sidebar-accent text-sidebar-accent-foreground shadow-[inset_3px_0_0_var(--sidebar-ring)]",
                  )
                }
              >
                <item.icon className="size-4 shrink-0" aria-hidden />
                {item.label}
              </NavLink>
            ))}
          </div>
        ))}
    </nav>
  );
}

function SidebarBody({ roles, home, status, onNavigate }: { roles: Role[]; home: string; status?: ReactNode; onNavigate?: () => void }) {
  return (
    <>
      <div className="flex h-16 shrink-0 items-center border-b border-sidebar-border px-5">
        <Link to={home} onClick={onNavigate} className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring">
          <Brand />
        </Link>
      </div>
      <SideNav roles={roles} onNavigate={onNavigate} />
      {status && <div className="border-t border-sidebar-border px-5 py-3 text-xs text-sidebar-muted">{status}</div>}
    </>
  );
}

function UserMenu() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const name = user?.name ?? user?.email ?? "Tài khoản";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" className="h-10 gap-2 px-1.5" aria-label="Tài khoản" />}>
        <Avatar>
          <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">{initialsOf(user?.name ?? user?.email)}</AvatarFallback>
        </Avatar>
        <span className="hidden max-w-44 truncate text-sm font-medium md:block">{name}</span>
        <ChevronDown className="hidden size-4 text-muted-foreground md:block" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <div className="space-y-1 px-2 py-2">
          <p className="truncate text-sm font-semibold">{name}</p>
          {user?.email && <p className="truncate text-xs text-muted-foreground">{user.email}</p>}
          <p className="text-xs text-muted-foreground">{user?.roles.map((role) => roleLabels[role]).join(", ")}</p>
        </div>
        <DropdownMenuSeparator />
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

function PageSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Đang tải">
      <Skeleton className="h-10 w-72" />
      <Skeleton className="h-40 w-full rounded-xl" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}

export function AppLayout({ actions, status }: { actions?: ReactNode; status?: ReactNode }) {
  const { user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const roles = user?.roles ?? [];
  const home = homeFor(roles);

  return (
    <div className="min-h-svh bg-background">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col bg-sidebar text-sidebar-foreground lg:flex">
        <SidebarBody roles={roles} home={home} status={status} />
      </aside>
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" showCloseButton={false} className="w-72 gap-0 border-sidebar-border bg-sidebar p-0 text-sidebar-foreground">
          <SheetTitle className="sr-only">Điều hướng</SheetTitle>
          <SidebarBody roles={roles} home={home} status={status} onNavigate={() => setMenuOpen(false)} />
        </SheetContent>
      </Sheet>
      <div className="flex min-h-svh flex-col lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b bg-background/85 px-4 backdrop-blur-sm sm:px-6 lg:px-8">
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Mở menu" onClick={() => setMenuOpen(true)}>
            <Menu />
          </Button>
          <Link to={home} className="lg:hidden" aria-label="Trang chủ">
            <Brand tone="light" className="[&>span:last-child>span:last-child]:hidden sm:[&>span:last-child>span:last-child]:block" />
          </Link>
          <div className="ml-auto flex items-center gap-1">
            {actions}
            <UserMenu />
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Suspense fallback={<PageSkeleton />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
