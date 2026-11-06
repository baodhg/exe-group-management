import { useMutation, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, CalendarDays, Check, Clock, DoorOpen, LayoutGrid, RefreshCw, Sparkles } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { ApiResult } from "../../shared/api/types";
import { useAuth } from "../../shared/auth/useAuth";
import { errorText, formatDateTime, suggestionReasonText } from "../common/messages";
import type { Course, JoinRequest, RoomDetail, RoomSuggestions, RoomSummary, StudentProfile } from "../common/types";
import { EmptyState, Failure, LinkButton, Loading, Notice, Section, SummaryCard } from "../common/ui";
import { RoomBoard } from "../rooms/RoomBoard";
import { defaultRoomSelection, rankedRoomIds, roomHint } from "../rooms/roomBoardLogic";
import { RoomCard } from "../rooms/RoomCard";
import { SeatLegend } from "../rooms/seats";
import { useCourseRooms } from "../rooms/useCourseRooms";
import { CourseHero } from "./CourseHero";
import { ApplyDialog, WithdrawDialog } from "./JoinDialogs";
import { RoomDetailPanel } from "./RoomDetailPanel";
import { countdownText, hasErrorCode, heroCopy, isPhaseStale, sumMembers } from "./studentCourse";
import { useDeadlineReached } from "./useDeadlineReached";

const suggestionsShown = 3;

type OpenDialog = { kind: "apply" | "withdraw"; room: RoomDetail } | null;

function BoardCard({ course, stale, placed }: { course: Course; stale: boolean; placed: number | null }) {
  if (course.phase === "Setup") {
    return (
      <SummaryCard icon={course.publishAt ? Clock : CalendarDays} label={course.publishAt ? "Mở chọn phòng sau" : "Mở chọn phòng"} value={course.publishAt ? countdownText(course.publishAt) : "Chưa hẹn giờ"}>
        <span className="text-[13px] text-muted-foreground">{course.publishAt ? "Giáo vụ đã hẹn giờ mở lớp" : "Giáo vụ chưa đặt giờ mở lớp"}</span>
      </SummaryCard>
    );
  }

  const finished = stale || course.phase !== "Published";
  const value = finished ? "Đã hết hạn" : course.expireAt ? countdownText(course.expireAt) : "Chưa đặt hạn";
  return (
    <SummaryCard icon={Clock} label="Hạn tìm nhóm" value={value}>
      {course.expireAt && <span className="text-[13px] text-muted-foreground">{formatDateTime(course.expireAt)}</span>}
      {placed !== null && (
        <>
          <progress value={placed} max={Math.max(course.studentCount, 1)} aria-label="Sinh viên đã có phòng" />
          <span className="tabular text-[13px] font-semibold">
            {placed}/{course.studentCount} sinh viên đã có phòng
          </span>
        </>
      )}
    </SummaryCard>
  );
}

export function StudentBoardView({
  course,
  myRoom,
  requests,
  backToStatus,
}: {
  course: Course;
  myRoom: UseQueryResult<ApiResult<RoomSummary[]>>;
  requests: readonly JoinRequest[];
  backToStatus?: () => void;
}) {
  const { api, user } = useAuth();
  const queryClient = useQueryClient();
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<OpenDialog>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [removedIds, setRemovedIds] = useState<readonly string[]>([]);
  const [refused, setRefused] = useState(false);
  const panelRef = useRef<HTMLElement>(null);

  const courseId = course.id;
  const mine = myRoom.data?.data[0] ?? null;
  const deadlineReached = useDeadlineReached(course.phase === "Published" ? course.expireAt : null);

  const profile = useQuery({
    queryKey: ["profile", course.semesterId],
    queryFn: () => api.get<StudentProfile>(`/api/v1/semesters/${course.semesterId}/students/me`),
  });
  const everyRoom = useCourseRooms(courseId);
  const suggestions = useQuery({
    queryKey: ["suggestions", courseId, { top: 20 }],
    queryFn: () => api.get<RoomSuggestions>(`/api/v1/courses/${courseId}/rooms/suggestions`, { top: 20 }),
    enabled: course.phase === "Published" && myRoom.isSuccess && mine === null && !deadlineReached && !refused,
  });

  const stale = isPhaseStale(course.phase, { deadlineReached, refused: refused || hasErrorCode(suggestions.error, "COURSE_NOT_PUBLISHED") });
  const choosing = course.phase === "Published" && myRoom.isSuccess && mine === null && !stale;
  const suggested = suggestions.data?.data;
  const rankedIds = rankedRoomIds(suggested);
  const myMajorId = profile.data?.data.majorId ?? null;
  const myMajorCode = profile.data?.data.majorCode ?? null;

  const pendingRequests = requests.filter((request) => request.status === "Pending");
  const pendingRoomIds = pendingRequests.map((request) => request.roomId);
  const firstRoomId = everyRoom.data?.data[0]?.id ?? null;
  const selectedId = defaultRoomSelection({
    chosenId,
    myRoomId: mine?.id ?? null,
    pendingRoomIds,
    suggestedIds: choosing ? (suggested?.rooms.map((item) => item.room.id) ?? []) : [],
    firstRoomId,
  });

  async function refresh(roomId?: string) {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["rooms", courseId] }),
      queryClient.invalidateQueries({ queryKey: ["joinRequests"] }),
      queryClient.invalidateQueries({ queryKey: ["suggestions", courseId] }),
      ...(roomId ? [queryClient.invalidateQueries({ queryKey: ["room", roomId] })] : []),
    ]);
  }

  function noteRefusal(error: unknown, roomId: string) {
    if (hasErrorCode(error, "COURSE_NOT_PUBLISHED")) {
      setRefused(true);
    }

    if (hasErrorCode(error, "REMOVED_FROM_ROOM")) {
      setRemovedIds((ids) => [...ids, roomId]);
    }
  }

  function closeDialog() {
    setDialog(null);
    setDialogError(null);
  }

  const join = useMutation({
    mutationFn: (roomId: string) => api.post(`/api/v1/rooms/${roomId}/join`),
    onSuccess: (_, roomId) => {
      setChosenId(roomId);
      toast.success("Bạn đã vào phòng");
    },
    onError: (error, roomId) => {
      noteRefusal(error, roomId);
      toast.error("Không vào được phòng", { description: errorText(error) });
    },
    onSettled: (_, __, roomId) => refresh(roomId),
  });

  const apply = useMutation({
    mutationFn: ({ roomId, message }: { roomId: string; message: string }) => api.post<JoinRequest>("/api/v1/join-requests", { roomId, message: message || undefined }),
    onSuccess: async (_, { roomId }) => {
      closeDialog();
      toast.success("Đã gửi đơn, chờ trưởng nhóm duyệt");
      await refresh(roomId);
    },
    onError: async (error, { roomId }) => {
      noteRefusal(error, roomId);
      setDialogError(errorText(error));
      await refresh(roomId);
    },
  });

  const withdraw = useMutation({
    mutationFn: ({ requestId }: { requestId: string; roomId: string }) => api.post<JoinRequest>(`/api/v1/join-requests/${requestId}/withdraw`),
    onSuccess: async (_, { roomId }) => {
      closeDialog();
      toast.success("Đã rút đơn");
      await refresh(roomId);
    },
    onError: async (error, { roomId }) => {
      noteRefusal(error, roomId);
      setDialogError(errorText(error));
      await refresh(roomId);
    },
  });

  const reload = useMutation({
    mutationFn: async () => {
      setRefused(false);
      await Promise.all([queryClient.invalidateQueries({ queryKey: ["course", courseId] }), refresh(selectedId ?? undefined)]);
    },
  });

  function selectRoom(roomId: string) {
    setChosenId(roomId);
    if (!window.matchMedia("(min-width: 1280px)").matches) {
      panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  const copy = heroCopy(course.phase, mine !== null);
  const placed = everyRoom.data ? sumMembers(everyRoom.data.data) : null;
  const dialogPending = dialog ? pendingRequests.find((request) => request.roomId === dialog.room.id) : undefined;

  return (
    <div className="space-y-4">
      <CourseHero
        course={course}
        title={copy.title}
        text={copy.text}
        showApplications
        aside={<BoardCard course={course} stale={stale} placed={placed} />}
        extra={
          backToStatus && (
            <Button variant="outline" size="sm" onClick={backToStatus}>
              <ArrowLeft aria-hidden />
              Về tình trạng của tôi
            </Button>
          )
        }
      />

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(340px,2fr)]">
        <section className="flex min-w-0 flex-col gap-3.5" aria-label="Danh sách phòng">
          {stale && (
            <Notice tone="warn" icon={Clock} title="Lớp vừa chuyển giai đoạn">
              <p>Đã qua hạn tìm nhóm. Trang này đang hiện dữ liệu cũ, hãy tải lại để xem giai đoạn mới.</p>
              <Button variant="outline" size="sm" className="mt-1.5" pending={reload.isPending} onClick={() => reload.mutate()}>
                {!reload.isPending && <RefreshCw aria-hidden />}
                Tải lại
              </Button>
            </Notice>
          )}

          {myRoom.isLoading && <Skeleton className="h-36 rounded-xl" />}
          {myRoom.isError && (
            <Section>
              <Failure error={myRoom.error} title="Không tải được phòng của bạn" onRetry={() => void myRoom.refetch()} />
            </Section>
          )}

          {mine && (
            <Section
              flush
              title="Phòng của bạn"
              icon={DoorOpen}
              actions={
                <LinkButton size="sm" to={`/rooms/${mine.id}`}>
                  <ArrowRight aria-hidden />
                  Vào phòng
                </LinkButton>
              }
            >
              <div className="mt-2 border-t">
                <RoomCard room={mine} mine selected={selectedId === mine.id} onSelect={() => selectRoom(mine.id)} />
              </div>
            </Section>
          )}

          {choosing && (
            <Section flush title="Phòng hợp với bạn" icon={Sparkles} description="Xếp theo ngành phòng còn thiếu và kỹ năng bạn bổ sung được cho phòng.">
              <Loading when={suggestions.isLoading} rows={2} />
              {suggestions.isError && <Failure error={suggestions.error} title="Không tải được phòng gợi ý" onRetry={() => void suggestions.refetch()} />}
              {suggested && !suggested.ranked && (
                <div className="px-[18px] pt-2">
                  <Notice tone="info">Chưa xếp hạng được lúc này, đây là các phòng bạn vào được.</Notice>
                </div>
              )}
              {suggested?.rooms.length === 0 && <EmptyState icon={DoorOpen} title="Không còn phòng nào bạn vào được." description="Bảng phòng bên dưới vẫn cho xem mọi phòng của lớp." />}
              {suggested && suggested.rooms.length > 0 && (
                <div className="mt-2 border-t">
                  {suggested.rooms.slice(0, suggestionsShown).map((item) => (
                    <RoomCard key={item.room.id} room={item.room} compact selected={selectedId === item.room.id} onSelect={() => selectRoom(item.room.id)} pending={pendingRoomIds.includes(item.room.id)} hint={null}>
                      {item.reasons.length > 0 && (
                        <ul className="flex list-none flex-col gap-0.5">
                          {item.reasons.map((reason) => (
                            <li key={`${reason.code}-${reason.detail}`} className="flex items-center gap-1.5 text-[13px] text-ink">
                              <Check className="size-3.5 shrink-0" aria-hidden />
                              {suggestionReasonText(reason.code, reason.detail)}
                            </li>
                          ))}
                        </ul>
                      )}
                    </RoomCard>
                  ))}
                </div>
              )}
            </Section>
          )}

          <Section flush title="Bảng phòng" icon={LayoutGrid} actions={<SeatLegend />}>
            <RoomBoard
              courseId={courseId}
              myRoomId={mine?.id ?? null}
              selectedRoomId={selectedId}
              onSelectRoom={selectRoom}
              myMajorId={choosing ? myMajorId : null}
              rankedIds={rankedIds}
              pendingRoomIds={pendingRoomIds}
              showLegend={false}
              hintFor={choosing ? (room) => roomHint(room, { choosing: true, majorId: myMajorId, majorCode: myMajorCode, removed: removedIds.includes(room.id) }) : undefined}
            />
          </Section>
        </section>

        {selectedId && (
          <aside ref={panelRef} className="scroll-mt-4 xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto" aria-label="Chi tiết phòng">
            <RoomDetailPanel
              roomId={selectedId}
              userId={user?.userId}
              context={{
                phase: course.phase,
                stale,
                myRoomId: mine?.id ?? null,
                myMajorId,
                pending: pendingRoomIds.includes(selectedId),
                removed: removedIds.includes(selectedId),
                suggested: choosing && rankedIds.includes(selectedId),
              }}
              reasons={suggested?.rooms.find((item) => item.room.id === selectedId)?.reasons ?? []}
              pendingElsewhere={pendingRequests.filter((request) => request.roomId !== selectedId).map((request) => request.roomName)}
              joining={join.isPending}
              onJoin={(room) => join.mutate(room.id)}
              onApply={(room) => {
                setDialogError(null);
                setDialog({ kind: "apply", room });
              }}
              onWithdraw={(room) => {
                setDialogError(null);
                setDialog({ kind: "withdraw", room });
              }}
            />
          </aside>
        )}
      </div>

      {dialog?.kind === "apply" && (
        <ApplyDialog
          key={dialog.room.id}
          open
          roomName={dialog.room.name}
          pending={apply.isPending}
          error={dialogError}
          onClose={closeDialog}
          onSend={(message) => {
            setDialogError(null);
            apply.mutate({ roomId: dialog.room.id, message });
          }}
        />
      )}
      {dialog?.kind === "withdraw" && (
        <WithdrawDialog
          open
          roomName={dialog.room.name}
          pending={withdraw.isPending}
          error={dialogError}
          onClose={closeDialog}
          onConfirm={() => {
            if (dialogPending) {
              setDialogError(null);
              withdraw.mutate({ requestId: dialogPending.id, roomId: dialog.room.id });
            }
          }}
        />
      )}
    </div>
  );
}
