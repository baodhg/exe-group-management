import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { LinkButton } from "../common/ui";
import { DisplayHeading, revealClass, Wrap } from "./parts";

export function CallToAction() {
  return (
    <section className="pb-18">
      <Wrap className={cn("flex flex-wrap items-center justify-between gap-x-3 gap-y-4", revealClass)}>
        <div className="flex min-w-0 flex-auto flex-col gap-2">
          <DisplayHeading>Sẵn sàng lập nhóm cho lớp?</DisplayHeading>
          <p className="max-w-[48rem] text-[15px]/normal text-muted-foreground">Đăng nhập bằng tài khoản giáo vụ đã cấp để bắt đầu.</p>
        </div>
        <LinkButton to="/login" size="lg">
          <ArrowRight aria-hidden />
          Vào hệ thống
        </LinkButton>
      </Wrap>
    </section>
  );
}
