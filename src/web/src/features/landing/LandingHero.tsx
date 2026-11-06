import { ArrowRight, Check, ChevronDown, Clock, Code2, LayoutGrid, LogIn, Megaphone, Sparkles, UsersRound } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { Brand } from "../../shared/layout/Brand";
import { Badge, LinkButton } from "../common/ui";
import type { MajorCount } from "../common/types";
import { SeatStrip } from "../rooms/seats";
import { pageSections, sampleMajor } from "./landingContent";
import { Glow, HeroTitle, riseClass, Wrap } from "./parts";
import { ThemeToggle } from "./ThemeToggle";

function TopBar() {
  return (
    <header className="flex min-h-[60px] flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-3xl border bg-card/80 py-2 pr-2.5 pl-4 shadow-card backdrop-blur-lg min-[900px]:rounded-full">
      <Link to="/" className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <Brand />
      </Link>
      <nav aria-label="Mục trên trang" className="order-last flex w-full flex-wrap items-center gap-2 min-[900px]:order-none min-[900px]:w-auto">
        {pageSections.map((section) => (
          <a key={section.href} href={section.href} className={buttonVariants({ variant: "ghost", size: "sm" })}>
            {section.label}
          </a>
        ))}
      </nav>
      <div className="flex flex-wrap items-center gap-2">
        <ThemeToggle />
        <LinkButton to="/login" variant="secondary" size="sm">
          <LogIn aria-hidden />
          Đăng nhập
        </LinkButton>
      </div>
    </header>
  );
}

function RoomPreview() {
  return (
    <div className="relative min-w-0 flex-[2_1_400px]">
      <span className="absolute -top-4 -left-[26px] z-[3] hidden min-h-9 items-center gap-[7px] rounded-xl border border-input bg-card px-3 text-[13px] font-bold text-ink shadow-card min-[900px]:inline-flex">
        <Sparkles className="size-4" aria-hidden />
        Hợp với bạn
      </span>
      <span className="absolute -right-[18px] -bottom-[18px] z-[3] hidden min-h-9 items-center gap-[7px] rounded-xl border border-input bg-card px-3 text-[13px] font-bold shadow-card min-[900px]:inline-flex">
        <UsersRound className="size-4" aria-hidden />
        20/30 đã có phòng
      </span>
      <div role="group" aria-label="Xem trước bảng phòng" className="relative z-[1] flex flex-col gap-2.5 rounded-[22px] border border-input bg-card p-4 shadow-pop">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <strong className="inline-flex items-center gap-2 text-[13px]/[1.45]">
            <LayoutGrid className="size-4" aria-hidden />
            Bảng phòng lớp SE1919
          </strong>
          <Badge tone="warn" icon={Clock}>Còn 2 ngày</Badge>
        </div>
        <div className="flex flex-col gap-2 rounded-[14px] border bg-primary/8 p-3">
          <PreviewRoom name="Phòng 03" badge={<Badge tone="warn" icon={Megaphone}>Thiếu MKT</Badge>} memberCount={3} majors={[sampleMajor("SE", 2), sampleMajor("GD", 1), sampleMajor("MKT", 0, 1)]} missingMajorSeats={1} />
          <PreviewRoom name="Phòng 05" badge={<Badge tone="good" icon={Check}>Đủ điều kiện</Badge>} memberCount={4} majors={[sampleMajor("SE", 1), sampleMajor("MKT", 1), sampleMajor("IB", 1), sampleMajor("GD", 1)]} />
          <PreviewRoom name="Phòng 04" badge={<Badge tone="warn" icon={Code2}>Thiếu SE</Badge>} memberCount={2} majors={[sampleMajor("MKT", 1), sampleMajor("IB", 1), sampleMajor("SE", 0, 1)]} missingMajorSeats={1} />
        </div>
      </div>
    </div>
  );
}

function PreviewRoom({ name, badge, memberCount, majors, missingMajorSeats = 0 }: { name: string; badge: ReactNode; memberCount: number; majors: MajorCount[]; missingMajorSeats?: number }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-[14px] border bg-card px-3 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <strong className="text-[15px]/[1.35] font-bold">{name}</strong>
        {badge}
      </div>
      <SeatStrip capacity={6} memberCount={memberCount} majors={majors} missingMajorSeats={missingMajorSeats} />
    </div>
  );
}

export function LandingHero() {
  return (
    <section className="relative overflow-hidden pb-14">
      <Glow className="top-10 right-[2%] size-[640px]" />
      <Wrap className="relative z-[1] flex flex-col gap-14 pt-3.5">
        <TopBar />
        <div className="flex flex-wrap items-center gap-12">
          <div className={cn("flex min-w-0 flex-[3_1_620px] flex-col items-start gap-5", riseClass)}>
            <span className="inline-flex min-h-[30px] items-center gap-2 rounded-full border border-input bg-card px-3 text-[12.5px] font-bold">
              <span className="size-2 rounded-full bg-primary" aria-hidden />
              Dành cho các lớp môn EXE
            </span>
            <HeroTitle>
              Ghép đội đúng người,
              <br />
              đúng ngành,{" "}
              <span className="relative whitespace-nowrap after:absolute after:-inset-x-[2%] after:-bottom-[.04em] after:-z-10 after:h-[.14em] after:-rotate-[.6deg] after:rounded-[999px_60%_999px_40%] after:bg-primary after:content-['']">đúng hạn.</span>
            </HeroTitle>
            <p className="max-w-[34rem] text-base/[1.55] text-muted-foreground">Giáo vụ mở phòng, sinh viên chọn đội theo ngành và thế mạnh. Hệ thống giữ đúng luật tới khi cả lớp có danh sách nhóm chính thức.</p>
            <div className="flex flex-wrap items-center gap-2">
              <LinkButton to="/login" size="lg">
                <ArrowRight aria-hidden />
                Vào hệ thống
              </LinkButton>
              <a href="#how" className={buttonVariants({ variant: "outline", size: "lg" })}>
                <ChevronDown aria-hidden />
                Xem cách hoạt động
              </a>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px]/[1.45] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Check className="size-4" aria-hidden />
                Tự giữ chỗ cho ngành bắt buộc
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check className="size-4" aria-hidden />
                Gợi ý theo kỹ năng
              </span>
            </div>
          </div>
          <RoomPreview />
        </div>
      </Wrap>
    </section>
  );
}
