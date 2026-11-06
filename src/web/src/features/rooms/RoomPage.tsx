import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleCheck, CircleDashed, Crown, DoorOpen, LogOut, Send } from "lucide-react";
import { useParams } from "react-router";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "../../shared/auth/useAuth";
import { initialsOf } from "../../shared/layout/navigation";
import { useDialogs } from "../common/dialogsContext";
import { errorText, phaseLabels } from "../common/messages";
import type { Course, JoinRequest, RoomDetail, RoomSummary } from "../common/types";
import { Badge, ErrorNote, Loading, PageHeader, Section } from "../common/ui";
import { ChatPanel } from "../realtime/ChatPanel";
import { useWatchCourse } from "../realtime/realtimeContext";
import { leadsRoom } from "./leader";
import { LeaderPanel, MemberActions } from "./LeaderPanel";
import { missingMajors } from "./seatLayout";
import { studentActionFor } from "./roomActions";
import { RoomStatusBadge } from "./RoomCard";
import { MajorChips, MajorTag, SeatStrip, SkillTags } from "./seats";

function Composition({ room }: { room: RoomDetail }) {
  const missing = missingMajors(room.majors);
  const distinct = room.majors.filter((major) => major.members > 0).length;
  const checks = [
    { ok: room.memberCount >= room.minGroupSize, text: `Ít nhất ${room.minGroupSize} người (đang có ${room.memberCount})` },
    { ok: distinct >= room.minDistinctMajors, text: `Ít nhất ${room.minDistinctMajors} ngành khác nhau (đang có ${distinct})` },
    ...room.majors
      .filter((major) => major.required > 0)
      .map((major) => ({ ok: major.members >= major.required, text: `Ngành ${major.majorCode}: ít nhất ${major.required} người (đang có ${major.members})` })),
  ];

  return (
    <Section title="Thành phần nhóm" description={`Loại nhóm ${room.groupTypeName} (${room.groupTypeCode})`}>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <SeatStrip capacity={room.capacity} memberCount={room.memberCount} majors={room.majors} missingMajorSeats={missing.reduce((sum, major) => sum + major.required - major.members, 0)} />
          <span className="tabular shrink-0 text-lg font-semibold">
            {room.memberCount}/{room.capacity}
          </span>
        </div>
        <MajorChips majors={room.majors} />
        <ul className="grid gap-1.5 text-sm">
          {checks.map((check) => (
            <li key={check.text} className={cn("flex items-start gap-2", check.ok ? "text-foreground" : "text-deadline-ink")}>
              {check.ok ? <CircleCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden /> : <CircleDashed className="mt-0.5 size-4 shrink-0" aria-hidden />}
              <span>
                <span className="sr-only">{check.ok ? "Đạt: " : "Chưa đạt: "}</span>
                {check.text}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}

export function RoomPage() {
  const { roomId = "" } = useParams();
  const { api, user, hasRole } = useAuth();
  const { confirm, askText } = useDialogs();
  const queryClient = useQueryClient();
  const isStudent = hasRole("Student");

  const room = useQuery({ queryKey: ["room", roomId], queryFn: () => api.get<RoomDetail>(`/api/v1/rooms/${roomId}`) });
  const courseId = room.data?.data.courseId;
  useWatchCourse(courseId);
  const course = useQuery({
    queryKey: ["course", courseId],
    queryFn: () => api.get<Course>(`/api/v1/courses/${courseId}`),
    enabled: courseId !== undefined,
  });
  const myRoom = useQuery({
    queryKey: ["rooms", courseId, "mine"],
    queryFn: () => api.get<RoomSummary[]>(`/api/v1/courses/${courseId}/rooms`, { mine: true }),
    enabled: isStudent && courseId !== undefined,
  });
  const pending = useQuery({
    queryKey: ["joinRequests", "mine", "room", roomId],
    queryFn: () => api.get<JoinRequest[]>("/api/v1/join-requests", { roomId, status: "Pending" }),
    enabled: isStudent,
  });

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["room", roomId] }),
      queryClient.invalidateQueries({ queryKey: ["rooms", courseId] }),
      queryClient.invalidateQueries({ queryKey: ["joinRequests"] }),
      queryClient.invalidateQueries({ queryKey: ["suggestions", courseId] }),
    ]);

  const act = useMutation({
    mutationFn: ({ action, message }: { action: "join" | "leave" | "apply"; message?: string }) =>
      action === "apply" ? api.post("/api/v1/join-requests", { roomId, message: message || undefined }) : api.post(`/api/v1/rooms/${roomId}/${action}`),
    onSuccess: async (_, { action }) => {
      toast.success(action === "join" ? "Bạn đã vào phòng" : action === "leave" ? "Bạn đã rời phòng" : "Đã gửi đơn, chờ trưởng phòng duyệt");
      await refresh();
    },
    onError: (error) => toast.error(errorText(error)),
  });

  if (room.isLoading) {
    return <Loading when rows={4} />;
  }

  if (!room.data) {
    return <ErrorNote error={room.error} />;
  }

  const detail = room.data.data;
  const phase = course.data?.data.phase;
  const myPending = (pending.data?.data ?? []).filter((request) => request.studentId === user?.userId);
  const action =
    isStudent && phase && myRoom.isSuccess
      ? studentActionFor({ phase, room: detail, myRoomId: myRoom.data.data[0]?.id ?? null, hasPendingApplication: myPending.length > 0 })
      : "none";
  const isLeader = leadsRoom(detail, user?.userId, phase);
  const isMember = detail.members.some((member) => member.studentId === user?.userId);
  const back = hasRole("Administrator") ? `/admin/courses/${detail.courseId}` : hasRole("Lecturer") ? `/lecturer/courses/${detail.courseId}` : `/student/courses/${detail.courseId}`;
  const courseLabel = course.data ? `${course.data.data.subjectCode} ${course.data.data.classCode}` : "Course";

  return (
    <div className="space-y-6">
      <PageHeader
        crumbs={[{ label: courseLabel, to: back }, { label: detail.name }]}
        title={detail.groupNo !== null ? `Nhóm ${detail.groupNo}: ${detail.name}` : detail.name}
        description={detail.topic ?? "Chưa có đề tài"}
        meta={
          <>
            <RoomStatusBadge status={detail.status} />
            {detail.eligible ? <Badge tone="good">Đủ điều kiện</Badge> : <Badge tone="warn">Chưa đủ điều kiện</Badge>}
            {phase && <Badge>{phaseLabels[phase]}</Badge>}
          </>
        }
        actions={
          <>
            {action === "join" && (
              <Button disabled={act.isPending} onClick={() => act.mutate({ action: "join" })}>
                <DoorOpen />
                Vào phòng
              </Button>
            )}
            {action === "apply" && (
              <Button
                disabled={act.isPending}
                onClick={async () => {
                  const message = await askText({
                    title: `Gửi đơn vào ${detail.name}`,
                    description: "Phòng đang khóa, trưởng phòng sẽ xem đơn và quyết định.",
                    label: "Lời nhắn cho trưởng phòng (không bắt buộc)",
                    placeholder: "Giới thiệu ngắn về bạn và phần bạn làm được",
                    required: false,
                    maxLength: 500,
                    confirmLabel: "Gửi đơn",
                  });
                  if (message !== null) {
                    act.mutate({ action: "apply", message });
                  }
                }}
              >
                <Send />
                Gửi đơn xin vào
              </Button>
            )}
            {action === "leave" && (
              <Button
                variant="outline"
                disabled={act.isPending}
                onClick={async () => {
                  const leader = detail.leaderId === user?.userId && detail.memberCount > 1;
                  if (
                    await confirm({
                      title: `Rời ${detail.name}?`,
                      description: leader ? "Bạn đang là trưởng phòng, quyền trưởng phòng sẽ chuyển cho thành viên khác." : "Bạn có thể vào phòng khác nếu còn chỗ.",
                      confirmLabel: "Rời phòng",
                      destructive: true,
                    })
                  ) {
                    act.mutate({ action: "leave" });
                  }
                }}
              >
                <LogOut />
                Rời phòng
              </Button>
            )}
            {myPending.length > 0 && <Badge tone="info">Đơn của bạn đang chờ duyệt</Badge>}
          </>
        }
      />

      <div className={cn("grid gap-6", isMember && "lg:grid-cols-[minmax(0,1fr)_minmax(20rem,24rem)]")}>
        <div className="min-w-0 space-y-6">
          {isLeader && <LeaderPanel key={detail.id} room={detail} />}
          <Composition room={detail} />
          <Section title="Thành viên">
            {detail.members.length === 0 && <p className="text-sm text-muted-foreground">Phòng chưa có ai.</p>}
            <ul className="divide-y">
              {detail.members.map((member) => (
                <li key={member.studentId} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                  <Avatar>
                    <AvatarFallback className={cn("text-xs font-medium", member.isLeader && "bg-accent text-accent-foreground")}>{initialsOf(member.fullName)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                      <span className="font-medium">{member.fullName}</span>
                      <span className="text-muted-foreground">{member.studentCode}</span>
                      {member.isLeader && (
                        <Badge tone="info">
                          <Crown className="size-3" aria-hidden />
                          Trưởng phòng
                        </Badge>
                      )}
                      {member.studentId === user?.userId && <Badge>Bạn</Badge>}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <MajorTag code={member.majorCode} />
                      <SkillTags skills={member.skills} />
                    </div>
                  </div>
                  {isLeader && !member.isLeader && <MemberActions room={detail} studentId={member.studentId} name={member.fullName} />}
                </li>
              ))}
            </ul>
          </Section>
        </div>
        {isMember && (
          <div className="lg:sticky lg:top-24 lg:self-start">
            <ChatPanel key={detail.id} conversationId={detail.id} />
          </div>
        )}
      </div>
    </div>
  );
}
