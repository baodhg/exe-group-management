import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useAuth } from "../../shared/auth/useAuth";
import { formatRelative } from "../common/messages";
import { unreadLabel, type Notification } from "./chat";

export function NotificationBell() {
  const { api, user } = useAuth();
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
  const read = useMutation({ mutationFn: (id: string) => api.post(`/api/v1/notifications/${id}/read`), onSuccess: refresh });
  const readAll = useMutation({ mutationFn: () => api.post("/api/v1/notifications/read-all"), onSuccess: refresh });
  const count = unread.data?.pagination?.totalItems ?? 0;
  const items = latest.data?.data ?? [];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon" className="relative size-10" aria-label={count > 0 ? `Thông báo, ${count} chưa đọc` : "Thông báo"} />}
      >
        <Bell className="size-5" aria-hidden />
        {count > 0 && (
          <span className="tabular absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] leading-none font-semibold text-white">
            {unreadLabel(count)}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[22rem] max-w-[calc(100vw-2rem)] p-0">
        <div className="flex items-center justify-between gap-2 border-b px-3 py-2.5">
          <p className="text-sm font-semibold">Thông báo</p>
          {count > 0 && (
            <Button variant="link" size="sm" className="h-auto px-0" disabled={readAll.isPending} onClick={() => readAll.mutate()}>
              Đánh dấu đã đọc hết
            </Button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto p-1">
          {items.length === 0 && <p className="px-3 py-8 text-center text-sm text-muted-foreground">Chưa có thông báo nào.</p>}
          {items.map((notification) => (
            <DropdownMenuItem
              key={notification.id}
              className="items-start gap-3 px-2.5 py-2"
              onClick={() => {
                if (!notification.readAt) {
                  read.mutate(notification.id);
                }
              }}
            >
              <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", notification.readAt ? "bg-transparent" : "bg-primary")} aria-hidden />
              <span className="min-w-0 flex-1 space-y-0.5">
                <span className={cn("block text-sm", notification.readAt ? "font-normal" : "font-semibold")}>
                  {notification.title}
                  {!notification.readAt && <span className="sr-only">, chưa đọc</span>}
                </span>
                <span className="line-clamp-2 block text-xs whitespace-normal text-muted-foreground">{notification.body}</span>
                <span className="block text-xs text-muted-foreground">{formatRelative(notification.createdAt)}</span>
              </span>
            </DropdownMenuItem>
          ))}
        </div>
        <div className="border-t p-1">
          <DropdownMenuItem render={<Link to="/notifications" />} className="justify-center py-2 font-medium text-primary">
            Xem tất cả thông báo
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
