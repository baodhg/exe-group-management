import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Clock, Crown, Filter, History, Inbox, Lock, LockOpen, MoreHorizontal, Save, Sliders, Sparkles, Trash2, TriangleAlert, Undo2, X, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useAuth } from "../../shared/auth/useAuth";
import { initialsOf } from "../../shared/layout/navigation";
import { errorText, formatRelative, requestStatusLabels, roomRequestReasonText } from "../common/messages";
import type { JoinRequest, RoomDetail } from "../common/types";
import { Badge, Choice, Criteria, Criterion, EmptyState, ErrorNote, Failure, Field, Loading, Notice, Pager, Section, Toolbar, type Tone } from "../common/ui";
import { ActionDialog } from "./ActionDialog";
import { applicationHint, approvalFillsRoom, decisionNote, rejectionLimit, removalLimit, topicLimit } from "./leader";
import { dayTime } from "./roomActions";
import { MajorTag, SkillTags } from "./seats";
import { useRoomApplications } from "./useRoomApplications";

const historyPageSize = 10;

const requestLooks: Record<JoinRequest["status"], { tone: Tone; icon: LucideIcon }> = {
  Pending: { tone: "warn", icon: Clock },
  Approved: { tone: "good", icon: Check },
  Rejected: { tone: "bad", icon: X },
  Cancelled: { tone: "neutral", icon: Undo2 },
};

type HistoryFilter = "all" | JoinRequest["status"];

const historyFilters: readonly { value: HistoryFilter; label: string }[] = [
  { value: "all", label: "Mọi trạng thái" },
  { value: "Pending", label: requestStatusLabels.Pending },
  { value: "Approved", label: requestStatusLabels.Approved },
  { value: "Rejected", label: requestStatusLabels.Rejected },
  { value: "Cancelled", label: requestStatusLabels.Cancelled },
];

function useRoomRefresh(room: Pick<RoomDetail, "id" | "courseId">) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["room", room.id] }),
      queryClient.invalidateQueries({ queryKey: ["rooms", room.courseId] }),
      queryClient.invalidateQueries({ queryKey: ["course", room.courseId] }),
      queryClient.invalidateQueries({ queryKey: ["joinRequests"] }),
    ]);
}

function TopicForm({ room }: { room: RoomDetail }) {
  const { api } = useAuth();
  const refresh = useRoomRefresh(room);
  const [topic, setTopic] = useState(room.topic ?? "");
  const save = useMutation({
    mutationFn: () => api.put(`/api/v1/rooms/${room.id}`, { topic }),
    onSuccess: async () => {
      toast.success("Đã lưu đề tài");
      await refresh();
    },
    onError: async (error) => {
      toast.error(errorText(error));
      await refresh();
    },
  });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      <Field label="Đề tài" counter={{ value: topic.length, max: topicLimit }}>
        <span className="flex flex-col gap-2 font-normal sm:flex-row">
          <Input className="flex-1" placeholder="Nhóm định làm gì?" maxLength={topicLimit} value={topic} onChange={(event) => setTopic(event.target.value)} />
          <Button type="submit" variant="outline" pending={save.isPending} disabled={topic === (room.topic ?? "")}>
            {!save.isPending && <Save aria-hidden />}
            Lưu đề tài
          </Button>
        </span>
      </Field>
    </form>
  );
}

export function LeaderAfterDeadline({ room }: { room: RoomDetail }) {
  return (
    <Section title="Sau hạn chọn phòng" icon={Clock}>
      <Criteria>
        <Criterion label="Duyệt đơn">Đã đóng</Criterion>
        <Criterion label="Khoá phòng">Đã đóng</Criterion>
        <Criterion label="Xoá, chuyển trưởng nhóm">Đã đóng</Criterion>
        <Criterion label="Đề tài">Vẫn sửa được tới khi chốt</Criterion>
      </Criteria>
      <TopicForm room={room} />
    </Section>
  );
}

function RejectDialog({ request, pending, onConfirm, onClose }: { request: JoinRequest; pending: boolean; onConfirm: (reasonText: string | undefined) => void; onClose: () => void }) {
  const [reason, setReason] = useState("");
  return (
    <ActionDialog title={`Từ chối đơn của ${request.studentName ?? "sinh viên này"}?`} icon={X} confirmLabel="Từ chối" pendingLabel="Đang từ chối" destructive pending={pending} onConfirm={() => onConfirm(reason.trim() || undefined)} onClose={onClose}>
      <Field label="Lý do (không bắt buộc)" counter={{ value: reason.length, max: rejectionLimit }}>
        <Textarea autoFocus maxLength={rejectionLimit} className="font-normal" value={reason} onChange={(event) => setReason(event.target.value)} />
      </Field>
    </ActionDialog>
  );
}

export function LeaderPanel({ room }: { room: RoomDetail }) {
  const { api } = useAuth();
  const refresh = useRoomRefresh(room);
  const applications = useRoomApplications(room.id, true);
  const pending = applications.data?.data ?? [];
  const [rejecting, setRejecting] = useState<JoinRequest | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  const [filledNote, setFilledNote] = useState(false);
  const [cancelledNote, setCancelledNote] = useState(false);

  const toggleLock = useMutation({
    mutationFn: () => api.post(`/api/v1/rooms/${room.id}/${room.status === "Locked" ? "unlock" : "lock"}`),
    onSuccess: async () => {
      const unlocked = room.status === "Locked";
      toast.success(unlocked ? "Đã mở khoá phòng" : "Đã khoá phòng");
      setCancelledNote(unlocked && pending.length > 0);
      setFilledNote(false);
      setUnlocking(false);
      await refresh();
    },
    onError: async (error) => {
      toast.error(errorText(error));
      setUnlocking(false);
      await refresh();
    },
  });
  const decide = useMutation({
    mutationFn: ({ id, approve, reasonText }: { id: string; approve: boolean; reasonText?: string }) =>
      approve ? api.post<JoinRequest>(`/api/v1/join-requests/${id}/approve`) : api.post<JoinRequest>(`/api/v1/join-requests/${id}/reject`, { reasonText }),
    onSuccess: async (result) => {
      const note = decisionNote(result.data);
      if (result.data.status === "Approved") {
        toast.success(note);
      } else {
        toast.info(note);
      }

      setFilledNote(approvalFillsRoom(result.data, room, pending.length));
      setRejecting(null);
      await refresh();
    },
    onError: async (error) => {
      toast.error(errorText(error));
      setRejecting(null);
      await refresh();
    },
  });

  const locked = room.status === "Locked";
  const busyId = decide.isPending ? decide.variables.id : null;

  return (
    <>
      <Section
        title="Đơn xin vào"
        icon={Inbox}
        description={locked ? "Phòng đang khoá nên người muốn vào phải gửi đơn cho bạn." : "Phòng đang mở, ai còn chỗ hợp lệ đều vào thẳng. Khoá phòng để duyệt từng người."}
        actions={
          pending.length > 0 ? (
            <Badge tone="warn" icon={Clock}>
              {pending.length} đang chờ
            </Badge>
          ) : undefined
        }
      >
        {filledNote && pending.length === 0 && <Notice tone="info">Phòng đã đủ người nên các đơn còn lại bị từ chối.</Notice>}
        {cancelledNote && pending.length === 0 && (
          <Notice tone="info" icon={LockOpen}>
            Mở khoá phòng đã huỷ các đơn đang chờ. Từ giờ sinh viên vào thẳng phòng.
          </Notice>
        )}
        <Loading when={applications.isPending} className="px-0 py-0" />
        {applications.isError && <Failure error={applications.error} title="Không tải được đơn xin vào" onRetry={() => void applications.refetch()} />}
        {applications.isSuccess && pending.length === 0 && <EmptyState icon={Inbox} title="Không có đơn nào đang chờ." />}
        <ul className="flex list-none flex-col">
          {pending.map((request) => {
            const hint = applicationHint(request, room);
            const HintIcon = hint?.kind === "fills" ? Sparkles : TriangleAlert;
            return (
              <li key={request.id} className="flex flex-col gap-3 border-t py-3.5 text-[13px] first:border-t-0 sm:flex-row sm:items-start">
                <Avatar className="size-7">
                  <AvatarFallback className="text-[11px] font-extrabold">{initialsOf(request.studentName ?? request.studentCode)}</AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <strong className="text-sm">{request.studentName ?? "Sinh viên"}</strong>
                    <span className="text-muted-foreground">{request.studentCode}</span>
                    {request.majorCode && <MajorTag code={request.majorCode} />}
                    <SkillTags skills={request.skills} />
                  </div>
                  {request.message && <p className="wrap-anywhere text-muted-foreground">“{request.message}”</p>}
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="size-3.5 shrink-0" aria-hidden />
                    Gửi {formatRelative(request.createdAt)}
                  </span>
                  {hint && (
                    <span className={cn("inline-flex items-center gap-1.5 text-xs font-semibold", hint.kind === "fills" ? "text-success-ink" : "text-ink")}>
                      <HintIcon className="size-3.5 shrink-0" aria-hidden />
                      {hint.text}
                    </span>
                  )}
                </div>
                <div className="flex flex-none items-center gap-2">
                  <Button size="sm" variant="secondary" pending={busyId === request.id && !rejecting} disabled={busyId !== null || room.freeSeats === 0} onClick={() => decide.mutate({ id: request.id, approve: true })}>
                    {busyId !== request.id && <Check aria-hidden />}
                    {busyId === request.id && !rejecting ? "Đang duyệt" : "Duyệt"}
                  </Button>
                  <Button size="sm" variant="destructive" disabled={busyId !== null} onClick={() => setRejecting(request)}>
                    <X aria-hidden />
                    Từ chối
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </Section>

      <Section title="Cài đặt phòng" icon={Sliders}>
        <TopicForm room={room} />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <strong className="inline-flex items-center gap-1.5 text-[13px]">
              {locked ? <Lock className="size-4 shrink-0" aria-hidden /> : <LockOpen className="size-4 shrink-0" aria-hidden />}
              {locked ? "Phòng đang khoá" : "Phòng đang mở"}
            </strong>
            <span className="text-xs text-muted-foreground">{locked ? "Mở khoá sẽ huỷ các đơn đang chờ." : "Khoá để chỉ nhận người qua đơn xin vào."}</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            pending={toggleLock.isPending}
            onClick={() => {
              if (locked && pending.length > 0) {
                setUnlocking(true);
              } else {
                toggleLock.mutate();
              }
            }}
          >
            {!toggleLock.isPending && (locked ? <LockOpen aria-hidden /> : <Lock aria-hidden />)}
            {locked ? "Mở khoá phòng" : "Khoá phòng"}
          </Button>
        </div>
      </Section>

      {rejecting && (
        <RejectDialog
          request={rejecting}
          pending={decide.isPending}
          onConfirm={(reasonText) => decide.mutate({ id: rejecting.id, approve: false, reasonText })}
          onClose={() => setRejecting(null)}
        />
      )}

      {unlocking && (
        <ActionDialog title="Mở khoá phòng?" icon={LockOpen} confirmLabel="Mở khoá" pendingLabel="Đang mở khoá" pending={toggleLock.isPending} onConfirm={() => toggleLock.mutate()} onClose={() => setUnlocking(false)}>
          <Criteria>
            <Criterion label="Đơn đang chờ">{pending.length} đơn sẽ bị huỷ</Criterion>
            <Criterion label="Sau khi mở">Ai còn chỗ hợp lệ đều vào thẳng</Criterion>
          </Criteria>
        </ActionDialog>
      )}
    </>
  );
}

export function MemberActions({ room, studentId, name }: { room: RoomDetail; studentId: string; name: string }) {
  const { api } = useAuth();
  const refresh = useRoomRefresh(room);
  const [dialog, setDialog] = useState<"handover" | "remove" | null>(null);
  const [reason, setReason] = useState("");

  const remove = useMutation({
    mutationFn: () => api.post(`/api/v1/rooms/${room.id}/members/${studentId}/remove`, { reason: reason.trim() }),
    onSuccess: async () => {
      toast.success(`Đã xoá ${name} khỏi phòng`);
      setDialog(null);
      await refresh();
    },
  });
  const handOver = useMutation({
    mutationFn: () => api.post(`/api/v1/rooms/${room.id}/leader`, { studentId }),
    onSuccess: async () => {
      toast.success(`${name} là trưởng nhóm mới`);
      setDialog(null);
      await refresh();
    },
    onError: async (error) => {
      toast.error(errorText(error));
      setDialog(null);
      await refresh();
    },
  });

  function closeRemove() {
    const failed = remove.isError;
    remove.reset();
    setDialog(null);
    if (failed) {
      void refresh();
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Thao tác với ${name}`} />}>
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onClick={() => setDialog("handover")}>
            <Crown />
            Chuyển trưởng nhóm
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => {
              setReason("");
              setDialog("remove");
            }}
          >
            <Trash2 />
            Xoá khỏi phòng
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {dialog === "handover" && (
        <ActionDialog title={`Chuyển trưởng nhóm cho ${name}?`} icon={Crown} confirmLabel="Chuyển" pendingLabel="Đang chuyển" pending={handOver.isPending} onConfirm={() => handOver.mutate()} onClose={() => setDialog(null)}>
          <Criteria>
            <Criterion label="Vai trò của bạn">Thành viên thường</Criterion>
            <Criterion label="Duyệt đơn">Không còn quyền</Criterion>
          </Criteria>
        </ActionDialog>
      )}

      {dialog === "remove" && (
        <ActionDialog title={`Xoá ${name} khỏi phòng?`} icon={Trash2} confirmLabel="Xoá khỏi phòng" pendingLabel="Đang xoá" destructive pending={remove.isPending} disabled={reason.trim().length === 0} onConfirm={() => remove.mutate()} onClose={closeRemove}>
          <Criteria>
            <Criterion label="Vào lại phòng này">Không được</Criterion>
            <Criterion label="Lý do">Được gửi cho người bị xoá</Criterion>
          </Criteria>
          <Field label="Lý do" counter={{ value: reason.length, max: removalLimit }}>
            <Textarea autoFocus maxLength={removalLimit} className="font-normal" value={reason} onChange={(event) => setReason(event.target.value)} />
          </Field>
          <ErrorNote error={remove.error} />
        </ActionDialog>
      )}
    </>
  );
}

export function ApplicationHistory({ roomId }: { roomId: string }) {
  const { api } = useAuth();
  const [filter, setFilter] = useState<HistoryFilter>("all");
  const [page, setPage] = useState(1);

  const history = useQuery({
    queryKey: ["joinRequests", "room", roomId, "history", filter, page],
    queryFn: () => api.get<JoinRequest[]>("/api/v1/join-requests", { roomId, status: filter === "all" ? undefined : filter, sort: "-createdAt", page, pageSize: historyPageSize }),
    placeholderData: keepPreviousData,
  });
  const rows = history.data?.data ?? [];

  function changeFilter(next: HistoryFilter) {
    setFilter(next);
    setPage(1);
  }

  return (
    <Section flush title="Lịch sử đơn của phòng" icon={History}>
      <Toolbar>
        <Choice value={filter} onChange={changeFilter} options={historyFilters} label="Lọc theo trạng thái" icon={Filter} />
      </Toolbar>
      <Loading when={history.isPending} />
      {history.isError && <Failure error={history.error} title="Không tải được lịch sử đơn" onRetry={() => void history.refetch()} />}
      {history.isSuccess && rows.length === 0 && filter !== "all" && (
        <EmptyState
          icon={History}
          title="Không có đơn nào ở trạng thái này."
          action={
            <Button variant="ghost" size="sm" onClick={() => changeFilter("all")}>
              Xoá bộ lọc
            </Button>
          }
        />
      )}
      {history.isSuccess && rows.length === 0 && filter === "all" && <EmptyState icon={History} title="Phòng chưa có đơn nào." />}
      {rows.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sinh viên</TableHead>
              <TableHead>Ngành</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead>Lý do</TableHead>
              <TableHead>Thời gian</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const look = requestLooks[row.status];
              return (
                <TableRow key={row.id}>
                  <TableCell>
                    <span className="block font-semibold whitespace-nowrap">{row.studentName ?? "Sinh viên"}</span>
                    <span className="block text-xs text-muted-foreground">{row.studentCode}</span>
                  </TableCell>
                  <TableCell>{row.majorCode && <MajorTag code={row.majorCode} />}</TableCell>
                  <TableCell>
                    <Badge tone={look.tone} icon={look.icon}>
                      {requestStatusLabels[row.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-normal">
                    <span className="block font-semibold">{roomRequestReasonText(row.reasonCode)}</span>
                    <span className="block text-xs text-muted-foreground">{row.reasonText}</span>
                  </TableCell>
                  <TableCell className="tabular whitespace-nowrap">
                    <span className="block">Gửi {dayTime(row.createdAt)}</span>
                    {row.decidedAt && <span className="block text-xs text-muted-foreground">Xử lý {dayTime(row.decidedAt)}</span>}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
      <Pager pagination={history.data?.pagination} page={page} onPage={setPage} unit="đơn" />
    </Section>
  );
}
