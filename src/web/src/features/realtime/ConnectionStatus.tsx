import { cn } from "@/lib/utils";
import { useRealtime, type ConnectionState } from "./realtimeContext";

const labels: Record<ConnectionState, string> = {
  connected: "Đang cập nhật trực tiếp",
  connecting: "Đang kết nối trực tiếp",
  reconnecting: "Mất kết nối, đang thử lại",
  disconnected: "Chưa kết nối trực tiếp",
};

export function ConnectionStatus() {
  const { state } = useRealtime();

  return (
    <span className="flex items-center gap-2" role="status">
      <span
        className={cn(
          "size-2 rounded-full",
          state === "connected" && "bg-success ring-3 ring-success/25",
          (state === "connecting" || state === "reconnecting") && "animate-pulse bg-deadline",
          state === "disconnected" && "bg-sidebar-muted",
        )}
        aria-hidden
      />
      {labels[state]}
    </span>
  );
}
