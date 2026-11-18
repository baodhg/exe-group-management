import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Clock, FileCheck2, MessageSquareWarning, RotateCcw, Send, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "../../shared/auth/useAuth";
import { errorText, formatRelative } from "../common/messages";
import type { TopicProposal, TopicProposalStatus } from "../common/types";
import { Badge, EmptyState, Failure, Field, Loading, Notice, Section, type Tone } from "../common/ui";

const topicLimit = 200;
const descriptionLimit = 1000;
const noteLimit = 500;

const statusLooks: Record<TopicProposalStatus, { tone: Tone; label: string }> = {
  Pending: { tone: "warn", label: "Đang chờ duyệt" },
  Approved: { tone: "good", label: "Đã duyệt" },
  Rejected: { tone: "bad", label: "Bị từ chối" },
  NeedsRevision: { tone: "info", label: "Cần sửa lại" },
};

function useTopicProposals(roomId: string, enabled = true) {
  const { api } = useAuth();
  return useQuery({
    queryKey: ["topicProposals", "room", roomId],
    queryFn: () => api.get<TopicProposal[]>("/api/v1/topic-proposals", { roomId, sort: "-round", pageSize: 50 }),
    enabled,
  });
}

export function TopicProposalPanel({ roomId, canPropose, canReview, onChanged }: { roomId: string; canPropose: boolean; canReview: boolean; onChanged?: () => void }) {
  const { api } = useAuth();
  const queryClient = useQueryClient();
  const proposals = useTopicProposals(roomId);
  const rows = proposals.data?.data ?? [];
  const [topic, setTopic] = useState("");
  const [description, setDescription] = useState("");

  const refresh = async () => {
    await Promise.all([queryClient.invalidateQueries({ queryKey: ["topicProposals"] }), onChanged?.()]);
  };

  const propose = useMutation({
    mutationFn: () => api.post<TopicProposal>(`/api/v1/topic-proposals?roomId=${roomId}`, { topic: topic.trim(), description: description.trim() || undefined }),
    onSuccess: async () => {
      toast.success("Đã gửi đề tài để duyệt");
      setTopic("");
      setDescription("");
      await refresh();
    },
    onError: async (error) => {
      toast.error(errorText(error));
      await refresh();
    },
  });

  const review = useMutation({
    mutationFn: ({ id, decision, note }: { id: string; decision: string; note?: string }) => api.post<TopicProposal>(`/api/v1/topic-proposals/${id}/review`, { decision, note }),
    onSuccess: async (result) => {
      toast.success(result.data.status === "Approved" ? "Đã duyệt đề tài" : result.data.status === "Rejected" ? "Đã từ chối đề tài" : "Đã yêu cầu sửa đề tài");
      await refresh();
    },
    onError: async (error) => {
      toast.error(errorText(error));
      await refresh();
    },
  });

  const pending = rows.find((row) => row.status === "Pending") ?? null;

  return (
    <Section title="Duyệt đề tài" icon={FileCheck2} description="Trưởng nhóm đề xuất đề tài, giảng viên hoặc giáo vụ duyệt trước khi đề tài được chốt.">
      {canPropose && (
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            propose.mutate();
          }}
        >
          <Field label="Đề tài đề xuất" counter={{ value: topic.length, max: topicLimit }}>
            <Input maxLength={topicLimit} placeholder="Nhóm định làm gì?" value={topic} onChange={(event) => setTopic(event.target.value)} />
          </Field>
          <Field label="Mô tả (không bắt buộc)" counter={{ value: description.length, max: descriptionLimit }}>
            <Textarea maxLength={descriptionLimit} className="font-normal" placeholder="Vì sao nhóm chọn đề tài này?" value={description} onChange={(event) => setDescription(event.target.value)} />
          </Field>
          <div className="flex justify-end">
            <Button type="submit" pending={propose.isPending} disabled={topic.trim().length === 0 || pending !== null}>
              {!propose.isPending && <Send aria-hidden />}
              Gửi duyệt
            </Button>
          </div>
          <Notice tone="info" icon={Clock}>
            Gửi được khi lớp đang mở chọn phòng. Khi giáo vụ chốt nhóm, đề tài trở thành chính thức và không đề xuất thêm được.
          </Notice>
          {pending !== null && <Notice tone="info">Đề tài vòng {pending.round} đang chờ duyệt.</Notice>}
        </form>
      )}

      <Loading when={proposals.isLoading} rows={2} />
      {proposals.isError && <Failure error={proposals.error} title="Không tải được đề tài đề xuất" onRetry={() => void proposals.refetch()} />}
      {proposals.isSuccess && rows.length === 0 && <EmptyState icon={FileCheck2} title="Chưa có đề tài nào được đề xuất." description="Trưởng nhóm gửi đề tài lên đây để giảng viên duyệt." />}
      {rows.length > 0 && (
        <ul className="flex list-none flex-col gap-2">
          {rows.map((row) => (
            <ProposalRow key={row.id} proposal={row} canReview={canReview} pending={review.isPending} onReview={(decision, note) => review.mutate({ id: row.id, decision, note })} />
          ))}
        </ul>
      )}
    </Section>
  );
}

function ProposalRow({ proposal, canReview, pending, onReview }: { proposal: TopicProposal; canReview: boolean; pending: boolean; onReview: (decision: string, note?: string) => void }) {
  const [note, setNote] = useState("");
  const look = statusLooks[proposal.status];
  return (
    <li className="flex flex-col gap-2 rounded-xl border bg-muted/40 p-3 text-[13px]">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={look.tone} icon={proposal.status === "Pending" ? Clock : proposal.status === "Approved" ? Check : proposal.status === "Rejected" ? X : RotateCcw}>
          {look.label}
        </Badge>
        <span className="text-xs text-muted-foreground">Vòng {proposal.round}</span>
        <span className="text-xs text-muted-foreground">{formatRelative(proposal.createdAt)}</span>
      </div>
      <strong className="text-sm">{proposal.proposedTopic}</strong>
      {proposal.description && <p className="wrap-anywhere text-muted-foreground">{proposal.description}</p>}
      {proposal.reviewNote && (
        <p className="wrap-anywhere text-muted-foreground">
          <MessageSquareWarning className="mr-1 inline size-3.5" aria-hidden />
          {proposal.reviewNote}
        </p>
      )}
      {canReview && proposal.status === "Pending" && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <Field label="Nhận xét (không bắt buộc)" className="flex-1">
            <Input maxLength={noteLimit} placeholder="Góp ý cho nhóm" value={note} onChange={(event) => setNote(event.target.value)} />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" pending={pending} onClick={() => onReview("Approved", note.trim() || undefined)}>
              <Check aria-hidden />
              Duyệt
            </Button>
            <Button size="sm" variant="secondary" disabled={pending} onClick={() => onReview("NeedsRevision", note.trim() || undefined)}>
              <RotateCcw aria-hidden />
              Cần sửa
            </Button>
            <Button size="sm" variant="destructive" disabled={pending} onClick={() => onReview("Rejected", note.trim() || undefined)}>
              <X aria-hidden />
              Từ chối
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}
