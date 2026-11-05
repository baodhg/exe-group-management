import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAuth } from "../../shared/auth/useAuth";
import { formatDateTime } from "../common/messages";
import { ErrorNote, Pager } from "../common/ui";
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
  const read = useMutation({ mutationFn: (id: string) => api.post(`/api/v1/notifications/${id}/read`), onSuccess: refresh });
  const readAll = useMutation({ mutationFn: () => api.post("/api/v1/notifications/read-all"), onSuccess: refresh });

  return (
    <section className="card">
      <h1>Thông báo</h1>
      <div className="toolbar">
        <label className="inline">
          <input
            type="checkbox"
            checked={onlyUnread}
            onChange={(event) => {
              setOnlyUnread(event.target.checked);
              setPage(1);
            }}
          />
          Chỉ chưa đọc
        </label>
        <button type="button" disabled={readAll.isPending} onClick={() => readAll.mutate()}>
          Đánh dấu tất cả đã đọc
        </button>
      </div>
      <ErrorNote error={notifications.error ?? read.error ?? readAll.error} />
      <ul className="notifications">
        {notifications.data?.data.map((notification) => (
          <li key={notification.id} className={notification.readAt ? undefined : "unread"}>
            <strong>{notification.title}</strong> <span className="muted">· {formatDateTime(notification.createdAt)}</span>
            <p>{notification.body}</p>
            {!notification.readAt && (
              <button type="button" className="link" disabled={read.isPending} onClick={() => read.mutate(notification.id)}>
                Đánh dấu đã đọc
              </button>
            )}
          </li>
        ))}
      </ul>
      {notifications.data?.data.length === 0 && <p className="muted">Không có thông báo nào.</p>}
      <Pager pagination={notifications.data?.pagination} page={page} onPage={setPage} unit="thông báo" />
    </section>
  );
}
