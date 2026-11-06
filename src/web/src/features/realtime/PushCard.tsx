import { ArrowRight, X } from "lucide-react";
import { Link } from "react-router";
import { buttonVariants } from "@/components/ui/button-variants";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { NotificationIcon } from "./NotificationIcon";
import type { Notification } from "./chat";

export function PushCard({ notification, target, onClose }: { notification: Notification; target: string; onClose: () => void }) {
  return (
    <aside role="status" className="flex w-[360px] max-w-[calc(100vw-2rem)] items-start gap-3 rounded-[18px] border bg-card p-3.5 text-card-foreground shadow-pop">
      <NotificationIcon type={notification.type} title={notification.title} />
      <div className="min-w-0 flex-1">
        <strong className="block text-[13.5px]/snug font-bold">{notification.title}</strong>
        <p className="text-[13px]/snug text-muted-foreground">{notification.body}</p>
        <div className="mt-2 flex items-center gap-2">
          <Link to={target} onClick={onClose} className={cn(buttonVariants({ size: "sm" }))}>
            <ArrowRight aria-hidden />
            Xem
          </Link>
          <span className="text-xs text-muted-foreground">Vừa xong</span>
        </div>
      </div>
      <Button variant="ghost" size="icon-xs" onClick={onClose} aria-label="Đóng thông báo">
        <X />
      </Button>
    </aside>
  );
}
