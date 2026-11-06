import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Bell, Check } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useAuth } from "../../shared/auth/useAuth";
import { EmptyState } from "../common/ui";
import { errorText, formatRelative } from "../common/messages";
import { notificationTarget, unreadLabel, type Notification } from "./chat";
import { NotificationIcon } from "./NotificationIcon";

export function NotificationBell({ compact = false }: { compact?: boolean }) {
  const { api, user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const unread = useQuery({
    queryKey: ["notifications", "unread"],
    queryFn: () => api.get<Notification[]>("/api/v1/notifications", { unread: true, pageSize: 1 }),
    enabled: user !== null,
  });
  const latest = useQuery({
    queryKey: ["notifications", "latest"],
    queryFn: () => api.get<Notification[]>("/api/v1/notifications", { pageSize: 6 }),
    enabled: user !== null,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["notifications"] });
  const failed = (error: unknown) => toast.error(errorText(error));
  const read = useMutation({ mutationFn: (id: string) => api.post(`/api/v1/notifications/${id}/read`), onSuccess: refresh, onError: failed });
  const readAll = useMutation({ mutationFn: () => api.post("/api/v1/notifications/read-all"), onSuccess: refresh, onError: failed });
  const count = unread.data?.pagination?.totalItems ?? 0;
  const items = latest.data?.data ?? [];
  const roles = user?.roles ?? [];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        title="Thông báo"
        aria-label={count > 0 ? `Thông báo, ${count} chưa đọc` : "Thông báo"}
        className={cn("relative flex min-h-10 items-center gap-2.5 rounded-[10px] px-2.5 text-sm font-medium outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-sidebar-ring aria-expanded:bg-sidebar-accent", compact && "justify-center px-2")}
      >
        <Bell className="size-[17px] shrink-0" aria-hidden />
        {!compact && <span className="flex-1 text-left">Thông báo</span>}
        {count > 0 && <span className={cn("tabular rounded-full bg-primary px-1.5 text-xs/[18px] font-bold text-primary-foreground", compact && "absolute -top-0.5 -right-0.5")}>{unreadLabel(count)}</span>}
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="end" sideOffset={10} className="w-[400px] max-w-[calc(100vw-2rem)] rounded-[20px] p-0 shadow-pop">
        <div className="flex items-center justify-between gap-2 border-b px-4 py-3.5">
          <strong className="inline-flex items-center gap-2 text-[15px]">
            <Bell className="size-4" aria-hidden />
            Thông báo
          </strong>
          {count > 0 && (
            <Button variant="link" disabled={readAll.isPending} onClick={() => readAll.mutate()}>
              <Check aria-hidden />
              Đánh dấu đã đọc
            </Button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 && <EmptyState icon={Bell} title="Chưa có thông báo nào" />}
          {items.map((notification) => (
            <button
              key={notification.id}
              type="button"
              className={cn("relative flex w-full items-start gap-[11px] border-b px-3.5 py-3 text-left transition-colors outline-none last:border-b-0 hover:bg-muted focus-visible:bg-muted", !notification.readAt && "bg-primary/7")}
              onClick={() => {
                if (!notification.readAt) {
                  read.mutate(notification.id);
                }
                navigate(notificationTarget(notification, roles));
              }}
            >
              <NotificationIcon type={notification.type} title={notification.title} />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5 pr-3.5">
                <span className="text-[13.5px]/snug font-bold">
                  {notification.title}
                  {!notification.readAt && <span className="sr-only">, chưa đọc</span>}
                </span>
                <span className="line-clamp-2 text-[13px]/snug text-muted-foreground">{notification.body}</span>
                <span className="mt-0.5 text-xs text-muted-foreground">{formatRelative(notification.createdAt)}</span>
              </span>
              {!notification.readAt && <span className="absolute top-[18px] right-3.5 size-2 rounded-full bg-primary" aria-hidden />}
            </button>
          ))}
        </div>
        <div className="flex justify-center border-t p-2">
          <Link to="/notifications" className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink hover:underline">
            <ArrowRight className="size-3.5" aria-hidden />
            Xem tất cả thông báo
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
