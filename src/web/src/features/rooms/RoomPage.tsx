import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Clock, Crown, DoorOpen, Eye, Inbox, LayoutGrid, LogOut, MessagesSquare, Send, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { useParams } from "react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "../../shared/api/apiClient";
import { useAuth } from "../../shared/auth/useAuth";
import { errorText } from "../common/messages";
import type { Course, JoinRequest, RoomDetail, RoomSummary, StudentProfile } from "../common/types";
import { Badge, Criteria, Criterion, EmptyState, ErrorNote, Failure, Field, LinkButton, Notice, PageHeader, Section, SummaryCard } from "../common/ui";
import type { Conversation } from "../conversations/conversations";
import { ChatPanel } from "../realtime/ChatPanel";
import { useWatchCourse } from "../realtime/realtimeContext";
import { ActionDialog } from "./ActionDialog";
import { leaderKeepsRecords, leadsRoom, seatsStillNeeded } from "./leader";
import { ApplicationHistory, LeaderAfterDeadline, LeaderPanel, MemberActions } from "./LeaderPanel";
import { AfterDeadline, Composition, CountChip, EligibleChip, ExceptionBox, MemberList, PhaseChip, StatusChip, SuggestionsBox } from "./RoomSections";
import { applicationLimit, capabilitiesOf, dayTime, deadlineCard, isBlockedRoom, leaveOutcome, leftRoomText, studentActionFor, viewerOf, visitorNote, type LeaveOutcome } from "./roomActions";
import { useRoomApplications } from "./useRoomApplications";

const mainColumn = "flex min-w-0 flex-[3_1_540px] flex-col gap-3.5";
const sideColumn = "flex min-w-0 flex-[2_1_340px] flex-col gap-3.5";
const chatPane = "self-start lg:sticky lg:top-4";

function RoomLoading() {
  return (
    <div className="space-y-4 pt-5" aria-busy="true" aria-label="Đang tải">
      <Skeleton className="h-3 w-40 rounded-full" />
      <Skeleton className="h-8 w-72 rounded-full" />
      <Skeleton className="h-3 w-96 max-w-full rounded-full" />
      <div className="flex flex-wrap gap-4 pt-2.5">
        <Skeleton className="h-96 min-w-0 flex-[3_1_540px] rounded-xl" />
        <Skeleton className="h-72 min-w-0 flex-[2_1_340px] rounded-xl" />
      </div>
    </div>
  );
}

function LeaveDialog({ name, outcome, pending, error, onConfirm, onClose }: { name: string; outcome: LeaveOutcome; pending: boolean; error: unknown; onConfirm: () => void; onClose: () => void }) {
  return (
    <ActionDialog
      title={`Rời ${name}?`}
      description={outcome.kind === "succession" ? "Bạn đang là trưởng nhóm, quyền trưởng nhóm sẽ chuyển cho thành viên khác." : "Bạn có thể vào phòng khác nếu còn chỗ."}
      icon={LogOut}
      confirmLabel="Rời phòng"
      pendingLabel="Đang rời"
      destructive
      pending={pending}
      onConfirm={onConfirm}
      onClose={onClose}
    >
      {outcome.kind === "succession" && (
        <Criteria>
          <Criterion label="Trưởng nhóm mới">{outcome.successor}</Criterion>
          <Criterion label="Cách chọn">Người vào phòng sớm nhất</Criterion>
        </Criteria>
      )}
      {outcome.kind === "reopens" && (
        <Criteria>
          <Criterion label="Phòng sau khi rời">Không còn ai, tự mở lại</Criterion>
          <Criterion label="Đơn đang chờ">{outcome.pending} đơn sẽ bị huỷ</Criterion>
        </Criteria>
      )}
      <ErrorNote error={error} />
    </ActionDialog>
  );
}

function ApplyDialog({ name, pending, onConfirm, onClose }: { name: string; pending: boolean; onConfirm: (message: string) => void; onClose: () => void }) {
  const [message, setMessage] = useState("");
  return (
    <ActionDialog
      title={`Gửi đơn vào ${name}`}
      description="Phòng đang khoá, trưởng nhóm sẽ xem đơn và quyết định."
      icon={Send}
      confirmLabel="Gửi đơn"
      pendingLabel="Đang gửi"
      pending={pending}
      onConfirm={() => onConfirm(message.trim())}
      onClose={onClose}
    >
      <Field label="Lời nhắn cho trưởng nhóm (không bắt buộc)" counter={{ value: message.length, max: applicationLimit }}>
        <Textarea autoFocus maxLength={applicationLimit} className="font-normal" placeholder="Giới thiệu ngắn về bạn và phần bạn làm được" value={message} onChange={(event) => setMessage(event.target.value)} />
      </Field>
    </ActionDialog>
  );
}

function FormerMemberBox({ room, leftAt, courseId, otherRoom }: { room: RoomDetail; leftAt: string | null; courseId: string; otherRoom: RoomSummary | null }) {
  return (
    <Section title="Việc tiếp theo" icon={DoorOpen}>
      <Criteria>
        <Criterion label="Rời phòng lúc">{dayTime(leftAt)}</Criterion>
        <Criterion label="Tin nhắn cũ">Xem tới lúc rời</Criterion>
      </Criteria>
      <div className="flex flex-wrap items-center gap-2">
        {otherRoom ? (
          <LinkButton to={`/rooms/${otherRoom.id}`}>
            <DoorOpen aria-hidden />
            Mở {otherRoom.name}
          </LinkButton>
        ) : (
          <LinkButton to={`/student/courses/${courseId}`}>
            <LayoutGrid aria-hidden />
            Về bảng phòng
          </LinkButton>
        )}
        <LinkButton to={`/conversations?id=${room.id}`} variant="outline">
          <MessagesSquare aria-hidden />
          Xem lại tin nhắn
        </LinkButton>
      </div>
    </Section>
  );
}

export function RoomPage() {
  const { roomId = "" } = useParams();
  const { api, user, hasRole } = useAuth();
  const queryClient = useQueryClient();
  const isStudent = hasRole("Student");
  const userId = user?.userId;
  const [dialog, setDialog] = useState<"leave" | "apply" | null>(null);
  const [left, setLeft] = useState<{ roomId: string; text: string } | null>(null);

  const room = useQuery({ queryKey: ["room", roomId], queryFn: () => api.get<RoomDetail>(`/api/v1/rooms/${roomId}`) });
  const detail = room.data?.data;
  const courseId = detail?.courseId;
  useWatchCourse(courseId);
  const course = useQuery({
    queryKey: ["course", courseId],
    queryFn: () => api.get<Course>(`/api/v1/courses/${courseId}`),
    enabled: courseId !== undefined,
  });
  const phase = course.data?.data.phase;
  const semesterId = course.data?.data.semesterId;
  const viewer = detail ? viewerOf(detail, userId, isStudent) : "staff";
  const profile = useQuery({
    queryKey: ["profile", semesterId],
    queryFn: () => api.get<StudentProfile>(`/api/v1/semesters/${semesterId}/students/me`),
    enabled: viewer === "visitor" && semesterId !== undefined,
  });
  const myRoom = useQuery({
    queryKey: ["rooms", courseId, "mine"],
    queryFn: () => api.get<RoomSummary[]>(`/api/v1/courses/${courseId}/rooms`, { mine: true }),
    enabled: isStudent && courseId !== undefined,
  });
  const myApplications = useQuery({
    queryKey: ["joinRequests", "mine", "room", roomId],
    queryFn: () => api.get<JoinRequest[]>("/api/v1/join-requests", { roomId, status: "Pending" }),
    enabled: isStudent,
  });
  const conversations = useQuery({
    queryKey: ["conversations"],
    queryFn: () => api.get<Conversation[]>("/api/v1/conversations"),
    enabled: viewer === "visitor",
  });
  const manages = detail ? leadsRoom(detail, userId, phase) : false;
  const applications = useRoomApplications(roomId, manages);

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["room", roomId] }),
      queryClient.invalidateQueries({ queryKey: ["rooms", courseId] }),
      queryClient.invalidateQueries({ queryKey: ["course", courseId] }),
      queryClient.invalidateQueries({ queryKey: ["joinRequests"] }),
      queryClient.invalidateQueries({ queryKey: ["suggestions", courseId] }),
      queryClient.invalidateQueries({ queryKey: ["conversations"] }),
    ]);

  const join = useMutation({
    mutationFn: () => api.post(`/api/v1/rooms/${roomId}/join`),
    onSuccess: async () => {
      toast.success("Bạn đã vào phòng");
      await refresh();
    },
    onError: async (error) => {
      toast.error(errorText(error));
      await refresh();
    },
  });
  const apply = useMutation({
    mutationFn: (message: string) => api.post("/api/v1/join-requests", { roomId, message: message || undefined }),
    onSuccess: async () => {
      setDialog(null);
      toast.success("Đã gửi đơn, chờ trưởng nhóm duyệt");
      await refresh();
    },
    onError: async (error) => {
      setDialog(null);
      toast.error(errorText(error));
      await refresh();
    },
  });
  const leave = useMutation({
    mutationFn: async (expected: LeaveOutcome) => ({ result: await api.post<RoomDetail>(`/api/v1/rooms/${roomId}/leave`), expected }),
    onSuccess: async ({ result, expected }) => {
      setDialog(null);
      setLeft({ roomId, text: leftRoomText(result.data, expected) });
      toast.success("Bạn đã rời phòng");
      await refresh();
    },
  });

  function closeLeave() {
    const failed = leave.isError;
    leave.reset();
    setDialog(null);
    if (failed) {
      void refresh();
    }
  }

  const backTo = (id: string) => (hasRole("Administrator") ? `/admin/courses/${id}` : hasRole("Lecturer") ? `/lecturer/courses/${id}` : `/student/courses/${id}`);
  const rootLink = hasRole("Administrator") ? { to: "/admin/courses", label: "Về các lớp" } : hasRole("Lecturer") ? { to: "/lecturer", label: "Về các lớp" } : { to: "/student", label: "Về lớp của tôi" };
  const loadError = room.error ?? course.error;

  if (loadError) {
    const blocked = isBlockedRoom(loadError);
    return (
      <>
        <PageHeader title="Phòng" />
        <Section className="mt-2.5">
          <Failure
            error={loadError}
            title={blocked ? "Không mở được phòng này" : "Không tải được phòng"}
            onRetry={
              blocked
                ? undefined
                : () => {
                    void room.refetch();
                    void course.refetch();
                  }
            }
            action={
              <LinkButton to={rootLink.to} variant="link">
                <ArrowLeft aria-hidden />
                {rootLink.label}
              </LinkButton>
            }
          />
        </Section>
      </>
    );
  }

  if (!detail || !phase || !course.data) {
    return <RoomLoading />;
  }

  const info = course.data.data;
  const crumbs = [{ label: `${info.subjectCode} ${info.classCode}`, to: backTo(detail.courseId) }, { label: detail.name }];

  if (left?.roomId === roomId) {
    return (
      <>
        <PageHeader crumbs={crumbs} title={detail.name} />
        <Section className="mt-2.5">
          <EmptyState
            icon={DoorOpen}
            title={`Bạn đã rời ${detail.name}`}
            description={left.text}
            action={
              <LinkButton to={`/student/courses/${detail.courseId}`} variant="outline">
                <LayoutGrid aria-hidden />
                Về bảng phòng
              </LinkButton>
            }
          />
        </Section>
      </>
    );
  }

  const can = capabilitiesOf(viewer, phase);
  const keepsRecords = leaderKeepsRecords(detail, userId, phase);
  const isException = phase === "Finalized" && !detail.eligible;
  const pendingCount = applications.data?.data.length ?? 0;
  const outcome = leaveOutcome(detail, userId, pendingCount);
  const hasPending = (myApplications.data?.data ?? []).some((request) => request.studentId === userId);
  const myRoomSummary = myRoom.data?.data[0] ?? null;
  const visitorState = { phase, room: { ...detail, missingMajorSeats: seatsStillNeeded(detail.majors, detail.minDistinctMajors) }, myRoomId: myRoomSummary?.id ?? null, myMajorId: profile.data?.data.majorId ?? null, hasPendingApplication: hasPending };
  const removed = join.error instanceof ApiError && join.error.code === "REMOVED_FROM_ROOM";
  const action = viewer === "visitor" && myRoom.isSuccess && !removed ? studentActionFor(visitorState) : "none";
  const caseNote = removed ? errorText(join.error) : viewer === "visitor" && myRoom.isSuccess ? visitorNote(visitorState) : null;
  const former = viewer === "visitor" ? (conversations.data?.data ?? []).find((conversation) => conversation.id === roomId && !conversation.canSend) : undefined;
  const otherRoom = myRoomSummary && myRoomSummary.id !== roomId ? myRoomSummary : null;
  const card = can.deadlineCard ? deadlineCard(viewer, phase, info.expireAt) : null;
  const inRoom = viewer === "leader" || viewer === "member";
  const leaderLabel = viewer === "leader" ? "Bạn là trưởng nhóm" : `Trưởng nhóm: ${detail.leaderName || "Chưa có"}`;

  const memberActions = (member: RoomDetail["members"][number]) => (manages && !member.isLeader ? <MemberActions room={detail} studentId={member.studentId} name={member.fullName} /> : null);

  return (
    <>
      <PageHeader
        crumbs={crumbs}
        title={detail.groupNo !== null ? `Nhóm ${detail.groupNo}: ${detail.name}` : detail.name}
        description={detail.topic ?? "Chưa có đề tài"}
        meta={
          <>
            <StatusChip status={detail.status} />
            <EligibleChip eligible={detail.eligible} />
            {isException && (
              <Badge tone="warn" icon={ShieldAlert}>
                Ngoại lệ
              </Badge>
            )}
            <PhaseChip phase={phase} />
            {can.readOnly && <Badge icon={Eye}>Chỉ đọc</Badge>}
            {viewer === "visitor" && phase === "Published" && hasPending && (
              <Badge tone="info" icon={Clock}>
                Đơn của bạn đang chờ duyệt
              </Badge>
            )}
            {card && <CountChip room={detail} />}
            {card && (
              <Badge tone="info" icon={Crown}>
                {leaderLabel}
              </Badge>
            )}
          </>
        }
        actions={
          action === "join" || action === "apply" ? (
            action === "join" ? (
              <Button pending={join.isPending} onClick={() => join.mutate()}>
                {!join.isPending && <DoorOpen aria-hidden />}
                {join.isPending ? "Đang vào phòng" : "Vào phòng"}
              </Button>
            ) : (
              <Button onClick={() => setDialog("apply")}>
                <Send aria-hidden />
                Gửi đơn xin vào
              </Button>
            )
          ) : undefined
        }
        aside={
          card ? (
            <SummaryCard icon={Clock} label={card.label} value={card.value}>
              <span className="text-xs font-semibold">{card.note}</span>
              {manages && (
                <span className="inline-flex items-center gap-1.5 text-xs">
                  <Inbox className="size-3.5 shrink-0" aria-hidden />
                  {pendingCount} đơn đang chờ bạn duyệt
                </span>
              )}
              {can.leave && (
                <Button variant="destructive" size="sm" className="self-start" onClick={() => setDialog("leave")}>
                  <LogOut aria-hidden />
                  Rời phòng
                </Button>
              )}
            </SummaryCard>
          ) : undefined
        }
      />

      {caseNote && <Notice className="mt-2.5">{caseNote}</Notice>}
      {former && (
        <Notice tone="warn" className="mt-2.5" title={`Bạn không còn ở ${detail.name}`}>
          Bạn đã rời phòng, được chuyển sang phòng khác hoặc bị xoá khỏi phòng.
        </Notice>
      )}

      <div className="flex flex-wrap items-start gap-4 pt-2.5">
        {keepsRecords && (
          <>
            <div className={mainColumn}>
              {manages ? <LeaderPanel key={detail.id} room={detail} /> : <LeaderAfterDeadline key={detail.id} room={detail} />}
              <Composition room={detail} single={false} />
              <MemberList room={detail} userId={userId} actionsFor={memberActions} />
              <ApplicationHistory key={detail.id} roomId={detail.id} />
            </div>
            <Section className={`min-w-0 flex-[2_1_340px] ${chatPane}`}>
              <ChatPanel key={detail.id} conversationId={detail.id} />
            </Section>
          </>
        )}

        {!keepsRecords && inRoom && (
          <>
            <Section className={`min-w-0 flex-[3_1_540px] ${chatPane}`}>
              <ChatPanel key={detail.id} conversationId={detail.id} />
            </Section>
            <div className={sideColumn}>
              {isException && <ExceptionBox room={detail} />}
              <Composition room={detail} />
              <MemberList room={detail} userId={userId} joinDetails={can.joinDetails} readOnlyChip={phase === "Finalized"} />
              {can.afterDeadline && <AfterDeadline />}
              {can.suggestions && <SuggestionsBox courseId={detail.courseId} expireAt={info.expireAt} />}
            </div>
          </>
        )}

        {!inRoom && (
          <>
            <div className={mainColumn}>
              {former && <FormerMemberBox room={detail} leftAt={former.leftAt} courseId={detail.courseId} otherRoom={otherRoom} />}
              <MemberList room={detail} userId={userId} />
            </div>
            <div className={sideColumn}>
              {isException && <ExceptionBox room={detail} />}
              <Composition room={detail} />
            </div>
          </>
        )}
      </div>

      {dialog === "apply" && action === "apply" && <ApplyDialog name={detail.name} pending={apply.isPending} onConfirm={(message) => apply.mutate(message)} onClose={() => setDialog(null)} />}
      {dialog === "leave" && can.leave && <LeaveDialog name={detail.name} outcome={outcome} pending={leave.isPending} error={leave.error} onConfirm={() => leave.mutate(outcome)} onClose={closeLeave} />}
    </>
  );
}
