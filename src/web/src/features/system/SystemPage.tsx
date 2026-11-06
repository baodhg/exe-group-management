import { Compass, Home, ShieldAlert, type LucideIcon } from "lucide-react";
import { useAuth } from "../../shared/auth/useAuth";
import { homeFor } from "../../shared/auth/homeFor";
import { LinkButton } from "../common/ui";

function SystemBlock({ code, icon: Icon, title, description }: { code: string; icon: LucideIcon; title: string; description: string }) {
  const { user } = useAuth();

  return (
    <div className="flex min-h-[60vh] flex-1 flex-col items-center justify-center gap-2.5 text-center">
      <span className="text-[64px]/none font-extrabold tracking-[-0.03em] text-ink">{code}</span>
      <span className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-[18px]" aria-hidden />
      </span>
      <h1 className="text-lg font-extrabold">{title}</h1>
      <p className="max-w-md text-sm text-muted-foreground">{description}</p>
      <LinkButton to={user ? homeFor(user.roles) : "/login"} variant="outline" size="sm" className="mt-1">
        <Home aria-hidden />
        Về trang chính
      </LinkButton>
    </div>
  );
}

export function ForbiddenPage() {
  return <SystemBlock code="403" icon={ShieldAlert} title="Bạn không có quyền xem trang này" description="Trang này dành cho vai trò khác. Hãy quay về trang chính của bạn." />;
}

export function NotFoundPage() {
  return <SystemBlock code="404" icon={Compass} title="Không tìm thấy trang" description="Đường dẫn không đúng hoặc nội dung đã bị xoá." />;
}
