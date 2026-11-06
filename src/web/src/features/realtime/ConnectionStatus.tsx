import { Wifi, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRealtime, type ConnectionState } from "./realtimeContext";

const looks: Record<ConnectionState, { label: string; tone: string; offline: boolean }> = {
  connected: { label: "Đang cập nhật trực tiếp", tone: "text-success-ink", offline: false },
  connecting: { label: "Đang kết nối trực tiếp", tone: "text-ink", offline: false },
  reconnecting: { label: "Mất kết nối, đang thử lại", tone: "text-ink", offline: true },
  disconnected: { label: "Chưa kết nối trực tiếp", tone: "text-danger-ink", offline: true },
};

export function ConnectionStatus() {
  const { state } = useRealtime();
  const look = looks[state];
  const Icon = look.offline ? WifiOff : Wifi;

  return (
    <span className="flex items-center gap-[7px] px-2.5 text-xs text-muted-foreground" role="status">
      <Icon className={cn("size-3.5 shrink-0", look.tone)} aria-hidden />
      {look.label}
    </span>
  );
}
