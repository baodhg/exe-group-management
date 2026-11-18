import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Award, CalendarClock, Check, Flag, Gauge, PackageCheck, PencilLine, Plus, Send, TriangleAlert, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "../../shared/auth/useAuth";
import { errorText, formatDate } from "../common/messages";
import type { Deliverable, DeliverableStatus, Milestone, ProjectBoard } from "../common/types";
import { Badge, EmptyState, Failure, Field, Loading, Notice, Section, StatTile, SummaryCard, type Tone } from "../common/ui";

const nameLimit = 100;
const descriptionLimit = 500;
const notesLimit = 1000;
const noteLimit = 500;

const deliverableLooks: Record<DeliverableStatus, { tone: Tone; label: string }> = {
  NotStarted: { tone: "neutral", label: "Chưa bắt đầu" },
  InProgress: { tone: "info", label: "Đang làm" },
  Submitted: { tone: "warn", label: "Đã nộp, chờ chấm" },
  Approved: { tone: "good", label: "Đã duyệt" },
  ChangesRequested: { tone: "bad", label: "Cần sửa lại" },
};

function useProjectBoard(courseId: string, enabled = true) {
  const { api } = useAuth();
  return useQuery({
    queryKey: ["projectBoard", courseId],
    queryFn: () => api.get<ProjectBoard>(`/api/v1/courses/${courseId}/projects/board`),
    enabled,
  });
}

export function ProjectBoardPanel({ courseId, canManage, canReview, roomId }: { courseId: string; canManage: boolean; canReview: boolean; roomId?: string }) {
  const { api } = useAuth();
  const queryClient = useQueryClient();
  const board = useProjectBoard(courseId);
  const data = board.data?.data;

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["projectBoard", courseId] });
  };

  const createMilestone = useMutation({
    mutationFn: (body: { name: string; description?: string; dueAt?: string; weight: number }) => api.post<Milestone>(`/api/v1/courses/${courseId}/projects/milestones`, body),
    onSuccess: async () => {
      toast.success("Đã tạo mốc đồ án");
      await refresh();
    },
    onError: async (error) => {
      toast.error(errorText(error));
      await refresh();
    },
  });

  const submit = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) => api.post<Deliverable>(`/api/v1/courses/${courseId}/projects/deliverables/${id}/submit`, { notes }),
    onSuccess: async () => {
      toast.success("Đã nộp sản phẩm");
      await refresh();
    },
    onError: async (error) => {
      toast.error(errorText(error));
      await refresh();
    },
  });

  const review = useMutation({
    mutationFn: ({ id, decision, note, score }: { id: string; decision: string; note?: string; score?: number }) => api.post<Deliverable>(`/api/v1/courses/${courseId}/projects/deliverables/${id}/review`, { decision, note, score }),
    onSuccess: async () => {
      toast.success("Đã chấm sản phẩm");
      await refresh();
    },
    onError: async (error) => {
      toast.error(errorText(error));
      await refresh();
    },
  });

  const [adding, setAdding] = useState(false);

  return (
    <div className="space-y-5">
      <Loading when={board.isLoading} rows={4} />
      {board.isError && <Failure error={board.error} title="Không tải được bảng tiến độ đồ án" onRetry={() => void board.refetch()} />}
      {data && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile icon={Gauge} label="Tiến độ chung" value={`${data.overallPercent}%`} progress={{ value: data.overallPercent, max: 100 }} hint={`${data.milestones.length} mốc đồ án`} />
            <StatTile icon={Flag} label="Mốc đồ án" value={data.milestones.length} hint={`${data.milestones.filter((item) => item.dueAt).length} mốc có hạn`} />
            <StatTile icon={PackageCheck} label="Sản phẩm đã nộp" value={data.deliverables.filter((item) => item.status === "Submitted" || item.status === "Approved").length} hint={`${data.deliverables.length} sản phẩm được mở`} />
            <StatTile icon={Award} label="Sản phẩm đã duyệt" value={data.deliverables.filter((item) => item.status === "Approved").length} hint={`${data.groups.length} nhóm chính thức`} />
          </div>

          {canManage && (
            <Section
              title="Mốc đồ án"
              icon={CalendarClock}
              description="Mỗi nhóm chính thức nhận một sản phẩm cho mỗi mốc. Giảng viên của lớp và giáo vụ đều có thể mở mốc."
              actions={
                <Button size="sm" variant="outline" onClick={() => setAdding((value) => !value)}>
                  <Plus aria-hidden />
                  Thêm mốc
                </Button>
              }
            >
              {adding && <MilestoneForm pending={createMilestone.isPending} onCancel={() => setAdding(false)} onSubmit={(body) => createMilestone.mutate(body, { onSuccess: () => setAdding(false) })} />}
              {data.milestones.length === 0 && !adding && <EmptyState icon={CalendarClock} title="Chưa có mốc đồ án nào." description="Thêm mốc đầu tiên để các nhóm bắt đầu nộp sản phẩm." />}
              {data.milestones.length > 0 && (
                <ul className="flex list-none flex-col gap-2">
                  {data.milestones.map((milestone) => (
                    <li key={milestone.id} className="flex flex-col gap-1.5 rounded-xl border bg-muted/40 p-3 text-[13px]">
                      <div className="flex flex-wrap items-center gap-2">
                        <strong className="text-sm">{milestone.sequence}. {milestone.name}</strong>
                        <Badge tone="info" icon={Gauge}>
                          {milestone.progressPercent}%
                        </Badge>
                        <Badge icon={PackageCheck}>
                          {milestone.submittedCount}/{milestone.groupCount} đã nộp
                        </Badge>
                        {milestone.dueAt && <Badge icon={CalendarClock}>Hạn {formatDate(milestone.dueAt)}</Badge>}
                        <Badge>Trọng số {milestone.weight}</Badge>
                      </div>
                      {milestone.description && <p className="text-muted-foreground">{milestone.description}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          )}

          <Section flush title="Tiến độ từng nhóm" icon={Award}>
            {data.groups.length === 0 && <EmptyState icon={Award} title="Lớp chưa có nhóm chính thức." description="Bảng này có dữ liệu sau khi lớp chốt nhóm." />}
            {data.groups.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nhóm</TableHead>
                    <TableHead>Đề tài</TableHead>
                    <TableHead>Tiến độ</TableHead>
                    <TableHead>Điểm trung bình</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.groups.map((group) => (
                    <TableRow key={group.roomId}>
                      <TableCell className="whitespace-nowrap">
                        {group.groupNo !== null ? `Nhóm ${group.groupNo}` : group.roomName}
                      </TableCell>
                      <TableCell className="max-w-64 truncate">
                        {group.topic ?? (
                          <span className="inline-flex items-center gap-1.5 font-semibold text-warning-ink">
                            <TriangleAlert aria-hidden className="size-3.5 shrink-0" />
                            Chưa có đề tài
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <progress value={group.progressPercent} max={100} className="w-24" aria-label={`Tiến độ ${group.progressPercent}%`} />
                          <span className="tabular text-xs">{group.progressPercent}%</span>
                        </div>
                      </TableCell>
                      <TableCell className="tabular">{group.averageScore ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Section>

          <Section flush title="Sản phẩm của các nhóm" icon={PackageCheck} description={roomId ? "Chỉ hiện sản phẩm của nhóm bạn." : undefined}>
            {data.deliverables.length === 0 && <EmptyState icon={PackageCheck} title="Chưa có sản phẩm nào." description="Sản phẩm mở ra khi giảng viên của lớp hoặc giáo vụ tạo mốc đồ án." />}
            {data.deliverables.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nhóm</TableHead>
                    <TableHead>Mốc</TableHead>
                    <TableHead>Sản phẩm</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead>Điểm</TableHead>
                    <TableHead>Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.deliverables
                    .filter((item) => (roomId ? item.roomId === roomId : true))
                    .map((deliverable) => {
                      const milestone = data.milestones.find((item) => item.id === deliverable.milestoneId);
                      return (
                        <DeliverableRow
                          key={deliverable.id}
                          deliverable={deliverable}
                          milestoneName={milestone?.name ?? ""}
                          canSubmit={roomId === deliverable.roomId}
                          canReview={canReview}
                          pending={submit.isPending || review.isPending}
                          onSubmit={(notes) => submit.mutate({ id: deliverable.id, notes })}
                          onReview={(decision, note, score) => review.mutate({ id: deliverable.id, decision, note, score })}
                        />
                      );
                    })}
                </TableBody>
              </Table>
            )}
          </Section>
        </>
      )}
    </div>
  );
}

function MilestoneForm({ pending, onSubmit, onCancel }: { pending: boolean; onSubmit: (body: { name: string; description?: string; dueAt?: string; weight: number }) => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [weight, setWeight] = useState("1");
  return (
    <form
      className="flex flex-col gap-3 rounded-xl border bg-muted/40 p-3"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({ name: name.trim(), description: description.trim() || undefined, dueAt: dueAt ? new Date(dueAt).toISOString() : undefined, weight: Number(weight) || 1 });
      }}
    >
      <Field label="Tên mốc" counter={{ value: name.length, max: nameLimit }}>
        <Input maxLength={nameLimit} placeholder="Ví dụ: Prototype" value={name} onChange={(event) => setName(event.target.value)} />
      </Field>
      <Field label="Mô tả (không bắt buộc)" counter={{ value: description.length, max: descriptionLimit }}>
        <Textarea maxLength={descriptionLimit} className="font-normal" value={description} onChange={(event) => setDescription(event.target.value)} />
      </Field>
      <div className="flex flex-wrap gap-3">
        <Field label="Hạn nộp" className="flex-1">
          <Input type="date" value={dueAt} onChange={(event) => setDueAt(event.target.value)} />
        </Field>
        <Field label="Trọng số" className="w-28">
          <Input type="number" min={1} max={100} value={weight} onChange={(event) => setWeight(event.target.value)} />
        </Field>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Huỷ
        </Button>
        <Button type="submit" pending={pending} disabled={name.trim().length === 0}>
          <Plus aria-hidden />
          Tạo mốc
        </Button>
      </div>
    </form>
  );
}

function DeliverableRow({
  deliverable,
  milestoneName,
  canSubmit,
  canReview,
  pending,
  onSubmit,
  onReview,
}: {
  deliverable: Deliverable;
  milestoneName: string;
  canSubmit: boolean;
  canReview: boolean;
  pending: boolean;
  onSubmit: (notes?: string) => void;
  onReview: (decision: string, note?: string, score?: number) => void;
}) {
  const [notes, setNotes] = useState("");
  const [note, setNote] = useState("");
  const [score, setScore] = useState("");
  const look = deliverableLooks[deliverable.status];
  return (
    <TableRow>
      <TableCell className="whitespace-nowrap">{deliverable.groupNo !== null ? `Nhóm ${deliverable.groupNo}` : deliverable.roomName}</TableCell>
      <TableCell className="whitespace-nowrap">{milestoneName}</TableCell>
      <TableCell>
        <span className="block font-semibold">{deliverable.title}</span>
        {deliverable.notes && <span className="block text-xs text-muted-foreground">{deliverable.notes}</span>}
        {deliverable.reviewNote && <span className="block text-xs text-muted-foreground">Góp ý: {deliverable.reviewNote}</span>}
      </TableCell>
      <TableCell>
        <Badge tone={look.tone} icon={deliverable.status === "Approved" ? Check : deliverable.status === "ChangesRequested" ? TriangleAlert : deliverable.status === "Submitted" ? Send : PencilLine}>
          {look.label}
        </Badge>
      </TableCell>
      <TableCell className="tabular">{deliverable.score ?? "—"}</TableCell>
      <TableCell>
        {canSubmit && deliverable.status !== "Approved" && (
          <div className="flex min-w-56 flex-col gap-2">
            <Field label="Ghi chú nộp bài">
              <Textarea maxLength={notesLimit} className="font-normal" value={notes} onChange={(event) => setNotes(event.target.value)} />
            </Field>
            <Button size="sm" pending={pending} onClick={() => onSubmit(notes.trim() || undefined)}>
              <Send aria-hidden />
              Nộp
            </Button>
          </div>
        )}
        {canReview && deliverable.status === "Submitted" && (
          <div className="flex min-w-56 flex-col gap-2">
            <Field label="Nhận xét">
              <Input maxLength={noteLimit} value={note} onChange={(event) => setNote(event.target.value)} />
            </Field>
            <Field label="Điểm (0-10)">
              <Input type="number" min={0} max={10} step={0.5} value={score} onChange={(event) => setScore(event.target.value)} />
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" pending={pending} onClick={() => onReview("Approved", note.trim() || undefined, score ? Number(score) : undefined)}>
                <Check aria-hidden />
                Duyệt
              </Button>
              <Button size="sm" variant="destructive" disabled={pending} onClick={() => onReview("ChangesRequested", note.trim() || undefined)}>
                <X aria-hidden />
                Yêu cầu sửa
              </Button>
            </div>
          </div>
        )}
        {!canSubmit && !canReview && <span className="text-xs text-muted-foreground">—</span>}
      </TableCell>
    </TableRow>
  );
}

export function ProjectSummaryCard({ board }: { board: ProjectBoard | undefined }) {
  if (!board) {
    return null;
  }

  return (
    <SummaryCard icon={Gauge} label="Tiến độ đồ án" value={`${board.overallPercent}%`}>
      <progress value={board.overallPercent} max={100} aria-label="Tiến độ đồ án chung" />
      <span className="text-xs text-muted-foreground">
        {board.milestones.length} mốc · {board.deliverables.filter((item) => item.status === "Submitted" || item.status === "Approved").length}/{board.deliverables.length} sản phẩm đã nộp
      </span>
    </SummaryCard>
  );
}

export function ProjectNotice({ board }: { board: ProjectBoard | undefined }) {
  if (!board || board.milestones.length === 0) {
    return null;
  }

  const missing = board.deliverables.filter((item) => item.status === "NotStarted").length;
  return missing > 0 ? <Notice tone="info">{board.groups.length} nhóm chính thức chưa bắt đầu {missing} sản phẩm.</Notice> : null;
}
