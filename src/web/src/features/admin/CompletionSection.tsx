import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleCheck, CircleDashed, Lock } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useAuth } from "../../shared/auth/useAuth";
import { useDialogs } from "../common/dialogsContext";
import { errorText, suggestionReasonText } from "../common/messages";
import type { Course, CourseOverview, PlacementSuggestions } from "../common/types";
import { ErrorNote, Field, Loading, NativeSelect, Notice, Section } from "../common/ui";

interface Move {
  studentId: string;
  roomId: string;
}

export function PlacementSection({ course }: { course: Course }) {
  const { api } = useAuth();
  const queryClient = useQueryClient();
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [manual, setManual] = useState<Move>({ studentId: "", roomId: "" });

  const suggestions = useQuery({
    queryKey: ["placementSuggestions", course.id],
    queryFn: () => api.get<PlacementSuggestions>(`/api/v1/courses/${course.id}/placement-suggestions`),
  });
  const refresh = () =>
    Promise.all(
      [["placementSuggestions", course.id], ["overview", course.id], ["roster", course.id], ["rooms", course.id]].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
    );
  const place = useMutation({
    mutationFn: (placements: Move[]) => api.post<CourseOverview>(`/api/v1/courses/${course.id}/placements`, { placements }),
    onSuccess: async (_, placements) => {
      toast.success(`Đã xếp ${placements.length} sinh viên`);
      setSkipped(new Set());
      setManual({ studentId: "", roomId: "" });
      await refresh();
    },
    onError: (error) => toast.error(errorText(error)),
  });

  if (suggestions.isLoading) {
    return <Loading when rows={4} />;
  }

  const data = suggestions.data?.data;
  const chosen = (data?.placements ?? []).filter((placement) => !skipped.has(placement.student.studentId));
  const allChosen = data !== undefined && chosen.length === data.placements.length;

  function toggle(studentId: string, checked: boolean) {
    const next = new Set(skipped);
    if (checked) {
      next.delete(studentId);
    } else {
      next.add(studentId);
    }

    setSkipped(next);
  }

  return (
    <Section
      title="Bước 1: xếp sinh viên chưa có phòng"
      description="Hệ thống gợi ý phòng cho từng người theo ngành phòng còn thiếu. Bỏ chọn người bạn muốn xếp tay."
      actions={
        data && data.placements.length > 0 ? (
          <Button
            disabled={chosen.length === 0 || place.isPending}
            onClick={() => place.mutate(chosen.map((placement) => ({ studentId: placement.student.studentId, roomId: placement.roomId })))}
          >
            Áp dụng {chosen.length} gợi ý
          </Button>
        ) : undefined
      }
    >
      <div className="space-y-5">
        <ErrorNote error={suggestions.error} />
        {data && !data.ranked && <Notice tone="warn">Dịch vụ gợi ý chưa trả lời, hãy xếp tay bên dưới.</Notice>}
        {data && data.placements.length === 0 && data.unplaced.length === 0 && <Notice tone="good">Mọi sinh viên đã có phòng.</Notice>}
        {data && data.placements.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    aria-label="Chọn tất cả"
                    checked={allChosen}
                    indeterminate={!allChosen && chosen.length > 0}
                    onCheckedChange={(checked) => setSkipped(checked ? new Set() : new Set(data.placements.map((placement) => placement.student.studentId)))}
                  />
                </TableHead>
                <TableHead>Sinh viên</TableHead>
                <TableHead>Ngành</TableHead>
                <TableHead>Phòng gợi ý</TableHead>
                <TableHead>Lý do</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.placements.map((placement) => {
                const checked = !skipped.has(placement.student.studentId);
                return (
                  <TableRow key={placement.student.studentId} data-state={checked ? "selected" : undefined}>
                    <TableCell>
                      <Checkbox aria-label={`Chọn ${placement.student.fullName}`} checked={checked} onCheckedChange={(next) => toggle(placement.student.studentId, next === true)} />
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{placement.student.fullName}</span>
                      <span className="block text-xs text-muted-foreground">{placement.student.studentCode}</span>
                    </TableCell>
                    <TableCell>{placement.student.majorCode}</TableCell>
                    <TableCell className="font-medium">{placement.roomName}</TableCell>
                    <TableCell className="text-xs whitespace-normal text-muted-foreground">
                      {placement.reasons.map((reason) => suggestionReasonText(reason.code, reason.detail)).join(". ") || "Còn chỗ hợp lệ"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
        {data && data.unplaced.length > 0 && (
          <form
            className="space-y-3 rounded-lg border border-dashed p-4"
            onSubmit={(event) => {
              event.preventDefault();
              place.mutate([manual]);
            }}
          >
            <p className="text-sm font-medium">Xếp tay</p>
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <Field label="Sinh viên">
                <NativeSelect required value={manual.studentId} onChange={(event) => setManual({ ...manual, studentId: event.target.value })}>
                  <option value="">Chọn sinh viên chưa có phòng</option>
                  {data.unplaced.map((student) => (
                    <option key={student.studentId} value={student.studentId}>
                      {student.fullName}, {student.studentCode} ({student.majorCode})
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="Phòng">
                <NativeSelect required value={manual.roomId} onChange={(event) => setManual({ ...manual, roomId: event.target.value })}>
                  <option value="">Chọn phòng còn chỗ</option>
                  {data.rooms.map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.name} ({room.memberCount}/{room.capacity})
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Button type="submit" variant="outline" className="h-9" disabled={place.isPending}>
                Xếp vào phòng
              </Button>
            </div>
          </form>
        )}
      </div>
    </Section>
  );
}

export function FinalizeSection({ course }: { course: Course }) {
  const { api } = useAuth();
  const { confirm } = useDialogs();
  const queryClient = useQueryClient();
  const [acceptExceptions, setAcceptExceptions] = useState(false);
  const overview = useQuery({ queryKey: ["overview", course.id], queryFn: () => api.get<CourseOverview>(`/api/v1/courses/${course.id}/overview`) });
  const finalize = useMutation({
    mutationFn: () => api.post<{ groups: number; deletedRooms: number }>(`/api/v1/courses/${course.id}/finalize`, { acceptExceptions }),
    onSuccess: async (result) => {
      toast.success(`Đã chốt ${result.data.groups} nhóm, xóa ${result.data.deletedRooms} phòng trống`);
      await Promise.all([["course", course.id], ["overview", course.id], ["rooms", course.id], ["courses"]].map((queryKey) => queryClient.invalidateQueries({ queryKey })));
    },
    onError: (error) => toast.error(errorText(error)),
  });

  const data = overview.data?.data;
  const exceptions = data?.ineligibleRooms.length ?? 0;
  const unplaced = data?.unplaced.length ?? 0;
  const ready = data !== undefined && unplaced === 0 && (exceptions === 0 || acceptExceptions);
  const checks = [
    { ok: unplaced === 0, text: unplaced === 0 ? "Mọi sinh viên đã có phòng" : `Còn ${unplaced} sinh viên chưa có phòng` },
    {
      ok: exceptions === 0 || acceptExceptions,
      text: exceptions === 0 ? "Mọi phòng có người đều đủ điều kiện" : `${exceptions} phòng chưa đủ người hoặc chưa đủ ngành`,
    },
  ];

  return (
    <Section title="Bước 2: chốt nhóm" description="Phòng trống bị xóa, các phòng còn lại được đánh số nhóm từ 1 và không thay đổi được nữa.">
      <div className="space-y-4">
        <ErrorNote error={overview.error} />
        <ul className="grid gap-2 text-sm">
          {checks.map((check) => (
            <li key={check.text} className={cn("flex items-center gap-2", !check.ok && "text-deadline-ink")}>
              {check.ok ? <CircleCheck className="size-4 text-success" aria-hidden /> : <CircleDashed className="size-4" aria-hidden />}
              {check.text}
            </li>
          ))}
        </ul>
        {exceptions > 0 && (
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-deadline/30 bg-deadline-soft p-3 text-sm text-deadline-ink">
            <Checkbox className="mt-0.5" checked={acceptExceptions} onCheckedChange={(checked) => setAcceptExceptions(checked === true)} />
            <span>Chấp nhận ngoại lệ: {exceptions} phòng chưa đủ điều kiện vẫn thành nhóm chính thức.</span>
          </label>
        )}
        <div className="flex justify-end">
          <Button
            disabled={finalize.isPending || !ready}
            onClick={async () => {
              if (
                await confirm({
                  title: "Chốt danh sách nhóm chính thức?",
                  description: "Không hoàn tác được. Sinh viên và giảng viên sẽ nhận thông báo kèm số nhóm.",
                  confirmLabel: "Chốt nhóm",
                  destructive: true,
                })
              ) {
                finalize.mutate();
              }
            }}
          >
            <Lock />
            Chốt nhóm
          </Button>
        </div>
      </div>
    </Section>
  );
}
