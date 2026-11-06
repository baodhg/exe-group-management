import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, CircleCheck, Flag, Lock, MoveRight, Pencil, Save, Sparkles, Trash2, TriangleAlert, UsersRound } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "../../shared/api/apiClient";
import { useAuth } from "../../shared/auth/useAuth";
import { suggestionReasonText } from "../common/messages";
import type { Course, CourseOverview, Placement, PlacementSuggestions, RoomSummary } from "../common/types";
import { Badge, CheckItem, Checks, Criteria, Criterion, Failure, Field, LinkButton, NativeSelect, Notice, Section, SummaryCard } from "../common/ui";
import { useAllRooms, useAllRoster, useCourseOverview } from "../courses/courseData";
import { MajorTag, SeatStrip } from "../rooms/seats";
import { draftOf, settingsFor } from "./courseDraft";
import { LecturerSelect } from "./CourseForm";
import { failureToast } from "./courseErrors";
import { CourseHeader, FailureNote } from "./CourseHeader";
import { canFinalize, chosenPlacements, freeSeatsOf, fullRoomText, moveAfterText, placementHeadline, placementSubline, roomFinalState, seatShortageText, type FinalizeResult, type PlacementMove } from "./placement";

function LecturerDialog({ course, onClose, onSaved }: { course: Course; onClose: () => void; onSaved: () => Promise<unknown> }) {
  const { api } = useAuth();
  const [lecturer, setLecturer] = useState({ id: course.lecturerId ?? "", name: course.lecturerName ?? "" });
  const save = useMutation({
    mutationFn: () => api.put<Course>(`/api/v1/courses/${course.id}`, settingsFor(course, { ...draftOf(course), lecturerId: lecturer.id, lecturerName: lecturer.name })),
    onSuccess: async () => {
      toast.success("Đã lưu cài đặt");
      onClose();
      await onSaved();
    },
  });

  return (
    <Dialog open onOpenChange={(open) => !open && !save.isPending && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Đổi giảng viên</DialogTitle>
        </DialogHeader>
        <Notice tone="info" icon={Lock}>
          Lớp đã hết hạn nên chỉ đổi được giảng viên.
        </Notice>
        <LecturerSelect
          lecturerId={lecturer.id}
          lecturerName={lecturer.name}
          onChange={(id, name) => {
            setLecturer({ id, name });
            save.reset();
          }}
        />
        <FailureNote error={save.error} />
        <DialogFooter>
          <Button variant="ghost" disabled={save.isPending} onClick={onClose}>
            Huỷ
          </Button>
          <Button pending={save.isPending} disabled={lecturer.id === (course.lecturerId ?? "") || save.isError} onClick={() => save.mutate()}>
            {!save.isPending && <Save />}
            Lưu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FinalizeDialog({ course, groupCount, accepted, acceptedCount, onClose, onFinalized }: { course: Course; groupCount: number; accepted: boolean; acceptedCount: number; onClose: () => void; onFinalized: (result: FinalizeResult) => void }) {
  const { api } = useAuth();
  const queryClient = useQueryClient();
  const finalize = useMutation({
    mutationFn: () => api.post<FinalizeResult>(`/api/v1/courses/${course.id}/finalize`, { acceptExceptions: accepted }),
    onSuccess: async (result) => {
      toast.success(`Đã chốt ${result.data.groups} nhóm, xoá ${result.data.deletedRooms} phòng trống`);
      onFinalized(result.data);
      await Promise.all([["course", course.id], ["overview", course.id], ["rooms", course.id], ["roster", course.id], ["courses"]].map((queryKey) => queryClient.invalidateQueries({ queryKey })));
    },
  });

  return (
    <Dialog open onOpenChange={(open) => !open && !finalize.isPending && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Chốt danh sách nhóm chính thức?</DialogTitle>
        </DialogHeader>
        <Criteria>
          <Criterion label="Số nhóm chính thức">{groupCount} nhóm</Criterion>
          <Criterion label="Hoàn tác">Không thể</Criterion>
          <Criterion label="Thông báo">Sinh viên và giảng viên biết danh sách đã chính thức</Criterion>
          <Criterion label="Phòng được chấp nhận ngoại lệ">{acceptedCount} phòng</Criterion>
        </Criteria>
        <FailureNote error={finalize.error} />
        <DialogFooter>
          <Button variant="ghost" disabled={finalize.isPending} onClick={onClose}>
            Huỷ
          </Button>
          <Button variant="destructive" pending={finalize.isPending} disabled={finalize.isError} onClick={() => finalize.mutate()}>
            {!finalize.isPending && <Flag />}
            {finalize.isPending ? "Đang chốt nhóm" : "Chốt nhóm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FinalizePanel({ course, overview, rooms, accepted, onAccepted, onFinalized }: { course: Course; overview: ReturnType<typeof useCourseOverview>; rooms: readonly RoomSummary[]; accepted: boolean; onAccepted: (accepted: boolean) => void; onFinalized: (result: FinalizeResult) => void }) {
  const [asking, setAsking] = useState(false);
  const data: CourseOverview | undefined = overview.data?.data;
  const unplaced = data?.unplaced.length ?? 0;
  const exceptions = data?.ineligibleRooms.length ?? 0;
  const facts = { unplaced, exceptions, accepted };
  const ready = data !== undefined && canFinalize(facts);
  const states = rooms.map((room) => ({ room, state: roomFinalState(room, data?.minGroupSize ?? course.minGroupSize) }));
  const groupCount = states.filter((item) => item.state.kind !== "empty").length;

  return (
    <Section>
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        <Flag className="size-3.5" aria-hidden />
        Điều kiện chốt nhóm
      </span>
      {overview.isLoading && <Skeleton className="h-40 rounded-xl" />}
      {overview.isError && <Failure error={overview.error} title="Không tải được tiến độ của lớp" onRetry={() => void overview.refetch()} />}
      {data && (
        <>
          <Checks single>
            <CheckItem ok={unplaced === 0} label={unplaced === 0 ? "Mọi sinh viên đã có phòng" : `Còn ${unplaced} sinh viên chưa có phòng`} value={`${data.placedCount}/${data.studentCount}`} />
            <CheckItem ok={exceptions === 0 || accepted} label={exceptions === 0 ? "Mọi phòng có người đều đủ điều kiện" : `${exceptions} phòng chưa đủ người hoặc chưa đủ ngành`} value={exceptions === 0 ? "Đủ" : accepted ? "Ngoại lệ" : "Chưa đủ"} />
          </Checks>
          {exceptions > 0 && (
            <label className="flex cursor-pointer items-start gap-2.5 rounded-xl bg-deadline-soft px-3 py-2.5 text-[13px]/normal text-ink">
              <Checkbox className="mt-0.5" checked={accepted} onCheckedChange={(checked) => onAccepted(checked === true)} />
              <span>Chấp nhận ngoại lệ: {exceptions} phòng chưa đủ điều kiện vẫn thành nhóm chính thức.</span>
            </label>
          )}
          <ul className="divide-y" aria-label="Các phòng">
            {states.map(({ room, state }) => (
              <li key={room.id} className="space-y-2 py-2.5 first:pt-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link to={`/rooms/${room.id}`} className="font-semibold underline-offset-2 hover:underline">
                    {room.name}
                  </Link>
                  <Badge tone={state.kind === "ok" ? "good" : state.kind === "short" ? "warn" : "neutral"} icon={state.kind === "ok" ? Check : state.kind === "short" ? TriangleAlert : Trash2}>
                    {state.label}
                  </Badge>
                </div>
                <SeatStrip capacity={room.capacity} memberCount={room.memberCount} majors={room.majors} missingMajorSeats={room.missingMajorSeats} />
              </li>
            ))}
          </ul>
        </>
      )}
      <Button size="lg" className="w-full" disabled={!ready} onClick={() => setAsking(true)}>
        {ready ? <Flag /> : <Lock />}
        Chốt {groupCount} nhóm chính thức
      </Button>
      {asking && <FinalizeDialog course={course} groupCount={groupCount} accepted={accepted} acceptedCount={accepted ? exceptions : 0} onClose={() => setAsking(false)} onFinalized={onFinalized} />}
    </Section>
  );
}

function reasonOf(placement: Placement): string {
  return placement.reasons.map((reason) => suggestionReasonText(reason.code, reason.detail)).join(". ") || "Còn chỗ hợp lệ";
}

export function PlacementSection({ course, onFinalized }: { course: Course; onFinalized: (result: FinalizeResult) => void }) {
  const { api } = useAuth();
  const queryClient = useQueryClient();
  const [skipped, setSkipped] = useState<ReadonlySet<string>>(new Set());
  const [manual, setManual] = useState<PlacementMove>({ studentId: "", roomId: "" });
  const [placedNow, setPlacedNow] = useState<{ placement: Placement; roomName: string }[]>([]);
  const [changingLecturer, setChangingLecturer] = useState(false);
  const [accepted, setAccepted] = useState(false);

  const suggestions = useQuery({
    queryKey: ["placementSuggestions", course.id],
    queryFn: () => api.get<PlacementSuggestions>(`/api/v1/courses/${course.id}/placement-suggestions`),
  });
  const overview = useCourseOverview(course.id);
  const rooms = useAllRooms(course.id);
  const roster = useAllRoster(course.id);
  const allRooms = rooms.data ?? [];
  const free = freeSeatsOf(allRooms);
  const data = suggestions.data?.data;
  const placements = data?.placements ?? [];
  const chosen = chosenPlacements(placements, free, skipped);
  const selectable = placements.filter((placement) => (free.get(placement.roomId) ?? 0) > 0);
  const selected = selectable.filter((placement) => !skipped.has(placement.student.studentId)).length;
  const allChosen = selectable.length > 0 && selected === selectable.length;
  const summary = overview.data?.data;
  const unplacedCount = summary?.unplaced.length ?? 0;
  const noSeat = data !== undefined && data.rooms.length === 0 && unplacedCount > 0;
  const facts = { unplaced: unplacedCount, exceptions: summary?.ineligibleRooms.length ?? 0, accepted };
  const finishedRows = placedNow.filter((item) => !placements.some((placement) => placement.student.studentId === item.placement.student.studentId));

  const refresh = () => Promise.all([["placementSuggestions", course.id], ["overview", course.id], ["roster", course.id], ["rooms", course.id], ["course", course.id]].map((queryKey) => queryClient.invalidateQueries({ queryKey })));
  const place = useMutation({
    mutationFn: (moves: PlacementMove[]) => api.post<CourseOverview>(`/api/v1/courses/${course.id}/placements`, { placements: moves }),
    onSuccess: async (_, moves) => {
      toast.success(`Đã xếp ${moves.length} sinh viên`);
      const done = moves.flatMap((move) => placements.filter((placement) => placement.student.studentId === move.studentId).map((placement) => ({ placement, roomName: allRooms.find((room) => room.id === move.roomId)?.name ?? placement.roomName })));
      setPlacedNow((current) => [...current, ...done]);
      setSkipped(new Set());
      setManual({ studentId: "", roomId: "" });
      await refresh();
    },
    onError: (error, moves) => {
      const isFull = error instanceof ApiError && error.code === "ROOM_FULL";
      failureToast(error, isFull ? fullRoomText(moves, allRooms) : null);
    },
  });

  function toggle(studentId: string) {
    const next = new Set(skipped);
    if (!next.delete(studentId)) {
      next.add(studentId);
    }

    setSkipped(next);
  }

  const movingStudent = roster.data?.find((student) => student.studentId === manual.studentId);
  const movingFrom = movingStudent?.roomId ? allRooms.find((room) => room.id === movingStudent.roomId) : undefined;

  return (
    <div className="space-y-5">
      <CourseHeader
        course={course}
        title={summary ? placementHeadline(facts) : "Xếp và chốt nhóm"}
        description={summary ? placementSubline(facts) : undefined}
        meta={
          <Button variant="ghost" size="xs" onClick={() => setChangingLecturer(true)}>
            <Pencil />
            Đổi giảng viên
          </Button>
        }
        aside={
          summary && (
            <SummaryCard icon={UsersRound} label="Đã có phòng" value={`${summary.placedCount}/${summary.studentCount}`}>
              <progress value={summary.placedCount} max={Math.max(summary.studentCount, 1)} aria-label="Đã có phòng" />
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Lock className="size-3.5" aria-hidden />
                Sinh viên không còn vào, rời phòng được
              </span>
            </SummaryCard>
          )
        }
      />

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-5">
          <Section
            title="Xếp theo gợi ý"
            icon={Sparkles}
            actions={
              <>
                {selectable.length > 0 && (
                  <span className="flex flex-wrap items-center gap-3">
                    <label className="flex cursor-pointer items-center gap-2 text-[13px]">
                      <Checkbox
                        checked={allChosen}
                        indeterminate={!allChosen && selected > 0}
                        onCheckedChange={() => setSkipped(allChosen ? new Set(selectable.map((placement) => placement.student.studentId)) : new Set())}
                      />
                      {allChosen ? "Đã chọn tất cả" : selected > 0 ? `Đã chọn ${selected} trong ${selectable.length}` : "Chọn tất cả"}
                    </label>
                    <Button size="sm" pending={place.isPending} disabled={chosen.length === 0} onClick={() => place.mutate(chosen.map((placement) => ({ studentId: placement.student.studentId, roomId: placement.roomId })))}>
                      {!place.isPending && <Check />}
                      {place.isPending ? "Đang xếp" : `Áp dụng ${chosen.length} gợi ý`}
                    </Button>
                  </span>
                )}
                {summary && unplacedCount === 0 && (
                  <Badge tone="good" icon={CircleCheck}>
                    Mọi sinh viên đã có phòng.
                  </Badge>
                )}
              </>
            }
          >
            {suggestions.isLoading && <Skeleton className="h-40 rounded-xl" />}
            {suggestions.isError && <Failure error={suggestions.error} title="Không tải được gợi ý xếp phòng" onRetry={() => void suggestions.refetch()} />}
            {placements.length > 0 && <p className="text-sm text-muted-foreground">Hệ thống gợi ý phòng cho từng người theo ngành phòng còn thiếu. Bỏ chọn người bạn muốn xếp tay.</p>}
            {data && !data.ranked && <Notice tone="warn">Dịch vụ gợi ý chưa trả lời, hãy xếp tay bên dưới.</Notice>}
            {noSeat && summary && (
              <Notice tone="bad" title="Không còn phòng nào còn chỗ">
                <p>{seatShortageText(summary.studentCount, allRooms)}</p>
                <LinkButton to={`/admin/courses/${course.id}/roster`} variant="link" size="sm" className="h-auto p-0">
                  Xem danh sách lớp
                </LinkButton>
              </Notice>
            )}
            {(placements.length > 0 || finishedRows.length > 0) && (
              <ul className="divide-y">
                {placements.map((placement) => {
                  const full = rooms.isSuccess && (free.get(placement.roomId) ?? 0) === 0;
                  const studentId = placement.student.studentId;
                  return (
                    <li key={studentId} className="flex flex-wrap items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                      <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-2.5">
                        <Checkbox className="mt-0.5" aria-label={`Chọn ${placement.student.fullName}`} checked={!full && !skipped.has(studentId)} disabled={full} onCheckedChange={() => toggle(studentId)} />
                        <span className="min-w-0 space-y-0.5">
                          <span className="flex flex-wrap items-center gap-2">
                            <strong className="font-bold">{placement.student.fullName}</strong>
                            <span className="text-xs text-muted-foreground">{placement.student.studentCode}</span>
                            <MajorTag code={placement.student.majorCode} />
                          </span>
                          <span className="block text-[13px] text-muted-foreground">
                            Gợi ý {placement.roomName}: {reasonOf(placement)}
                          </span>
                        </span>
                      </label>
                      {full ? (
                        <Badge tone="warn" icon={TriangleAlert}>
                          {placement.roomName} đã đủ người
                        </Badge>
                      ) : (
                        <Button variant="ghost" size="sm" disabled={place.isPending} onClick={() => place.mutate([{ studentId, roomId: placement.roomId }])}>
                          <MoveRight />
                          Xếp vào {placement.roomName}
                        </Button>
                      )}
                    </li>
                  );
                })}
                {finishedRows.map(({ placement, roomName }) => (
                  <li key={placement.student.studentId} className="flex flex-wrap items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <strong className="font-bold">{placement.student.fullName}</strong>
                      <span className="text-xs text-muted-foreground">{placement.student.studentCode}</span>
                      <MajorTag code={placement.student.majorCode} />
                    </span>
                    <Badge tone="good" icon={Check}>
                      Đã xếp vào {roomName}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {data && data.unplaced.length > 0 && (
            <Section title={`Chưa có gợi ý (${data.unplaced.length})`} icon={UsersRound} description="Hệ thống không tìm được phòng cho các bạn này. Hãy xếp tay.">
              <ul className="divide-y">
                {data.unplaced.map((student) => (
                  <li key={student.studentId} className="flex flex-wrap items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <strong className="font-bold">{student.fullName}</strong>
                      <span className="text-xs text-muted-foreground">{student.studentCode}</span>
                      <MajorTag code={student.majorCode} />
                    </span>
                    <Button variant="ghost" size="sm" disabled={noSeat} onClick={() => setManual({ studentId: student.studentId, roomId: "" })}>
                      <MoveRight />
                      Xếp tay
                    </Button>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <Section title="Xếp tay hoặc chuyển phòng" icon={MoveRight}>
            <Criteria columns={3}>
              <Criterion label="Máy chủ kiểm tra">Chỉ sức chứa, không xét ngành và khoá</Criterion>
              <Criterion label="Đã có phòng">Chuyển được, phòng cũ nhường trưởng nhóm cho người vào sớm nhất</Criterion>
              <Criterion label="Từng bị trưởng nhóm xoá">Giáo vụ vẫn xếp lại được</Criterion>
            </Criteria>
            {roster.isError && <Failure error={roster.error} title="Không tải được danh sách sinh viên" onRetry={() => void roster.refetch()} />}
            {rooms.isError && <Failure error={rooms.error} title="Không tải được danh sách phòng" onRetry={() => void rooms.refetch()} />}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Sinh viên">
                <NativeSelect disabled={noSeat} value={manual.studentId} onChange={(event) => setManual({ studentId: event.target.value, roomId: "" })}>
                  <option value="">Chọn sinh viên</option>
                  {roster.data?.map((student) => (
                    <option key={student.studentId} value={student.studentId}>
                      {student.fullName}, {student.studentCode} ({student.majorCode}), {student.roomName ?? "chưa có phòng"}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="Phòng">
                <NativeSelect disabled={noSeat} value={manual.roomId} onChange={(event) => setManual({ ...manual, roomId: event.target.value })}>
                  <option value="">Chọn phòng còn chỗ</option>
                  {allRooms.map((room) => {
                    const here = movingStudent?.roomId === room.id;
                    return (
                      <option key={room.id} value={room.id} disabled={room.freeSeats === 0 || here}>
                        {room.name} ({room.memberCount}/{room.capacity}){here ? ", đang ở đây" : ""}
                      </option>
                    );
                  })}
                </NativeSelect>
              </Field>
            </div>
            {movingFrom && (
              <Criteria columns={3}>
                <Criterion label="Đang ở">{movingFrom.name}</Criterion>
                <Criterion label="Phòng cũ sau khi chuyển">{moveAfterText(movingFrom, manual.studentId)}</Criterion>
                <Criterion label="Sinh viên nhận thông báo">Được chuyển khỏi phòng cũ</Criterion>
              </Criteria>
            )}
            <Button variant="outline" className="self-end" pending={place.isPending} disabled={!manual.studentId || !manual.roomId || noSeat} onClick={() => place.mutate([manual])}>
              {!place.isPending && <MoveRight />}
              {movingFrom ? "Chuyển sang phòng" : "Xếp vào phòng"}
            </Button>
          </Section>

          <Section title="Sau hạn và khi chốt nhóm" icon={Lock}>
            <Criteria columns={3}>
              <Criterion label="Vào, rời phòng">Sinh viên không tự làm được</Criterion>
              <Criterion label="Đề tài của phòng">Trưởng nhóm vẫn sửa được tới khi chốt</Criterion>
              <Criterion label="Trò chuyện của phòng">Vẫn mở</Criterion>
            </Criteria>
            <Criteria columns={4}>
              <Criterion label="Phòng không có ai">{allRooms.filter((room) => room.memberCount === 0).map((room) => room.name).join(", ") || "Không có"}</Criterion>
              <Criterion label="Đánh số lại">Nhóm 1 đến {allRooms.filter((room) => room.memberCount > 0).length}</Criterion>
              <Criterion label="Phòng và danh sách lớp">Chỉ xem</Criterion>
              <Criterion label="Hoàn tác">Không thể</Criterion>
            </Criteria>
          </Section>
        </div>

        <FinalizePanel course={course} overview={overview} rooms={allRooms} accepted={accepted} onAccepted={setAccepted} onFinalized={onFinalized} />
      </div>

      {changingLecturer && <LecturerDialog course={course} onClose={() => setChangingLecturer(false)} onSaved={refresh} />}
    </div>
  );
}
