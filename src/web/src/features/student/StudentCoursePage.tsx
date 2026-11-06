import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Check, Hourglass, Inbox, Sparkles, UsersRound } from "lucide-react";
import { Link, useParams } from "react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "../../shared/auth/useAuth";
import { useDialogs } from "../common/dialogsContext";
import { errorText, formatRelative, requestReasonText, requestStatusLabels, suggestionReasonText } from "../common/messages";
import type { Course, JoinRequest, RoomSuggestions, RoomSummary } from "../common/types";
import { Badge, ErrorNote, LinkButton, Loading, PageHeader, Section, type Tone } from "../common/ui";
import { DeadlineText, PhaseBadge } from "../courses/CourseCard";
import { RoomBoard } from "../rooms/RoomBoard";
import { RoomCard } from "../rooms/RoomCard";

const requestTones: Record<JoinRequest["status"], Tone> = { Pending: "info", Approved: "good", Rejected: "bad", Cancelled: "neutral" };

function MyRoomPanel({ course, mine, loaded }: { course: Course; mine: RoomSummary | null; loaded: boolean }) {
  if (!loaded) {
    return <Skeleton className="h-40 rounded-xl" />;
  }

  if (mine) {
    return (
      <Section title="Phòng của bạn" actions={
          <LinkButton to={`/rooms/${mine.id}`}>
            Vào phòng
            <ArrowRight />
          </LinkButton>
        }>
        <div className="max-w-xl">
          <RoomCard room={mine} mine />
        </div>
      </Section>
    );
  }

  const message =
    course.phase === "Published"
      ? { title: "Bạn chưa có phòng", body: "Chọn một phòng gợi ý bên dưới hoặc tìm trên bảng phòng. Phòng mở thì vào thẳng, phòng khóa thì gửi đơn cho trưởng phòng." }
      : course.phase === "Expired"
        ? { title: "Đã hết hạn tìm nhóm", body: "Bạn chưa có phòng. Phòng đào tạo sẽ xếp bạn vào một phòng còn chỗ trước khi chốt nhóm." }
        : course.phase === "Setup"
          ? { title: "Course chưa mở tìm nhóm", body: "Khi course mở, bạn sẽ nhận thông báo và có thể chọn phòng." }
          : null;

  if (!message) {
    return null;
  }

  return (
    <div className="flex items-start gap-3 rounded-xl border border-deadline/30 bg-deadline-soft p-4 text-deadline-ink">
      <Hourglass className="mt-0.5 size-5 shrink-0" aria-hidden />
      <div className="space-y-1">
        <p className="font-semibold">{message.title}</p>
        <p className="text-sm">{message.body}</p>
      </div>
    </div>
  );
}

export function StudentCoursePage() {
  const { courseId = "" } = useParams();
  const { api } = useAuth();
  const { confirm } = useDialogs();
  const queryClient = useQueryClient();

  const course = useQuery({ queryKey: ["course", courseId], queryFn: () => api.get<Course>(`/api/v1/courses/${courseId}`) });
  const myRoom = useQuery({
    queryKey: ["rooms", courseId, "mine"],
    queryFn: () => api.get<RoomSummary[]>(`/api/v1/courses/${courseId}/rooms`, { mine: true }),
  });
  const phase = course.data?.data.phase;
  const mine = myRoom.data?.data[0] ?? null;

  const suggestions = useQuery({
    queryKey: ["suggestions", courseId],
    queryFn: () => api.get<RoomSuggestions>(`/api/v1/courses/${courseId}/rooms/suggestions`, { top: 3 }),
    enabled: phase === "Published" && myRoom.isSuccess && mine === null,
  });
  const applications = useQuery({
    queryKey: ["joinRequests", "mine", courseId],
    queryFn: () => api.get<JoinRequest[]>("/api/v1/join-requests", { courseId, pageSize: 50 }),
  });

  const withdraw = useMutation({
    mutationFn: (requestId: string) => api.post<JoinRequest>(`/api/v1/join-requests/${requestId}/withdraw`),
    onSuccess: async () => {
      toast.success("Đã rút đơn");
      await queryClient.invalidateQueries({ queryKey: ["joinRequests"] });
    },
    onError: (error) => toast.error(errorText(error)),
  });

  if (course.isLoading) {
    return <Loading when rows={4} />;
  }

  if (!course.data) {
    return <ErrorNote error={course.error} />;
  }

  const current = course.data.data;
  const requests = applications.data?.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        crumbs={[{ label: "Course của tôi", to: "/student" }, { label: `${current.subjectCode} ${current.classCode}` }]}
        title={`${current.subjectCode}: ${current.subjectName}`}
        meta={
          <>
            <PhaseBadge phase={current.phase} />
            <Badge>Lớp {current.classCode}</Badge>
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <UsersRound className="size-4" aria-hidden />
              Nhóm {current.minGroupSize} đến {current.maxGroupSize} người
            </span>
            <DeadlineText expireAt={current.expireAt} phase={current.phase} className="text-sm text-muted-foreground" />
          </>
        }
        actions={
          <LinkButton variant="outline" to={`/student/semesters/${current.semesterId}/skills`}>
            <Sparkles />
            Skill của tôi
          </LinkButton>
        }
      />

      <MyRoomPanel course={current} mine={mine} loaded={myRoom.isSuccess} />

      {phase === "Published" && mine === null && (
        <Section title="Phòng hợp với bạn" description="Xếp theo ngành phòng còn thiếu và skill bạn bổ sung được cho phòng.">
          <Loading when={suggestions.isLoading} />
          <ErrorNote error={suggestions.error} />
          {suggestions.data && !suggestions.data.data.ranked && (
            <p className="mb-3 text-sm text-muted-foreground">Chưa xếp hạng được lúc này, đây là các phòng bạn vào được.</p>
          )}
          {suggestions.data?.data.rooms.length === 0 && <p className="text-sm text-muted-foreground">Không còn phòng nào bạn vào được.</p>}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {suggestions.data?.data.rooms.map((item) => (
              <RoomCard key={item.room.id} room={item.room}>
                {item.reasons.length > 0 && (
                  <ul className="space-y-1 rounded-lg bg-accent/60 p-2.5 text-xs text-accent-foreground">
                    {item.reasons.map((reason) => (
                      <li key={`${reason.code}-${reason.detail}`} className="flex items-start gap-1.5">
                        <Check className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                        {suggestionReasonText(reason.code, reason.detail)}
                      </li>
                    ))}
                  </ul>
                )}
              </RoomCard>
            ))}
          </div>
        </Section>
      )}

      {requests.length > 0 && (
        <Section title="Đơn xin vào phòng">
          <ErrorNote error={applications.error} />
          <ul className="divide-y">
            {requests.map((request) => (
              <li key={request.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3 first:pt-0 last:pb-0">
                <Inbox className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <div className="min-w-0 flex-1">
                  <Link to={`/rooms/${request.roomId}`} className="font-medium hover:underline">
                    {request.roomName}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    Gửi {formatRelative(request.createdAt)}
                    {request.reasonCode && `. ${requestReasonText(request.reasonCode)}`}
                    {request.reasonText && `: ${request.reasonText}`}
                  </p>
                </div>
                <Badge tone={requestTones[request.status]}>{requestStatusLabels[request.status]}</Badge>
                {request.status === "Pending" && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={withdraw.isPending}
                    onClick={async () => {
                      if (await confirm({ title: `Rút đơn vào ${request.roomName}?`, description: "Bạn có thể gửi lại đơn sau nếu phòng vẫn còn chỗ.", confirmLabel: "Rút đơn", destructive: true })) {
                        withdraw.mutate(request.id);
                      }
                    }}
                  >
                    Rút đơn
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title={current.phase === "Finalized" ? "Danh sách nhóm chính thức" : "Bảng phòng"}>
        <RoomBoard courseId={courseId} finalized={current.phase === "Finalized"} myRoomId={mine?.id ?? null} />
      </Section>
    </div>
  );
}
