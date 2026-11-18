import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Clock, FileCheck2, RotateCcw, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "../../shared/auth/useAuth";
import { errorText, formatRelative } from "../common/messages";
import type { TopicProposal, TopicProposalStatus } from "../common/types";
import { Badge, EmptyState, Failure, Field, Loading, Section, type Tone } from "../common/ui";

const noteLimit = 500;

const statusLooks: Record<TopicProposalStatus, { tone: Tone; label: string }> = {
  Pending: { tone: "warn", label: "Đang chờ duyệt" },
  Approved: { tone: "good", label: "Đã duyệt" },
  Rejected: { tone: "bad", label: "Bị từ chối" },
  NeedsRevision: { tone: "info", label: "Cần sửa lại" },
};

export function TopicReviewPanel({ courseId }: { courseId: string }) {
  const { api } = useAuth();
  const queryClient = useQueryClient();
  const proposals = useQuery({
    queryKey: ["topicProposals", "course", courseId],
    queryFn: () => api.get<TopicProposal[]>("/api/v1/topic-proposals", { courseId, sort: "-createdAt", pageSize: 100 }),
  });
  const rows = proposals.data?.data ?? [];

  const review = useMutation({
    mutationFn: ({ id, decision, note }: { id: string; decision: string; note?: string }) => api.post<TopicProposal>(`/api/v1/topic-proposals/${id}/review`, { decision, note }),
    onSuccess: async (result) => {
      toast.success(result.data.status === "Approved" ? "Đã duyệt đề tài" : result.data.status === "Rejected" ? "Đã từ chối đề tài" : "Đã yêu cầu sửa đề tài");
      await queryClient.invalidateQueries({ queryKey: ["topicProposals"] });
    },
    onError: async (error) => {
      toast.error(errorText(error));
      await queryClient.invalidateQueries({ queryKey: ["topicProposals"] });
    },
  });

  return (
    <Section flush title="Duyệt đề tài" icon={FileCheck2} description="Đề tài các nhóm gửi lên trong lớp của bạn.">
      <Loading when={proposals.isLoading} rows={3} />
      {proposals.isError && <Failure error={proposals.error} title="Không tải được đề tài đề xuất" onRetry={() => void proposals.refetch()} />}
      {proposals.isSuccess && rows.length === 0 && <EmptyState icon={FileCheck2} title="Chưa có nhóm nào gửi đề tài." description="Khi trưởng nhóm gửi đề tài, nó sẽ hiện ở đây để bạn duyệt." />}
      {rows.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nhóm</TableHead>
              <TableHead>Đề tài</TableHead>
              <TableHead>Vòng</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead>Thời gian</TableHead>
              <TableHead>Quyết định</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <ProposalRow key={row.id} proposal={row} pending={review.isPending} onReview={(decision, note) => review.mutate({ id: row.id, decision, note })} />
            ))}
          </TableBody>
        </Table>
      )}
    </Section>
  );
}

function ProposalRow({ proposal, pending, onReview }: { proposal: TopicProposal; pending: boolean; onReview: (decision: string, note?: string) => void }) {
  const [note, setNote] = useState("");
  const look = statusLooks[proposal.status];
  return (
    <TableRow>
      <TableCell className="whitespace-nowrap">{proposal.roomName}</TableCell>
      <TableCell>
        <span className="block font-semibold">{proposal.proposedTopic}</span>
        {proposal.description && <span className="block text-xs text-muted-foreground">{proposal.description}</span>}
        {proposal.reviewNote && <span className="block text-xs text-muted-foreground">Góp ý: {proposal.reviewNote}</span>}
      </TableCell>
      <TableCell className="tabular whitespace-nowrap">{proposal.round}</TableCell>
      <TableCell>
        <Badge tone={look.tone} icon={proposal.status === "Pending" ? Clock : proposal.status === "Approved" ? Check : proposal.status === "Rejected" ? X : RotateCcw}>
          {look.label}
        </Badge>
      </TableCell>
      <TableCell className="tabular whitespace-nowrap">{formatRelative(proposal.createdAt)}</TableCell>
      <TableCell>
        {proposal.status === "Pending" ? (
          <div className="flex min-w-56 flex-col gap-2">
            <Field label="Nhận xét">
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
        ) : (
          <span className="text-xs text-muted-foreground">Đã xử lý</span>
        )}
      </TableCell>
    </TableRow>
  );
}
