import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Flag, Rocket, Wand2 } from "lucide-react";
import { useState } from "react";
import { useParams } from "react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "../../shared/auth/useAuth";
import { useDialogs } from "../common/dialogsContext";
import { errorText } from "../common/messages";
import type { Course, CoursePhase, GroupType, RoomSummary } from "../common/types";
import { Badge, ErrorNote, Field, Loading, NativeSelect, Notice, PageHeader, Section } from "../common/ui";
import { PhaseBadge } from "../courses/CourseCard";
import { OverviewPanel } from "../courses/OverviewPanel";
import { RoomBoard } from "../rooms/RoomBoard";
import { FinalizeSection, PlacementSection } from "./CompletionSection";
import { CourseForm } from "./CourseForm";
import { draftOf, expectedRooms, settingsOf } from "./courseDraft";
import { LifecycleStepper } from "./LifecycleStepper";
import { StudentsSection } from "./StudentsSection";

const firstTab: Record<CoursePhase, string> = { Setup: "students", Published: "progress", Expired: "finish", Finalized: "rooms" };

export function AdminCoursePage() {
  const { courseId = "" } = useParams();
  const { api } = useAuth();
  const { confirm } = useDialogs();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<string | null>(null);
  const course = useQuery({ queryKey: ["course", courseId], queryFn: () => api.get<Course>(`/api/v1/courses/${courseId}`) });
  const refresh = () =>
    Promise.all([["course", courseId], ["courses"], ["overview", courseId], ["rooms", courseId]].map((queryKey) => queryClient.invalidateQueries({ queryKey })));

  const changePhase = useMutation({
    mutationFn: (action: "publish" | "expire") => api.post<Course>(`/api/v1/courses/${courseId}/${action}`),
    onSuccess: async (_, action) => {
      toast.success(action === "publish" ? "Đã mở tìm nhóm" : "Đã kết thúc tìm nhóm");
      setTab(null);
      await refresh();
    },
    onError: (error) => toast.error(errorText(error)),
  });
  const update = useMutation({
    mutationFn: (draft: Parameters<typeof settingsOf>[0]) => api.put<Course>(`/api/v1/courses/${courseId}`, settingsOf(draft)),
    onSuccess: async () => {
      toast.success("Đã lưu cài đặt");
      await refresh();
    },
    onError: (error) => toast.error(errorText(error)),
  });

  if (course.isLoading) {
    return <Loading when rows={4} />;
  }

  if (!course.data) {
    return <ErrorNote error={course.error} />;
  }

  const current = course.data.data;
  const active = tab ?? firstTab[current.phase];

  return (
    <div className="space-y-6">
      <PageHeader
        crumbs={[{ label: "Course", to: "/admin/courses" }, { label: `${current.subjectCode} ${current.classCode}` }]}
        title={`${current.subjectCode}: ${current.subjectName}`}
        meta={
          <>
            <PhaseBadge phase={current.phase} />
            <Badge>Lớp {current.classCode}</Badge>
            <Badge>{current.semesterCode}</Badge>
            <span className="text-sm text-muted-foreground">{current.lecturerName ? `Giảng viên ${current.lecturerName}` : "Chưa phân công giảng viên"}</span>
          </>
        }
        actions={
          <>
            {current.phase === "Setup" && (
              <Button
                disabled={changePhase.isPending}
                onClick={async () => {
                  if (
                    await confirm({
                      title: "Mở tìm nhóm ngay?",
                      description: `${current.studentCount} sinh viên sẽ nhận thông báo và bắt đầu vào ${current.roomCount} phòng.`,
                      confirmLabel: "Mở tìm nhóm",
                    })
                  ) {
                    changePhase.mutate("publish");
                  }
                }}
              >
                <Rocket />
                Mở tìm nhóm ngay
              </Button>
            )}
            {current.phase === "Published" && (
              <Button
                variant="outline"
                disabled={changePhase.isPending}
                onClick={async () => {
                  if (
                    await confirm({
                      title: "Kết thúc tìm nhóm ngay?",
                      description: "Sinh viên không vào, rời phòng được nữa và các đơn đang chờ sẽ bị đóng.",
                      confirmLabel: "Kết thúc",
                      destructive: true,
                    })
                  ) {
                    changePhase.mutate("expire");
                  }
                }}
              >
                <Flag />
                Kết thúc tìm nhóm
              </Button>
            )}
          </>
        }
      />

      <LifecycleStepper course={current} />

      <Tabs value={active} onValueChange={(value) => setTab(String(value))}>
        <div className="overflow-x-auto">
          <TabsList>
            {current.phase !== "Setup" && <TabsTrigger value="progress">Tiến độ</TabsTrigger>}
            {current.phase === "Expired" && <TabsTrigger value="finish">Xếp người và chốt</TabsTrigger>}
            <TabsTrigger value="students">Sinh viên</TabsTrigger>
            <TabsTrigger value="rooms">{current.phase === "Finalized" ? "Nhóm chính thức" : "Phòng"}</TabsTrigger>
            {current.phase !== "Finalized" && <TabsTrigger value="settings">Cài đặt</TabsTrigger>}
          </TabsList>
        </div>

        <TabsContent value="progress" className="pt-4">
          <OverviewPanel courseId={courseId} />
        </TabsContent>
        <TabsContent value="finish" className="space-y-6 pt-4">
          <PlacementSection course={current} />
          <FinalizeSection course={current} />
        </TabsContent>
        <TabsContent value="students" className="pt-4">
          <StudentsSection course={current} />
        </TabsContent>
        <TabsContent value="rooms" className="space-y-6 pt-4">
          {current.phase === "Setup" && <GenerateRooms course={current} />}
          <Section>
            <RoomBoard courseId={courseId} finalized={current.phase === "Finalized"} />
          </Section>
        </TabsContent>
        <TabsContent value="settings" className="pt-4">
          <Section title="Cài đặt course">
            <CourseForm
              key={`${current.id}-${current.phase}`}
              initial={draftOf(current)}
              creating={false}
              locked={current.phase !== "Setup"}
              busy={update.isPending}
              submitLabel="Lưu cài đặt"
              onSubmit={(draft) => update.mutate(draft)}
            />
          </Section>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function GenerateRooms({ course }: { course: Course }) {
  const { api } = useAuth();
  const queryClient = useQueryClient();
  const [groupTypeId, setGroupTypeId] = useState("");
  const allowed = useQuery({
    queryKey: ["semesterGroupTypes", course.semesterId],
    queryFn: () => api.get<GroupType[]>(`/api/v1/semesters/${course.semesterId}/group-types`),
  });
  const generate = useMutation({
    mutationFn: () => api.post<{ target: number; created: number; rooms: RoomSummary[] }>(`/api/v1/courses/${course.id}/rooms/generate`, { groupTypeId }),
    onSuccess: async (result) => {
      toast.success(result.data.created > 0 ? `Đã tạo ${result.data.created} phòng` : "Đã đủ phòng, không cần tạo thêm");
      await Promise.all([["course", course.id], ["rooms", course.id]].map((queryKey) => queryClient.invalidateQueries({ queryKey })));
    },
    onError: (error) => toast.error(errorText(error)),
  });
  const target = expectedRooms(course.studentCount, course.maxGroupSize, course.roomFactor);

  return (
    <Section title="Sinh phòng" description="Chạy lại chỉ tạo thêm phần còn thiếu, không xóa phòng đã có.">
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg bg-muted/60 p-3">
            <p className="text-xs text-muted-foreground">Sinh viên</p>
            <p className="tabular text-lg font-semibold">{course.studentCount}</p>
          </div>
          <div className="rounded-lg bg-muted/60 p-3">
            <p className="text-xs text-muted-foreground">Cần có</p>
            <p className="tabular text-lg font-semibold">{target} phòng</p>
            <p className="tabular text-xs text-muted-foreground">
              ⌈{course.studentCount} × {course.roomFactor} ÷ {course.maxGroupSize}⌉
            </p>
          </div>
          <div className="rounded-lg bg-muted/60 p-3">
            <p className="text-xs text-muted-foreground">Đang có</p>
            <p className="tabular text-lg font-semibold">{course.roomCount} phòng</p>
            <p className="text-xs text-muted-foreground">mỗi phòng {course.maxGroupSize} chỗ</p>
          </div>
        </div>
        {allowed.data?.data.length === 0 && <Notice tone="warn">Học kỳ chưa cho phép loại nhóm nào. Hãy chọn ở trang Loại nhóm trước.</Notice>}
        <ErrorNote error={allowed.error} />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <Field label="Loại nhóm" className="sm:w-80">
            <NativeSelect value={groupTypeId} onChange={(event) => setGroupTypeId(event.target.value)}>
              <option value="">Chọn loại nhóm</option>
              {allowed.data?.data.map((groupType) => (
                <option key={groupType.id} value={groupType.id}>
                  {groupType.code}: {groupType.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Button className="h-9" disabled={groupTypeId === "" || generate.isPending} onClick={() => generate.mutate()}>
            <Wand2 />
            Sinh phòng
          </Button>
        </div>
      </div>
    </Section>
  );
}
