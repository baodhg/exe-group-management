import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Eye, FileUp, Lock, Trash2, UsersRound } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "../../shared/auth/useAuth";
import type { Course, RosterEntry } from "../common/types";
import { Badge, Criteria, Criterion, EmptyState, Notice } from "../common/ui";
import { RosterTable } from "../courses/RosterTable";
import { CourseHeader, FailureNote } from "./CourseHeader";
import { EnrolDialog, ImportDialog } from "./RosterDialogs";

function RemoveDialog({ course, student, onClose, onRemoved }: { course: Course; student: RosterEntry; onClose: () => void; onRemoved: () => Promise<unknown> }) {
  const { api } = useAuth();
  const remove = useMutation({
    mutationFn: () => api.delete(`/api/v1/courses/${course.id}/students/${student.studentId}`),
    onSuccess: async () => {
      toast.success("Đã gỡ sinh viên khỏi lớp");
      onClose();
      await onRemoved();
    },
  });

  return (
    <Dialog open onOpenChange={(open) => !open && !remove.isPending && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Gỡ {student.fullName} khỏi lớp?</DialogTitle>
        </DialogHeader>
        <Criteria>
          <Criterion label="Gỡ được">Chưa từng vào phòng nào của lớp</Criterion>
          <Criterion label="Không gỡ được">Đang ở phòng, hoặc đã vào rồi rời phòng</Criterion>
          <Criterion label="Tài khoản và hồ sơ học kỳ">Vẫn giữ nguyên</Criterion>
          <Criterion label="Máy chủ kiểm tra">Khi bấm Gỡ</Criterion>
        </Criteria>
        <FailureNote error={remove.error} />
        <DialogFooter>
          <Button variant="ghost" disabled={remove.isPending} onClick={onClose}>
            Huỷ
          </Button>
          <Button variant="destructive" pending={remove.isPending} disabled={remove.isError} onClick={() => remove.mutate()}>
            {!remove.isPending && <Trash2 />}
            Gỡ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function StudentsSection({ course }: { course: Course }) {
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState<"import" | "enrol" | null>(null);
  const [removing, setRemoving] = useState<RosterEntry | null>(null);
  const finalized = course.phase === "Finalized";
  const refresh = () => Promise.all([["roster", course.id], ["course", course.id], ["overview", course.id], ["courses"], ["semesterStudents", course.semesterId], ["placementSuggestions", course.id]].map((queryKey) => queryClient.invalidateQueries({ queryKey })));

  return (
    <div className="space-y-5">
      <CourseHeader
        course={course}
        hideLecturer
        title="Sinh viên của lớp"
        description={finalized ? "Danh sách đã chốt, chỉ xem. Không nhập thêm và không gỡ sinh viên được nữa." : "Danh sách sinh viên đã ghi danh và phòng hiện tại của từng bạn."}
        meta={finalized ? <Badge icon={Eye}>Chỉ xem</Badge> : undefined}
      />
      {finalized && (
        <Notice tone="info" icon={Lock}>
          Lớp đã chốt nhóm, không thay đổi được nữa.
        </Notice>
      )}
      {course.phase === "Expired" && (
        <Criteria columns={3}>
          <Criterion label="Ghi danh thêm">Vẫn được, tới khi chốt nhóm</Criterion>
          <Criterion label="Sinh viên mới">Chưa có phòng</Criterion>
          <Criterion label="Khi chốt nhóm">Phải xếp phòng cho họ trước</Criterion>
        </Criteria>
      )}
      <RosterTable
        courseId={course.id}
        total={course.studentCount}
        finalized={finalized}
        actions={
          finalized ? undefined : (
            <>
              <Button variant="outline" onClick={() => setDialog("enrol")}>
                <UsersRound />
                Ghi danh từ học kỳ
              </Button>
              <Button variant="outline" onClick={() => setDialog("import")}>
                <FileUp />
                Nhập danh sách lớp
              </Button>
            </>
          )
        }
        rowAction={
          finalized
            ? undefined
            : (student) =>
                student.roomId === null && (
                  <Button variant="ghost" size="icon-sm" aria-label={`Gỡ ${student.fullName} khỏi lớp`} onClick={() => setRemoving(student)}>
                    <Trash2 />
                  </Button>
                )
        }
        empty={
          <EmptyState
            icon={UsersRound}
            title="Lớp chưa có sinh viên"
            description={finalized ? undefined : "Nhập danh sách lớp từ tệp CSV, hoặc ghi danh sinh viên đã có trong học kỳ."}
            action={
              finalized ? undefined : (
                <span className="flex flex-wrap justify-center gap-2">
                  <Button onClick={() => setDialog("import")}>
                    <FileUp />
                    Nhập danh sách lớp
                  </Button>
                  <Button variant="outline" onClick={() => setDialog("enrol")}>
                    <UsersRound />
                    Ghi danh từ học kỳ
                  </Button>
                </span>
              )
            }
          />
        }
      />
      {removing && <RemoveDialog course={course} student={removing} onClose={() => setRemoving(null)} onRemoved={refresh} />}
      {dialog === "import" && <ImportDialog course={course} onClose={() => setDialog(null)} onImported={refresh} />}
      {dialog === "enrol" && <EnrolDialog course={course} onClose={() => setDialog(null)} onEnrolled={refresh} />}
    </div>
  );
}
