import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { useAuth } from "../../shared/auth/useAuth";
import { unreadLabel, type Notification } from "./chat";
import { useRealtime } from "./realtimeContext";

export function NotificationBell() {
  const { api, user } = useAuth();
  const { state } = useRealtime();
  const unread = useQuery({
    queryKey: ["notifications", "unread"],
    queryFn: () => api.get<Notification[]>("/api/v1/notifications", { unread: true, pageSize: 1 }),
    enabled: user !== null,
  });
  const count = unread.data?.pagination?.totalItems ?? 0;
  const latest = unread.data?.data[0];

  return (
    <Link to="/notifications" className="bell" title={latest ? `${latest.title}: ${latest.body}` : "Thông báo"}>
      <span className={`dot dot-${state}`} aria-label={state === "connected" ? "Đang kết nối trực tiếp" : "Chưa kết nối trực tiếp"} />
      Thông báo
      {count > 0 && <span className="count">{unreadLabel(count)}</span>}
    </Link>
  );
}
