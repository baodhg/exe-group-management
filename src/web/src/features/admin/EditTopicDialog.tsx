import { useMutation } from "@tanstack/react-query";
import { Pencil, Save } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAuth } from "../../shared/auth/useAuth";
import { errorText } from "../common/messages";
import type { RoomSummary } from "../common/types";
import { Field } from "../common/ui";
import { topicLimit } from "../rooms/leader";

export function EditTopicDialog({
  room,
  onClose,
  onSaved,
}: {
  room: Pick<RoomSummary, "id" | "name" | "topic">;
  onClose: () => void;
  onSaved: () => Promise<unknown>;
}) {
  const { api } = useAuth();
  const [topic, setTopic] = useState(room.topic ?? "");
  const trimmed = topic.trim();
  const unchanged = trimmed === (room.topic ?? "");

  const save = useMutation({
    mutationFn: () => api.put(`/api/v1/rooms/${room.id}`, { topic: trimmed }),
    onSuccess: async () => {
      toast.success(trimmed.length === 0 ? `Đã xoá đề tài của ${room.name}` : `Đã lưu đề tài của ${room.name}`);
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
            Sửa đề tài của {room.name}
          </DialogTitle>
        </DialogHeader>
        <Field label="Đề tài" counter={{ value: trimmed.length, max: topicLimit }} hint="Giáo vụ sửa trực tiếp, không qua vòng duyệt của giảng viên.">
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
          <Button pending={save.isPending} disabled={unchanged} onClick={() => save.mutate()}>
            {!save.isPending && <Save aria-hidden />}
            Lưu đề tài
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
