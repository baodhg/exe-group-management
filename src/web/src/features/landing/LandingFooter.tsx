import { BookOpen, CalendarDays, Code2, Globe, LogIn } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { Brand } from "../../shared/layout/Brand";
import { Badge } from "../common/ui";
import { pageSections, roles } from "./landingContent";
import { paragraphClass, Wrap } from "./parts";
import { ThemeToggle } from "./ThemeToggle";

const linkClass = "inline-flex min-h-8 items-center gap-2 rounded-md text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring";

function FooterColumn({ title, children }: { title: string; children: ReactNode }) {
  return (
    <nav aria-label={title}>
      <p className="mb-3 text-sm font-bold">{title}</p>
      <ul className="flex flex-col gap-0.5">{children}</ul>
    </nav>
  );
}

export function LandingFooter() {
  return (
    <footer className="dark bg-background pt-12 pb-6 text-foreground">
      <Wrap>
        <div className="grid grid-cols-2 gap-8 min-[800px]:grid-cols-[2fr_1fr_1fr_1fr]">
          <div className="flex min-w-0 flex-col gap-2">
            <Brand />
            <p className={paragraphClass}>Hệ thống ghép nhóm cho các môn EXE: từ mở phòng, chọn đội, xếp người tới danh sách nhóm chính thức.</p>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="info" icon={BookOpen}>PRN232</Badge>
              <Badge tone="info" icon={CalendarDays}>FA26</Badge>
            </div>
          </div>
          <FooterColumn title="Sản phẩm">
            {pageSections.map((link) => (
              <li key={link.href}>
                <a className={linkClass} href={link.href}>{link.label}</a>
              </li>
            ))}
          </FooterColumn>
          <FooterColumn title="Theo vai trò">
            {roles.map(({ name, icon: Icon }) => (
              <li key={name}>
                <Link className={linkClass} to="/login">
                  <Icon className="size-4" aria-hidden />
                  {name}
                </Link>
              </li>
            ))}
          </FooterColumn>
          <FooterColumn title="Dự án">
            <li>
              <a className={linkClass} href="https://github.com/baodhg/exe-group-management">
                <Code2 className="size-4" aria-hidden />
                Mã nguồn
              </a>
            </li>
            <li>
              <a className={linkClass} href="https://exe.qizhub.com">
                <Globe className="size-4" aria-hidden />
                Bản demo
              </a>
            </li>
            <li>
              <Link className={linkClass} to="/login">
                <LogIn className="size-4" aria-hidden />
                Đăng nhập
              </Link>
            </li>
          </FooterColumn>
        </div>
        <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t pt-5 text-[13px] text-muted-foreground">
          <span>© 2026 Nhóm EXE Group. Đồ án môn học, không phải sản phẩm chính thức của trường.</span>
          <ThemeToggle />
        </div>
      </Wrap>
    </footer>
  );
}
