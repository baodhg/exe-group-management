import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BellOff, CheckCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "../../shared/auth/useAuth";
import { errorText, formatDateTime, formatRelative } from "../common/messages";
import { EmptyState, ErrorNote, Loading, PageHeader, Pager, Section, Toggle, Toolbar } from "../common/ui";
import type { Notification } from "./chat";

export function NotificationsPage() {
  const { api } = useAuth();
  const queryClient = useQueryClient();
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [page, setPage] = useState(1);

  const notifications = useQuery({
    queryKey: ["notifications", "list", onlyUnread, page],
    queryFn: () => api.get<Notification[]>("/api/v1/notifications", { unread: onlyUnread ? true : undefined, page, pageSize: 20 }),
    placeholderData: keepPreviousData,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["notifications"] });
  const read = useMutation({ mutationFn: (id: string) => api.post(`/api/v1/notifications/${id}/read`), onSuccess: refresh, onError: (error) => toast.error(errorText(error)) });
  const readAll = useMutation({
    mutationFn: () => api.post("/api/v1/notifications/read-all"),
    onSuccess: async () => {
      toast.success("Đã đánh dấu mọi thông báo là đã đọc");
      await refresh();
    },
    onError: (error) => toast.error(errorText(error)),
  });
  const items = notifications.data?.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Thông báo"
        description="Kết quả đơn xin vào phòng, thay đổi thành viên và các mốc của course."
        actions={
          <Button variant="outline" disabled={readAll.isPending} onClick={() => readAll.mutate()}>
            <CheckCheck />
            Đánh dấu đã đọc hết
          </Button>
        }
      />
      <Section>
        <Toolbar>
          <Toggle
            checked={onlyUnread}
            label="Chỉ chưa đọc"
            onChange={(checked) => {
              setOnlyUnread(checked);
              setPage(1);
            }}
          />
        </Toolbar>
        <ErrorNote error={notifications.error} />
        <Loading when={notifications.isLoading} rows={5} />
        {notifications.isSuccess && items.length === 0 && <EmptyState icon={BellOff} title={onlyUnread ? "Không còn thông báo chưa đọc" : "Chưa có thông báo nào"} />}
        <ul className="divide-y">
          {items.map((notification) => (
            <li key={notification.id} className="flex items-start gap-3 py-3.5 first:pt-0">
              <span className={cn("mt-2 size-2 shrink-0 rounded-full", notification.readAt ? "bg-border" : "bg-primary")} aria-hidden />
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className={cn("text-sm", notification.readAt ? "font-normal" : "font-semibold")}>
                  {notification.title}
                  {!notification.readAt && <span className="sr-only">, chưa đọc</span>}
                </p>
                <p className="text-sm text-foreground/80">{notification.body}</p>
                <p className="text-xs text-muted-foreground" title={formatDateTime(notification.createdAt)}>
                  {formatRelative(notification.createdAt)}
                </p>
              </div>
              {!notification.readAt && (
                <Button variant="ghost" size="sm" disabled={read.isPending} onClick={() => read.mutate(notification.id)}>
                  Đã đọc
                </Button>
              )}
            </li>
          ))}
        </ul>
        <Pager pagination={notifications.data?.pagination} page={page} onPage={setPage} unit="thông báo" />
      </Section>
    </div>
  );
}
