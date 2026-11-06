import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Bell, CalendarDays, Check, Clock, Inbox } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { homeFor } from "../../shared/auth/homeFor";
import { useAuth } from "../../shared/auth/useAuth";
import { ClearFilters, PageFailure } from "../admin/CatalogFrame";
import { isAccessFailure } from "../admin/catalogRules";
import { useClampedPage } from "../admin/useClampedPage";
import { errorText, formatDateTime, formatRelative } from "../common/messages";
import { Count, EmptyState, Failure, PageHeader, Pager, Section } from "../common/ui";
import { notificationTarget, unreadLabel, type Notification } from "./chat";
import { NotificationIcon } from "./NotificationIcon";
import { groupByDay, notificationAction, notificationsIntro, onlyAdministrator } from "./notificationList";

export function NotificationsPage() {
  const { api, user } = useAuth();
  const queryClient = useQueryClient();
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [page, setPage] = useState(1);
  const roles = user?.roles ?? [];

  const notifications = useQuery({
    queryKey: ["notifications", "list", onlyUnread, page],
    queryFn: () => api.get<Notification[]>("/api/v1/notifications", { unread: onlyUnread ? true : undefined, page, pageSize: 20 }),
    placeholderData: keepPreviousData,
  });
  const unread = useQuery({ queryKey: ["notifications", "unread"], queryFn: () => api.get<Notification[]>("/api/v1/notifications", { unread: true, pageSize: 1 }) });
  const latest = useQuery({ queryKey: ["notifications", "latest"], queryFn: () => api.get<Notification[]>("/api/v1/notifications", { pageSize: 6 }) });
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
  const pagination = notifications.data?.pagination;
  const total = latest.data?.pagination?.totalItems ?? 0;
  const unreadCount = unread.data?.pagination?.totalItems ?? 0;
  const adminOnly = onlyAdministrator(roles);
  const hasInbox = !adminOnly || total > 0;
  useClampedPage(pagination, page, setPage);

  const intro = notificationsIntro(roles);

  if (isAccessFailure(notifications.error)) {
    return (
      <div className="space-y-4">
        <PageHeader title="Thông báo" description={intro} />
        <PageFailure error={notifications.error} title="Không mở được thông báo" backTo={homeFor(roles)} backLabel="Về trang chính" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Thông báo"
        description={intro}
        actions={
          hasInbox ? (
            <Button variant="outline" size="sm" pending={readAll.isPending} onClick={() => readAll.mutate()}>
              {!readAll.isPending && <Check aria-hidden />}
              {readAll.isPending ? "Đang đánh dấu" : "Đánh dấu đã đọc hết"}
            </Button>
          ) : undefined
        }
      />

      {hasInbox && (
        <Tabs
          value={onlyUnread ? "unread" : "all"}
          onValueChange={(value) => {
            setOnlyUnread(value === "unread");
            setPage(1);
          }}
        >
          <TabsList aria-label="Lọc thông báo">
            <TabsTrigger value="all">
              <Bell aria-hidden />
              Tất cả
              {latest.isSuccess && <Count className="ml-0.5 bg-muted text-foreground">{total}</Count>}
            </TabsTrigger>
            <TabsTrigger value="unread">
              <Inbox aria-hidden />
              Chưa đọc
              {unread.isSuccess && <Count className="ml-0.5 bg-muted text-foreground">{unreadLabel(unreadCount)}</Count>}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      <Section flush>
        {notifications.isLoading && (
          <div aria-busy="true" aria-label="Đang tải">
            {Array.from({ length: 5 }, (_, index) => (
              <div key={index} className="flex items-center gap-3 border-b px-[18px] py-3 last:border-b-0">
                <Skeleton className="size-9 shrink-0 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-48 max-w-full rounded-full" />
                  <Skeleton className="h-3 w-full max-w-md rounded-full" />
                </div>
              </div>
            ))}
          </div>
        )}
        {notifications.isError && <Failure error={notifications.error} title="Không tải được thông báo" onRetry={() => void notifications.refetch()} />}
        {notifications.isSuccess && items.length === 0 && (
          <EmptyState
            icon={Bell}
            title={onlyUnread ? "Không còn thông báo chưa đọc" : "Chưa có thông báo nào"}
            description={adminOnly && !onlyUnread ? "Giáo vụ không nhận thông báo nào từ hệ thống." : undefined}
            action={onlyUnread ? <ClearFilters onClear={() => { setOnlyUnread(false); setPage(1); }} /> : undefined}
          />
        )}
        {!notifications.isError &&
          groupByDay(items, notifications.dataUpdatedAt).map((group) => (
            <div key={group.label}>
              <h2 className="flex items-center gap-2 border-b px-[18px] pt-3.5 pb-2 text-[13px] font-bold text-muted-foreground">
                {group.label === "Hôm nay" ? <Clock className="size-4" aria-hidden /> : <CalendarDays className="size-4" aria-hidden />}
                {group.label}
              </h2>
              {group.items.map((notification) => {
                const isUnread = !notification.readAt;
                const action = notificationAction(notification);
                return (
                  <div key={notification.id} className={cn("relative flex flex-wrap items-center gap-3 border-b px-[18px] py-3 transition-colors last:border-b-0 hover:bg-muted sm:flex-nowrap", isUnread && "bg-primary/7")}>
                    <NotificationIcon type={notification.type} title={notification.title} />
                    <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-0.5 pr-3.5">
                      <span className="text-[13.5px]/snug font-bold">
                        {notification.title}
                        {isUnread && <span className="sr-only">, chưa đọc</span>}
                      </span>
                      <span className="text-[13px]/snug text-muted-foreground">{notification.body}</span>
                    </div>
                    <div className="flex flex-none items-center gap-1">
                      {action && (
                        <Link
                          to={notificationTarget(notification, roles)}
                          className={cn(buttonVariants({ variant: "link", size: "sm" }), "after:absolute after:inset-0")}
                          onClick={() => {
                            if (isUnread) {
                              read.mutate(notification.id);
                            }
                          }}
                        >
                          <ArrowRight aria-hidden />
                          {action}
                        </Link>
                      )}
                      {isUnread && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="relative"
                          aria-label={`Đánh dấu đã đọc: ${notification.title}`}
                          disabled={read.isPending}
                          pending={read.isPending && read.variables === notification.id}
                          onClick={() => read.mutate(notification.id)}
                        >
                          {!(read.isPending && read.variables === notification.id) && <Check aria-hidden />}
                          Đã đọc
                        </Button>
                      )}
                    </div>
                    <time className="relative flex-none text-xs whitespace-nowrap text-muted-foreground" dateTime={notification.createdAt} title={formatDateTime(notification.createdAt)}>
                      {formatRelative(notification.createdAt)}
                    </time>
                  </div>
                );
              })}
            </div>
          ))}
        {!notifications.isError && <Pager pagination={pagination} page={page} onPage={setPage} unit="thông báo" />}
      </Section>
    </div>
  );
}
