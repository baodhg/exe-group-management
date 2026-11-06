import { Send, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Field, Notice } from "../common/ui";

const messageLimit = 500;

export function ApplyDialog({ roomName, open, pending, error, onClose, onSend }: { roomName: string; open: boolean; pending: boolean; error: string | null; onClose: () => void; onSend: (message: string) => void }) {
  const [message, setMessage] = useState("");
  const over = message.length > messageLimit;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !pending) {
          setMessage("");
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Gửi đơn vào {roomName}</DialogTitle>
          <DialogDescription>Phòng đang khoá, trưởng nhóm sẽ xem đơn và quyết định.</DialogDescription>
        </DialogHeader>
        <Field label="Lời nhắn cho trưởng nhóm (không bắt buộc)" counter={{ value: message.length, max: messageLimit }} error={over ? `Lời nhắn tối đa ${messageLimit} ký tự.` : undefined}>
          <Textarea value={message} rows={4} placeholder="Giới thiệu ngắn về bạn và phần bạn làm được" onChange={(event) => setMessage(event.target.value)} />
        </Field>
        {error && <Notice tone="bad">{error}</Notice>}
        <DialogFooter>
          <Button
            variant="ghost"
            disabled={pending}
            onClick={() => {
              setMessage("");
              onClose();
            }}
          >
            Huỷ
          </Button>
          <Button pending={pending} disabled={over} onClick={() => onSend(message.trim())}>
            {!pending && <Send aria-hidden />}
            {pending ? "Đang gửi" : "Gửi đơn"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function WithdrawDialog({ roomName, open, pending, error, onClose, onConfirm }: { roomName: string; open: boolean; pending: boolean; error: string | null; onClose: () => void; onConfirm: () => void }) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !pending) {
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rút đơn vào {roomName}?</DialogTitle>
          <DialogDescription>Bạn có thể gửi lại đơn sau nếu phòng vẫn còn chỗ.</DialogDescription>
        </DialogHeader>
        {error && <Notice tone="bad">{error}</Notice>}
        <DialogFooter>
          <Button variant="ghost" disabled={pending} onClick={onClose}>
            Huỷ
          </Button>
          <Button variant="destructive" pending={pending} onClick={onConfirm}>
            {!pending && <X aria-hidden />}
            {pending ? "Đang rút đơn" : "Rút đơn"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
