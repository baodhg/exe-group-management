import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Award, CalendarRange, Clock, FileUp, Flag, LoaderCircle, Lock, RefreshCw, Save, Wifi, WifiOff } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAuth } from "../../shared/auth/useAuth";
import { formatDateTime } from "../common/messages";
import type { Course } from "../common/types";
import { Badge, Criteria, Criterion, Field, LinkButton, Notice, SummaryCard, type Tone } from "../common/ui";
import { useAllRooms, useCourseOverview, useNow } from "../courses/courseData";
import { CourseFailure } from "../courses/CourseFailure";
import { CourseRoomsTable } from "../courses/CourseRoomsTable";
import { attentionFor, countdownText, deadlineReached, shortDateTime } from "../courses/overview";
import { AttentionCard, IneligibleRooms, OverviewSkeleton, OverviewTiles, PlacementProgress, UnplacedMajors, UnplacedStudents } from "../courses/OverviewPanel";
import { useRealtime, type ConnectionState } from "../realtime/realtimeContext";
import { courseFieldErrors, draftOf, settingsFor, validateDraft, type CourseDraft } from "./courseDraft";
import { LecturerSelect } from "./CourseForm";
import { CourseHeader, FailureNote } from "./CourseHeader";

const liveViews: Record<ConnectionState, { label: string; tone: Tone; icon: typeof Wifi }> = {
  connected: { label: "Cập nhật trực tiếp", tone: "good", icon: Wifi },
  connecting: { label: "Đang kết nối lại", tone: "warn", icon: LoaderCircle },
  reconnecting: { label: "Đang kết nối lại", tone: "warn", icon: LoaderCircle },
  disconnected: { label: "Mất kết nối trực tiếp", tone: "bad", icon: WifiOff },
};

function ExtendDialog({ course, onClose, onSaved }: { course: Course; onClose: () => void; onSaved: () => Promise<unknown> }) {
  const { api } = useAuth();
  const baseline = draftOf(course);
  const [draft, setDraft] = useState<CourseDraft>(baseline);
  const [expireError, setExpireError] = useState<string | undefined>();
  const save = useMutation({
    mutationFn: () => api.put<Course>(`/api/v1/courses/${course.id}`, settingsFor(course, draft)),
    onSuccess: async () => {
      toast.success("Đã lưu cài đặt");
      onClose();
      await onSaved();
    },
    onError: (error) => setExpireError(courseFieldErrors(error).expireAt),
  });
  const unchanged = draft.expireAt === baseline.expireAt && draft.lecturerId === baseline.lecturerId;

  function submit() {
    const found = validateDraft(draft, "Published", baseline);
    if (found.expireAt) {
      setExpireError(found.expireAt);
      return;
    }

    save.mutate();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !save.isPending && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dời hạn và đổi giảng viên</DialogTitle>
        </DialogHeader>
        <Criteria>
          <Criterion label="Giảng viên">Đổi được</Criterion>
          <Criterion label="Hạn chọn phòng">Chỉ dời về sau</Criterion>
        </Criteria>
        <LecturerSelect lecturerId={draft.lecturerId} lecturerName={draft.lecturerName} onChange={(lecturerId, lecturerName) => setDraft({ ...draft, lecturerId, lecturerName })} />
        <Field label="Hạn chọn phòng" error={expireError}>
          <Input
            type="datetime-local"
            min={baseline.expireAt}
            value={draft.expireAt}
            onChange={(event) => {
              setDraft({ ...draft, expireAt: event.target.value });
              setExpireError(undefined);
              save.reset();
            }}
          />
        </Field>
        <FailureNote error={save.error} />
        <DialogFooter>
          <Button variant="ghost" disabled={save.isPending} onClick={onClose}>
            Huỷ
          </Button>
          <Button pending={save.isPending} disabled={!draft.expireAt || unchanged} onClick={submit}>
            {!save.isPending && <Save />}
            Lưu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CloseDialog({ course, onClose, onClosed }: { course: Course; onClose: () => void; onClosed: () => Promise<unknown> }) {
  const { api } = useAuth();
  const navigate = useNavigate();
  const expire = useMutation({
    mutationFn: () => api.post<Course>(`/api/v1/courses/${course.id}/expire`),
    onSuccess: async () => {
      toast.success("Đã kết thúc tìm nhóm");
      onClose();
      await onClosed();
      navigate(`/admin/courses/${course.id}/placement`);
    },
  });

  return (
    <Dialog open onOpenChange={(open) => !open && !expire.isPending && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Đóng chọn phòng ngay?</DialogTitle>
        </DialogHeader>
        <Criteria>
          <Criterion label="Sinh viên">Không vào, rời phòng được nữa</Criterion>
          <Criterion label="Đơn đang chờ">Bị đóng</Criterion>
          <Criterion label="Sinh viên nhận thông báo">Đã hết hạn tìm nhóm</Criterion>
          <Criterion label="Hoàn tác">Không thể, lớp không mở lại được</Criterion>
        </Criteria>
        <FailureNote error={expire.error} />
        <DialogFooter>
          <Button variant="ghost" disabled={expire.isPending} onClick={onClose}>
            Huỷ
          </Button>
          <Button variant="destructive" pending={expire.isPending} disabled={expire.isError} onClick={() => expire.mutate()}>
            {!expire.isPending && <Lock />}
            {expire.isPending ? "Đang đóng" : "Đóng ngay"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function OverviewSection({ course }: { course: Course }) {
  const queryClient = useQueryClient();
  const { state } = useRealtime();
  const now = useNow();
  const overview = useCourseOverview(course.id);
  const data = overview.data?.data;
  const hasUnplaced = (data?.unplaced.length ?? 0) > 0;
  const rooms = useAllRooms(course.id, hasUnplaced);
  const [dialog, setDialog] = useState<"extend" | "close" | null>(null);
  const [changed, setChanged] = useState<string[]>([]);
  const onChanged = useCallback((names: string[]) => setChanged(names), []);
  useEffect(() => {
    if (changed.length === 0) {
      return undefined;
    }

    const timer = setTimeout(() => setChanged([]), 15_000);
    return () => clearTimeout(timer);
  }, [changed]);

  const isPublished = course.phase === "Published";
  const isFinal = course.phase === "Finalized";
  const closing = deadlineReached(course.phase, course.expireAt, now);
  const live = liveViews[state];
  const refresh = () => Promise.all([["course", course.id], ["courses"], ["overview", course.id], ["rooms", course.id], ["roster", course.id]].map((queryKey) => queryClient.invalidateQueries({ queryKey })));
  const unplaced = data?.unplaced.length ?? 0;
  const headline = isFinal ? "Cả lớp đã có nhóm" : course.studentCount === 0 ? "Lớp chưa có sinh viên" : data ? `${unplaced} bạn chưa có phòng` : "Điều phối";
  const attention = data && rooms.data ? attentionFor(rooms.data, data.unplaced) : null;

  const aside = isPublished ? (
    <SummaryCard icon={Clock} label="Hạn chọn phòng" value={closing ? "Đang đóng" : (countdownText(course.expireAt, now) ?? "Chưa đặt hạn")}>
      <span className="text-xs text-muted-foreground">{course.expireAt ? (closing ? `Đã tới hạn ${shortDateTime(course.expireAt)}, còn tối đa 1 phút` : `Hạn ${shortDateTime(course.expireAt)}`) : "Lớp không tự đóng khi chưa đặt hạn"}</span>
      <span className="flex flex-wrap gap-2 pt-1">
        <Button variant="outline" size="sm" onClick={() => setDialog("extend")}>
          <CalendarRange />
          Dời hạn
        </Button>
        <Button variant="outline" size="sm" onClick={() => setDialog("close")}>
          <Lock />
          Đóng ngay
        </Button>
      </span>
    </SummaryCard>
  ) : isFinal ? (
    <SummaryCard icon={Award} label="Đã chốt nhóm" value={`${course.roomCount} nhóm`}>
      <span className="text-xs text-muted-foreground">Chốt nhóm lúc {formatDateTime(course.finalizedAt)}</span>
      <LinkButton to={`/admin/courses/${course.id}/final`} variant="outline" size="sm" className="self-start">
        <Award />
        Xem nhóm chính thức
      </LinkButton>
    </SummaryCard>
  ) : (
    <SummaryCard icon={Clock} label="Đã hết hạn" value={data ? `${data.placedCount}/${data.studentCount} đã có phòng` : undefined}>
      <span className="text-xs text-muted-foreground">Hạn {shortDateTime(course.expireAt)}</span>
      <LinkButton to={`/admin/courses/${course.id}/placement`} size="sm" className="self-start">
        <Flag />
        Xếp và chốt nhóm
      </LinkButton>
    </SummaryCard>
  );

  return (
    <div className="space-y-5">
      <CourseHeader
        course={course}
        title={headline}
        aside={aside}
        meta={
          !isFinal && (
            <span role="status">
              <Badge tone={live.tone} icon={live.icon}>
                {live.label}
              </Badge>
            </span>
          )
        }
      />
      {closing && (
        <Notice tone="warn" icon={Clock}>
          Đã tới hạn. Hệ thống đóng lớp trong vòng 1 phút, lớp vẫn ở Đang tìm nhóm cho tới lúc đó.
        </Notice>
      )}
      {!isFinal && state === "disconnected" && (
        <Notice tone="bad" icon={WifiOff} title="Mất kết nối trực tiếp, số liệu có thể đã cũ.">
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0"
            onClick={() => {
              void refresh();
              toast.success("Đã tải lại số liệu");
            }}
          >
            <RefreshCw />
            Tải lại số liệu
          </Button>
        </Notice>
      )}
      {changed.length > 0 && (
        <Notice tone="info" icon={Wifi}>
          {changed.join(", ")} vừa có thay đổi. Số liệu đã được làm mới.
        </Notice>
      )}

      {overview.isLoading && <OverviewSkeleton />}
      {overview.isError && (
        <CourseFailure
          error={overview.error}
          onRetry={() => void overview.refetch()}
          failTitle="Không tải được tiến độ của lớp"
          forbiddenText="Tiến độ của lớp chỉ dành cho giáo vụ và giảng viên của lớp."
          missingText="Lớp này không còn tồn tại hoặc đường dẫn đã sai."
          backTo="/admin/courses"
          backLabel="Về các lớp"
        />
      )}
      {data && (
        <>
          <OverviewTiles data={data} />
          <PlacementProgress data={data} />
          {data.unplaced.length > 0 && (
            <div className={attention ? "grid gap-5 lg:grid-cols-2" : "grid gap-5"}>
              <UnplacedMajors data={data} />
              {attention && <AttentionCard attention={attention} />}
            </div>
          )}
          <CourseRoomsTable
            courseId={course.id}
            minGroupSize={data.minGroupSize}
            finalized={isFinal}
            layout="overview"
            title={isFinal ? "Nhóm chính thức" : "Các phòng"}
            issueCount={data.ineligibleRooms.length + data.emptyRoomCount}
            highlight={changed}
            onChanged={onChanged}
          />
          <div className="grid items-start gap-5 lg:grid-cols-2">
            <IneligibleRooms data={data} />
            <UnplacedStudents
              data={data}
              emptyAction={
                !isFinal && (
                  <LinkButton to={`/admin/courses/${course.id}/roster`}>
                    <FileUp />
                    Nhập danh sách lớp
                  </LinkButton>
                )
              }
            />
          </div>
        </>
      )}

      {dialog === "extend" && isPublished && <ExtendDialog course={course} onClose={() => setDialog(null)} onSaved={refresh} />}
      {dialog === "close" && isPublished && <CloseDialog course={course} onClose={() => setDialog(null)} onClosed={refresh} />}
    </div>
  );
}
