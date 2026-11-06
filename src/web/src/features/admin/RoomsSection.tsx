import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DoorOpen, Info, Lock, Pencil, Save, Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ApiError } from "../../shared/api/apiClient";
import { useAuth } from "../../shared/auth/useAuth";
import type { Course, GroupType, RoomSummary } from "../common/types";
import { Badge, Criteria, Criterion, Field, LinkButton, NativeSelect, Notice, Section } from "../common/ui";
import { CourseRoomsTable } from "../courses/CourseRoomsTable";
import { courseErrorText } from "./courseErrors";
import { CourseHeader, FailureNote } from "./CourseHeader";

const maxRoomNameLength = 50;

const lockNotices: Partial<Record<Course["phase"], string>> = {
  Published: "Lớp đã mở nên phòng không đổi tên, đổi loại hay xoá được nữa.",
  Expired: "Lớp đã hết hạn nên phòng không đổi tên, đổi loại hay xoá được nữa.",
  Finalized: "Lớp đã chốt nhóm, không thay đổi được nữa.",
};

function EditRoomDialog({ room, groupTypes, onClose, onSaved }: { room: RoomSummary; groupTypes: readonly GroupType[]; onClose: () => void; onSaved: () => Promise<unknown> }) {
  const { api } = useAuth();
  const [name, setName] = useState(room.name);
  const [groupTypeId, setGroupTypeId] = useState(room.groupTypeId);
  const trimmed = name.trim();
  const update = useMutation({
    mutationFn: () => api.put(`/api/v1/rooms/${room.id}`, { name: trimmed, groupTypeId }),
    onSuccess: async () => {
      const code = groupTypes.find((type) => type.id === groupTypeId)?.code ?? room.groupTypeCode;
      toast.success("Đã lưu phòng", { description: `${trimmed} dùng loại nhóm ${code}.` });
      onClose();
      await onSaved();
    },
  });
  const nameTaken = update.error instanceof ApiError && update.error.code === "ROOM_NAME_TAKEN";
  const unchanged = trimmed === room.name && groupTypeId === room.groupTypeId;

  return (
    <Dialog open onOpenChange={(open) => !open && !update.isPending && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sửa {room.name}</DialogTitle>
        </DialogHeader>
        <Field label="Tên phòng" error={nameTaken ? courseErrorText(update.error) : undefined} counter={{ value: trimmed.length, max: maxRoomNameLength }}>
          <Input
            maxLength={maxRoomNameLength + 10}
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              update.reset();
            }}
          />
        </Field>
        <Field label="Loại nhóm">
          <NativeSelect
            value={groupTypeId}
            onChange={(event) => {
              setGroupTypeId(event.target.value);
              update.reset();
            }}
          >
            {!groupTypes.some((type) => type.id === room.groupTypeId) && <option value={room.groupTypeId}>{room.groupTypeCode}</option>}
            {groupTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.code}: {type.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <FailureNote error={update.error} />
        <DialogFooter>
          <Button variant="ghost" disabled={update.isPending} onClick={onClose}>
            Huỷ
          </Button>
          <Button pending={update.isPending} disabled={trimmed.length === 0 || trimmed.length > maxRoomNameLength || unchanged} onClick={() => update.mutate()}>
            {!update.isPending && <Save />}
            {update.isPending ? "Đang lưu" : "Lưu"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteRoomDialog({ room, roomCount, onClose, onDeleted }: { room: RoomSummary; roomCount: number; onClose: () => void; onDeleted: () => Promise<unknown> }) {
  const { api } = useAuth();
  const remove = useMutation({
    mutationFn: () => api.delete(`/api/v1/rooms/${room.id}`),
    onSuccess: async () => {
      toast.success(`Đã xoá ${room.name}`);
      onClose();
      await onDeleted();
    },
  });

  return (
    <Dialog open onOpenChange={(open) => !open && !remove.isPending && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Xoá {room.name}?</DialogTitle>
        </DialogHeader>
        <Criteria>
          <Criterion label="Số phòng còn lại">{Math.max(roomCount - 1, 0)} phòng</Criterion>
          <Criterion label="Chạy lại Sinh phòng">Tạo bù phần còn thiếu</Criterion>
        </Criteria>
        <FailureNote error={remove.error} />
        <DialogFooter>
          <Button variant="ghost" disabled={remove.isPending} onClick={onClose}>
            Huỷ
          </Button>
          <Button variant="destructive" pending={remove.isPending} disabled={remove.isError} onClick={() => remove.mutate()}>
            {!remove.isPending && <Trash2 />}
            Xoá phòng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RoomsSection({ course }: { course: Course }) {
  const { api } = useAuth();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<RoomSummary | null>(null);
  const [deleting, setDeleting] = useState<RoomSummary | null>(null);
  const isSetup = course.phase === "Setup";
  const finalized = course.phase === "Finalized";
  const groupTypes = useQuery({
    queryKey: ["semesterGroupTypes", course.semesterId],
    queryFn: () => api.get<GroupType[]>(`/api/v1/semesters/${course.semesterId}/group-types`),
  });
  const allowed = groupTypes.data?.data ?? [];
  const refresh = () => Promise.all([["rooms", course.id], ["course", course.id], ["courses"], ["overview", course.id]].map((queryKey) => queryClient.invalidateQueries({ queryKey })));
  const notice = lockNotices[course.phase];
  const generateLink = (
    <LinkButton to={`/admin/courses/${course.id}/settings`} variant={course.roomCount === 0 ? "default" : "outline"}>
      <Sparkles />
      Sinh phòng
    </LinkButton>
  );

  return (
    <div className="space-y-5">
      <CourseHeader
        course={course}
        hideLecturer
        title="Phòng của lớp"
        description={isSetup ? "Đổi tên, đổi loại nhóm hoặc xoá phòng trước khi mở cho sinh viên." : "Xem các phòng của lớp. Mở một phòng để xem thành viên ở chế độ chỉ xem."}
        meta={<Badge icon={DoorOpen}>{course.roomCount} {finalized ? "nhóm" : "phòng"}</Badge>}
      />
      {notice && (
        <Notice tone="info" icon={Lock}>
          {notice}
        </Notice>
      )}
      <CourseRoomsTable
        courseId={course.id}
        minGroupSize={course.minGroupSize}
        finalized={finalized}
        layout="manage"
        title={finalized ? "Nhóm chính thức" : "Các phòng"}
        groupTypes={allowed}
        actions={isSetup ? generateLink : undefined}
        emptyAction={isSetup ? generateLink : undefined}
        rowActions={
          isSetup
            ? (room) => (
                <span className="inline-flex gap-1">
                  <Button variant="ghost" size="icon-sm" aria-label={`Sửa ${room.name}`} onClick={() => setEditing(room)}>
                    <Pencil />
                  </Button>
                  <Button variant="ghost" size="icon-sm" aria-label={`Xoá ${room.name}`} onClick={() => setDeleting(room)}>
                    <Trash2 />
                  </Button>
                </span>
              )
            : undefined
        }
      />
      {isSetup && (
        <Section title="Luật sửa phòng" icon={Info}>
          <Criteria columns={4}>
            <Criterion label="Đổi tên, đổi loại, xoá">Chỉ khi lớp ở Chuẩn bị</Criterion>
            <Criterion label="Tên phòng">Từ 1 đến 50 ký tự, không trùng</Criterion>
            <Criterion label="Loại nhóm">Học kỳ phải cho phép</Criterion>
            <Criterion label="Thêm một phòng">Chỉ qua Sinh phòng</Criterion>
          </Criteria>
        </Section>
      )}
      {editing && <EditRoomDialog room={editing} groupTypes={allowed} onClose={() => setEditing(null)} onSaved={refresh} />}
      {deleting && <DeleteRoomDialog room={deleting} roomCount={course.roomCount} onClose={() => setDeleting(null)} onDeleted={refresh} />}
    </div>
  );
}
