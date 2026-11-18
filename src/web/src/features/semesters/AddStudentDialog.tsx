import { useMutation } from "@tanstack/react-query";
import { UserPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAuth } from "../../shared/auth/useAuth";
import type { CatalogItem } from "../common/types";
import { Criteria, Criterion, Field, Notice } from "../common/ui";
import { MajorTag } from "../rooms/seats";
import { addStudentProblems, emptyAddStudentDraft, passwordProblem, studentCodeMax, studentEmailMax, studentNameMax, type AddStudentDraft } from "./addStudentRules";

export function AddStudentDialog({
  semesterId,
  majors,
  onClose,
  onAdded,
}: {
  semesterId: string;
  majors: readonly CatalogItem[];
  onClose: () => void;
  onAdded: () => Promise<unknown> | void;
}) {
  const { api } = useAuth();
  const [draft, setDraft] = useState<AddStudentDraft>(emptyAddStudentDraft);
  const [password, setPassword] = useState("");
  const problems = addStudentProblems(draft, majors);
  const problemOf = (field: "fullName" | "studentCode" | "email" | "majorId") => problems.find((problem) => problem.field === field)?.text;
  const passwordError = passwordProblem(password);

  const save = useMutation({
    mutationFn: async () => {
      const accounts = await api.post<Array<{ email: string; userId: string; created: boolean }>>("/api/v1/users/import", {
        defaultPassword: password || undefined,
        students: [{ email: draft.email.trim(), fullName: draft.fullName.trim(), userCode: draft.studentCode.trim() }],
      });
      const account = accounts.data[0];
      if (!account) {
        throw new Error("Không nhận được tài khoản vừa tạo.");
      }

      await api.post(`/api/v1/semesters/${semesterId}/students`, {
        students: [
          {
            studentId: account.userId,
            studentCode: draft.studentCode.trim(),
            fullName: draft.fullName.trim(),
            email: draft.email.trim(),
            majorId: draft.majorId,
          },
        ],
      });
      return { created: account.created };
    },
    onSuccess: async (result) => {
      toast.success(result.created ? "Đã thêm sinh viên vào học kỳ" : "Đã cập nhật sinh viên trong học kỳ");
      onClose();
      await onAdded();
    },
  });

  return (
    <Dialog open onOpenChange={(open) => !open && !save.isPending && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Thêm sinh viên vào học kỳ</DialogTitle>
          <DialogDescription>Tài khoản được tạo nếu chưa có, rồi sinh viên được thêm vào học kỳ kèm ngành.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Criteria columns={2}>
            <Criterion label="Tài khoản">Tạo mới hoặc dùng lại theo email</Criterion>
            <Criterion label="Ngành">Bắt buộc, dùng để ghép nhóm</Criterion>
          </Criteria>
          <Field label="Họ tên" error={problemOf("fullName")} counter={{ value: draft.fullName.length, max: studentNameMax }}>
            <Input value={draft.fullName} onChange={(event) => setDraft({ ...draft, fullName: event.target.value })} />
          </Field>
          <Field label="Mã sinh viên" error={problemOf("studentCode")} counter={{ value: draft.studentCode.length, max: studentCodeMax }}>
            <Input value={draft.studentCode} onChange={(event) => setDraft({ ...draft, studentCode: event.target.value })} />
          </Field>
          <Field label="Email" error={problemOf("email")} counter={{ value: draft.email.length, max: studentEmailMax }}>
            <Input type="email" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} />
          </Field>
          <Field label="Ngành" error={problemOf("majorId")}>
            <div className="flex flex-wrap gap-1.5">
              {majors.map((major) => (
                <button
                  key={major.id}
                  type="button"
                  onClick={() => setDraft({ ...draft, majorId: major.id })}
                  aria-pressed={draft.majorId === major.id}
                  className={draft.majorId === major.id ? "rounded-full ring-2 ring-ring" : "rounded-full"}
                >
                  <MajorTag code={major.code} />
                </button>
              ))}
            </div>
          </Field>
          <Field label="Mật khẩu cho tài khoản mới" hint="Từ 8 đến 100 ký tự. Bỏ trống nếu tài khoản đã có." error={passwordError ?? undefined}>
            <Input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </Field>
          {save.isError && (
            <Notice tone="bad" title="Không thêm được sinh viên">
              <p>{save.error instanceof Error ? save.error.message : "Thử lại sau."}</p>
            </Notice>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" disabled={save.isPending} onClick={onClose}>
            Huỷ
          </Button>
          <Button pending={save.isPending} disabled={problems.length > 0 || passwordError !== null} onClick={() => save.mutate()}>
            {!save.isPending && <UserPlus />}
            Thêm vào học kỳ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
