import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Crown, Lock, LockOpen, MoreHorizontal, UserMinus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useAuth } from "../../shared/auth/useAuth";
import { initialsOf } from "../../shared/layout/navigation";
import { useDialogs } from "../common/dialogsContext";
import { errorText, formatRelative } from "../common/messages";
import type { JoinRequest, RoomDetail } from "../common/types";
import { Badge, ErrorNote, Section } from "../common/ui";
import { decisionNote } from "./leader";
import { SkillTags } from "./seats";

function useRoomRefresh(room: Pick<RoomDetail, "id" | "courseId">) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["room", room.id] }),
      queryClient.invalidateQueries({ queryKey: ["rooms", room.courseId] }),
      queryClient.invalidateQueries({ queryKey: ["joinRequests"] }),
    ]);
}

export function LeaderPanel({ room }: { room: RoomDetail }) {
  const { api } = useAuth();
  const { confirm, askText } = useDialogs();
  const refresh = useRoomRefresh(room);
  const [topic, setTopic] = useState(room.topic ?? "");

  const applications = useQuery({
    queryKey: ["joinRequests", "room", room.id],
    queryFn: () => api.get<JoinRequest[]>("/api/v1/join-requests", { roomId: room.id, status: "Pending", sort: "createdAt", pageSize: 100 }),
  });
  const pending = applications.data?.data ?? [];

  const saveTopic = useMutation({
    mutationFn: () => api.put(`/api/v1/rooms/${room.id}`, { topic }),
    onSuccess: async () => {
      toast.success("Đã lưu đề tài");
      await refresh();
    },
    onError: (error) => toast.error(errorText(error)),
  });
  const toggleLock = useMutation({
    mutationFn: () => api.post(`/api/v1/rooms/${room.id}/${room.status === "Locked" ? "unlock" : "lock"}`),
    onSuccess: async () => {
      toast.success(room.status === "Locked" ? "Đã mở khóa phòng" : "Đã khóa phòng");
      await refresh();
    },
    onError: (error) => toast.error(errorText(error)),
  });
  const decide = useMutation({
    mutationFn: ({ id, approve, reasonText }: { id: string; approve: boolean; reasonText?: string }) =>
      approve ? api.post<JoinRequest>(`/api/v1/join-requests/${id}/approve`) : api.post<JoinRequest>(`/api/v1/join-requests/${id}/reject`, { reasonText }),
    onSuccess: async (result) => {
      const note = decisionNote(result.data);
      if (result.data.status === "Approved") {
        toast.success(note);
      } else {
        toast(note);
      }

      await refresh();
    },
    onError: (error) => toast.error(errorText(error)),
  });

  async function changeLock() {
    if (room.status === "Locked" && pending.length > 0) {
      const accepted = await confirm({
        title: "Mở khóa phòng?",
        description: `${pending.length} đơn đang chờ sẽ bị hủy. Sau khi mở, ai còn chỗ hợp lệ đều vào thẳng được.`,
        confirmLabel: "Mở khóa",
      });
      if (!accepted) {
        return;
      }
    }

    toggleLock.mutate();
  }

  return (
    <>
      <Section
        title={
          <span className="flex items-center gap-2">
            Đơn xin vào
            {pending.length > 0 && <Badge tone="info">{pending.length} đang chờ</Badge>}
          </span>
        }
        description={room.status === "Locked" ? "Phòng đang khóa nên người muốn vào phải gửi đơn cho bạn." : "Phòng đang mở, ai còn chỗ hợp lệ đều vào thẳng. Khóa phòng để duyệt từng người."}
      >
        <ErrorNote error={applications.error} />
        {applications.isSuccess && pending.length === 0 && <p className="text-sm text-muted-foreground">Không có đơn nào đang chờ.</p>}
        <ul className="divide-y">
          {pending.map((request) => (
            <li key={request.id} className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-start">
              <Avatar>
                <AvatarFallback className="text-xs font-medium">{initialsOf(request.studentName ?? request.studentCode)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1 space-y-1.5">
                <p className="text-sm">
                  <span className="font-medium">{request.studentName ?? "Sinh viên"}</span>
                  <span className="text-muted-foreground"> {request.studentCode}</span>
                  {request.majorCode && <Badge className="ml-2">{request.majorCode}</Badge>}
                </p>
                <SkillTags skills={request.skills} />
                {request.message && <p className="rounded-lg bg-muted px-3 py-2 text-sm">{request.message}</p>}
                <p className="text-xs text-muted-foreground">Gửi {formatRelative(request.createdAt)}</p>
              </div>
              <div className="flex gap-2 sm:flex-col">
                <Button size="sm" disabled={decide.isPending} onClick={() => decide.mutate({ id: request.id, approve: true })}>
                  Duyệt
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={decide.isPending}
                  onClick={async () => {
                    const reasonText = await askText({
                      title: `Từ chối đơn của ${request.studentName ?? "sinh viên này"}?`,
                      label: "Lý do (không bắt buộc)",
                      required: false,
                      maxLength: 300,
                      confirmLabel: "Từ chối",
                      destructive: true,
                    });
                    if (reasonText !== null) {
                      decide.mutate({ id: request.id, approve: false, reasonText: reasonText || undefined });
                    }
                  }}
                >
                  Từ chối
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Cài đặt phòng">
        <div className="space-y-5">
          <form
            className="grid gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              saveTopic.mutate();
            }}
          >
            <label htmlFor="room-topic" className="text-sm font-medium">
              Đề tài
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input id="room-topic" className="h-9" placeholder="Nhóm định làm gì?" maxLength={200} value={topic} onChange={(event) => setTopic(event.target.value)} />
              <Button type="submit" variant="outline" className="h-9" disabled={saveTopic.isPending || topic === (room.topic ?? "")}>
                Lưu đề tài
              </Button>
            </div>
          </form>
          <div className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              {room.status === "Locked" ? <Lock className="mt-0.5 size-4 text-deadline-ink" aria-hidden /> : <LockOpen className="mt-0.5 size-4 text-success-ink" aria-hidden />}
              <div>
                <p className="text-sm font-medium">{room.status === "Locked" ? "Phòng đang khóa" : "Phòng đang mở"}</p>
                <p className="text-xs text-muted-foreground">
                  {room.status === "Locked" ? "Mở khóa sẽ hủy các đơn đang chờ." : "Khóa để chỉ nhận người qua đơn xin vào."}
                </p>
              </div>
            </div>
            <Button variant="outline" className="h-9" disabled={toggleLock.isPending} onClick={changeLock}>
              {room.status === "Locked" ? "Mở khóa phòng" : "Khóa phòng"}
            </Button>
          </div>
        </div>
      </Section>
    </>
  );
}

export function MemberActions({ room, studentId, name }: { room: RoomDetail; studentId: string; name: string }) {
  const { api } = useAuth();
  const { confirm, askText } = useDialogs();
  const refresh = useRoomRefresh(room);

  const remove = useMutation({
    mutationFn: (reason: string) => api.post(`/api/v1/rooms/${room.id}/members/${studentId}/remove`, { reason }),
    onSuccess: async () => {
      toast.success(`Đã xóa ${name} khỏi phòng`);
      await refresh();
    },
    onError: (error) => toast.error(errorText(error)),
  });
  const handOver = useMutation({
    mutationFn: () => api.post(`/api/v1/rooms/${room.id}/leader`, { studentId }),
    onSuccess: async () => {
      toast.success(`${name} là trưởng phòng mới`);
      await refresh();
    },
    onError: (error) => toast.error(errorText(error)),
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Thao tác với ${name}`} />}>
        <MoreHorizontal />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem
          disabled={handOver.isPending}
          onClick={async () => {
            if (await confirm({ title: `Chuyển trưởng phòng cho ${name}?`, description: "Bạn sẽ thành thành viên thường và không duyệt đơn được nữa.", confirmLabel: "Chuyển" })) {
              handOver.mutate();
            }
          }}
        >
          <Crown />
          Chuyển trưởng phòng
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          disabled={remove.isPending}
          onClick={async () => {
            const reason = await askText({
              title: `Xóa ${name} khỏi phòng?`,
              description: "Người bị xóa không vào lại phòng này được. Lý do sẽ được gửi cho họ.",
              label: "Lý do",
              maxLength: 300,
              confirmLabel: "Xóa khỏi phòng",
              destructive: true,
            });
            if (reason) {
              remove.mutate(reason);
            }
          }}
        >
          <UserMinus />
          Xóa khỏi phòng
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
