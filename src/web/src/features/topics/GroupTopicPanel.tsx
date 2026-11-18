import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, Pencil, Save, Trash2, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAuth } from "../../shared/auth/useAuth";
import { errorText } from "../common/messages";
import type { OfficialGroup } from "../common/types";
import { Field, Section } from "../common/ui";
import { topicLimit } from "../rooms/leader";

function SetTopicDialog({
  courseId,
  group,
  onClose,
  onSaved,
}: {
  courseId: string;
  group: OfficialGroup;
  onClose: () => void;
  onSaved: () => Promise<unknown>;
}) {
  const { api } = useAuth();
  const [topic, setTopic] = useState(group.topic ?? "");
  const trimmed = topic.trim();
  const unchanged = trimmed === (group.topic ?? "");

  const save = useMutation({
    mutationFn: () => api.put<OfficialGroup>(`/api/v1/courses/${courseId}/groups/${group.roomId}/topic`, { topic: trimmed }),
    onSuccess: async () => {
      toast.success(`Đã đặt đề tài cho Nhóm ${group.groupNo}`);
      onClose();
      await onSaved();
    },
    onError: (error) => {
      toast.error(errorText(error));
    },
  });

  return (
    <Dialog open onOpenChange={(open) => !open && !save.isPending && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <Pencil aria-hidden />
            Đặt đề tài cho Nhóm {group.groupNo}: {group.roomName}
          </DialogTitle>
        </DialogHeader>
        <Field label="Đề tài" counter={{ value: trimmed.length, max: topicLimit }} hint="Ghi thẳng vào nhóm, không qua vòng duyệt của giảng viên.">
          <Input
            maxLength={topicLimit}
            autoFocus
            placeholder="Nhóm định làm gì?"
            value={topic}
            onChange={(event) => {
              setTopic(event.target.value);
              save.reset();
            }}
          />
        </Field>
        <DialogFooter>
          <Button variant="ghost" disabled={save.isPending} onClick={onClose}>
            Huỷ
          </Button>
          <Button pending={save.isPending} disabled={unchanged || trimmed.length === 0} onClick={() => save.mutate()}>
            {!save.isPending && <Save aria-hidden />}
            Lưu đề tài
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ClearTopicDialog({
  courseId,
  group,
  onClose,
  onSaved,
}: {
  courseId: string;
  group: OfficialGroup;
  onClose: () => void;
  onSaved: () => Promise<unknown>;
}) {
  const { api } = useAuth();
  const queryClient = useQueryClient();

  const clear = useMutation({
    mutationFn: () => api.delete(`/api/v1/courses/${courseId}/groups/${group.roomId}/topic`),
    onSuccess: async () => {
      toast.success(`Đã xoá đề tài của Nhóm ${group.groupNo}`);
      onClose();
      await Promise.all([queryClient.invalidateQueries({ queryKey: ["officialGroups"] }), onSaved()]);
    },
    onError: (error) => {
      toast.error(errorText(error));
    },
  });

  return (
    <Dialog open onOpenChange={(open) => !open && !clear.isPending && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <Trash2 aria-hidden />
            Xoá đề tài của Nhóm {group.groupNo}?
          </DialogTitle>
        </DialogHeader>
        <p className="text-[13px] text-muted-foreground">
          Đề tài &quot;{group.topic}&quot; sẽ bị xoá để nhóm có thể đặt lại. Việc này không thể hoàn tác.
        </p>
        <DialogFooter>
          <Button variant="ghost" disabled={clear.isPending} onClick={onClose}>
            Huỷ
          </Button>
          <Button variant="destructive" pending={clear.isPending} onClick={() => clear.mutate()}>
            {!clear.isPending && <Trash2 aria-hidden />}
            Xoá đề tài
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AskLeaderDialog({
  courseId,
  group,
  onClose,
  onDone,
}: {
  courseId: string;
  group: OfficialGroup;
  onClose: () => void;
  onDone: () => Promise<unknown>;
}) {
  const { api } = useAuth();
  const queryClient = useQueryClient();

  const ask = useMutation({
    mutationFn: () => api.post(`/api/v1/courses/${courseId}/groups/${group.roomId}/topic-request`, {}),
    onSuccess: async () => {
      toast.success(`Đã nhắc trưởng nhóm ${group.roomName} bổ sung đề tài`);
      onClose();
      await Promise.all([queryClient.invalidateQueries({ queryKey: ["missingTopics"] }), onDone()]);
    },
    onError: (error) => {
      toast.error(errorText(error));
    },
  });

  return (
    <Dialog open onOpenChange={(open) => !open && !ask.isPending && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nhắc nhóm bổ sung đề tài?</DialogTitle>
        </DialogHeader>
        <p className="text-[13px] text-muted-foreground">
          Trưởng nhóm {group.roomName} sẽ nhận thông báo yêu cầu bổ sung đề tài cho Nhóm {group.groupNo}.
        </p>
        <DialogFooter>
          <Button variant="ghost" disabled={ask.isPending} onClick={onClose}>
            Huỷ
          </Button>
          <Button pending={ask.isPending} onClick={() => ask.mutate()}>
            {!ask.isPending && <Bell aria-hidden />}
            Gửi lời nhắc
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function LeaderTopicCard({
  courseId,
  roomId,
  onChanged,
}: {
  courseId: string;
  roomId: string;
  onChanged: () => Promise<unknown>;
}) {
  const { api } = useAuth();
  const [topic, setTopic] = useState("");

  const save = useMutation({
    mutationFn: () => api.put(`/api/v1/courses/${courseId}/groups/${roomId}/topic/by-leader`, { topic: topic.trim() }),
    onSuccess: async () => {
      toast.success("Đã bổ sung đề tài cho nhóm");
      setTopic("");
      await onChanged();
    },
    onError: (error) => {
      toast.error(errorText(error));
    },
  });

  return (
    <Section title="Bổ sung đề tài cho nhóm" icon={TriangleAlert} description="Lớp đã chốt nhóm nên đề tài phải bổ sung tại đây.">
      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate();
        }}
      >
        <Field label="Đề tài" counter={{ value: topic.trim().length, max: topicLimit }}>
          <Input
            maxLength={topicLimit}
            placeholder="Nhóm định làm gì?"
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
          />
        </Field>
        <div className="flex justify-end">
          <Button type="submit" pending={save.isPending} disabled={topic.trim().length === 0}>
            {!save.isPending && <Save aria-hidden />}
            Gửi đề tài
          </Button>
        </div>
      </form>
    </Section>
  );
}

export function TopicCell({
  courseId,
  group,
  onChanged,
}: {
  courseId: string;
  group: OfficialGroup;
  onChanged: () => Promise<unknown>;
}) {
  const [editing, setEditing] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [asking, setAsking] = useState(false);

  if (!group.topicMissing) {
    return (
      <span className="flex items-center gap-1">
        <span className="block max-w-56 truncate">{group.topic}</span>
        <Button variant="ghost" size="icon-sm" aria-label={`Sửa đề tài của Nhóm ${group.groupNo}`} onClick={() => setEditing(true)}>
          <Pencil />
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label={`Xoá đề tài của Nhóm ${group.groupNo}`} onClick={() => setClearing(true)}>
          <Trash2 />
        </Button>
        {editing && <SetTopicDialog courseId={courseId} group={group} onClose={() => setEditing(false)} onSaved={onChanged} />}
        {clearing && <ClearTopicDialog courseId={courseId} group={group} onClose={() => setClearing(false)} onSaved={onChanged} />}
      </span>
    );
  }

  return (
    <span className="flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-warning-ink">
        <TriangleAlert aria-hidden className="size-3.5 shrink-0" />
        Chưa có đề tài
      </span>
      <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
        <Pencil aria-hidden />
        Đặt đề tài
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setAsking(true)}>
        <Bell aria-hidden />
        Nhắc nhóm
      </Button>
      {editing && <SetTopicDialog courseId={courseId} group={group} onClose={() => setEditing(false)} onSaved={onChanged} />}
      {asking && <AskLeaderDialog courseId={courseId} group={group} onClose={() => setAsking(false)} onDone={onChanged} />}
    </span>
  );
}
