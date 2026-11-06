import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Check, ClipboardList, Clock, Code2, DoorOpen, Eye, FileText, Info, LayoutGrid, Lock, Megaphone, Palette, Pencil, Save, Sparkles, Star, Undo2, User, UsersRound, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { useParams } from "react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useAuth } from "../../shared/auth/useAuth";
import { errorText, formatDate } from "../common/messages";
import type { CatalogItem, Course, GroupType, StudentProfile } from "../common/types";
import { Badge, Criteria, Criterion, EmptyState, Failure, Notice, PageHeader, Section, SummaryCard } from "../common/ui";
import { MajorTag } from "../rooms/seats";
import { CoursePill, PageDenied, PhaseSteps } from "./courseParts";
import { countdownText, courseForSemester, deniedStatus, hasErrorCode } from "./studentCourse";

const levels = [
  { value: 1, label: "Mới biết" },
  { value: 2, label: "Cơ bản" },
  { value: 3, label: "Khá" },
  { value: 4, label: "Tốt" },
  { value: 5, label: "Thành thạo" },
] as const;

const skillIcons: Record<string, LucideIcon> = { DESIGN: Palette, MGMT: UsersRound, MKT: Megaphone, PROG: Code2 };

const usageLines: { icon: LucideIcon; text: string }[] = [
  { icon: Eye, text: "Hiện cho sinh viên và trưởng nhóm cùng lớp" },
  { icon: Sparkles, text: "Dùng để xếp hạng phòng gợi ý cho bạn" },
  { icon: DoorOpen, text: "Không bao giờ chặn bạn vào phòng" },
  { icon: Pencil, text: "Sửa được cho tới khi một lớp của bạn qua hạn tìm nhóm" },
];

function LevelPicker({ skill, value, disabled, onChange }: { skill: CatalogItem; value: number; disabled: boolean; onChange: (level: number) => void }) {
  return (
    <div role="radiogroup" aria-label={`Mức ${skill.name}`} className="flex flex-wrap gap-1.5">
      {levels.map((level) => {
        const active = value === level.value;
        return (
          <button
            key={level.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={`${level.value}, ${level.label}`}
            title={level.label}
            disabled={disabled}
            onClick={() => onChange(active ? 0 : level.value)}
            className={cn(
              "tabular size-9 rounded-full border text-sm font-semibold transition-colors outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent",
              active && "border-primary bg-primary text-primary-foreground hover:bg-primary disabled:hover:bg-primary",
              level.value < value && "border-transparent bg-primary/15 text-ink",
            )}
          >
            {level.value}
          </button>
        );
      })}
    </div>
  );
}

function SkillsSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Đang tải kỹ năng">
      <div className="space-y-3 pt-5 pb-2.5">
        <Skeleton className="h-8 w-72 max-w-full rounded-full" />
        <Skeleton className="h-3 w-96 max-w-full rounded-full" />
        <Skeleton className="h-3 w-64 max-w-full rounded-full" />
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(340px,2fr)]">
        <Skeleton className="h-96 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    </div>
  );
}

function PhaseCard({ course }: { course: Course }) {
  if (course.phase === "Setup") {
    return (
      <SummaryCard icon={course.publishAt ? Clock : CalendarDays} label={course.publishAt ? "Mở chọn phòng sau" : "Mở chọn phòng"} value={course.publishAt ? countdownText(course.publishAt) : "Chưa hẹn giờ"}>
        <span className="text-[13px] text-muted-foreground">{course.publishAt ? "Giáo vụ đã hẹn giờ mở lớp" : "Giáo vụ chưa đặt giờ mở lớp"}</span>
      </SummaryCard>
    );
  }

  return (
    <SummaryCard icon={Clock} label="Hạn tìm nhóm" value={course.expireAt ? formatDate(course.expireAt) : "Chưa đặt hạn"}>
      {course.expireAt && <span className="text-[13px] text-muted-foreground">Đóng lúc {new Date(course.expireAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</span>}
    </SummaryCard>
  );
}

export function SkillsPage() {
  const { semesterId = "" } = useParams();
  const { api } = useAuth();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Record<string, number> | null>(null);

  const profile = useQuery({
    queryKey: ["profile", semesterId],
    queryFn: () => api.get<StudentProfile>(`/api/v1/semesters/${semesterId}/students/me`),
  });
  const skills = useQuery({ queryKey: ["skills", "all"], queryFn: () => api.get<CatalogItem[]>("/api/v1/skills", { pageSize: 100, sort: "code" }) });
  const courses = useQuery({
    queryKey: ["courses", "mine"],
    queryFn: () => api.get<Course[]>("/api/v1/courses", { mine: true, pageSize: 100, sort: "-expireAt" }),
  });
  const groupTypes = useQuery({
    queryKey: ["semesterGroupTypes", semesterId],
    queryFn: () => api.get<GroupType[]>(`/api/v1/semesters/${semesterId}/group-types`),
  });

  const saved = Object.fromEntries((profile.data?.data.skills ?? []).map((skill) => [skill.skillId, skill.level]));
  const current = draft ?? saved;

  const save = useMutation({
    mutationFn: () =>
      api.put<StudentProfile>(
        `/api/v1/semesters/${semesterId}/students/me/skills`,
        Object.entries(current)
          .filter(([, level]) => level > 0)
          .map(([skillId, level]) => ({ skillId, level })),
      ),
    onSuccess: async () => {
      setDraft(null);
      toast.success("Đã lưu kỹ năng");
      await queryClient.invalidateQueries({ queryKey: ["profile", semesterId] });
    },
    onError: async (error) => {
      toast.error("Không lưu được kỹ năng", { description: errorText(error) });
      if (hasErrorCode(error, "SKILLS_LOCKED")) {
        setDraft(null);
        await queryClient.invalidateQueries({ queryKey: ["profile", semesterId] });
      }
    },
  });

  if (profile.isLoading) {
    return <SkillsSkeleton />;
  }

  if (!profile.data) {
    const denied = deniedStatus(profile.error);
    if (denied === 403) {
      return <PageDenied status={403} title="Bạn không có quyền mở trang này" text="Bạn không có quyền làm thao tác này." />;
    }

    if (denied === 404) {
      return <PageDenied status={404} title="Bạn chưa có trong học kỳ này" text="Sinh viên chưa có trong học kỳ." />;
    }

    return <Failure error={profile.error} title="Không tải được kỹ năng của bạn" onRetry={() => void profile.refetch()} className="min-h-[60vh] justify-center" />;
  }

  const me = profile.data.data;
  const catalog = skills.data?.data ?? [];
  const rated = catalog.filter((skill) => (current[skill.id] ?? 0) > 0).length;
  const course = courseForSemester(courses.data?.data ?? [], semesterId);
  const types = groupTypes.data?.data ?? [];

  return (
    <div className="space-y-4">
      <PageHeader
        lead={course ? <CoursePill course={course} /> : undefined}
        title="Kỹ năng của tôi"
        description="Tự chấm từ 1 (mới biết) đến 5 (thành thạo). Kỹ năng chỉ dùng để gợi ý phòng hợp với bạn, không chặn thao tác nào."
        meta={course ? <PhaseSteps phase={course.phase} /> : undefined}
        aside={course ? <PhaseCard course={course} /> : undefined}
      />

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(340px,2fr)]">
        <section className="flex min-w-0 flex-col gap-3.5" aria-label="Kỹ năng">
          {course?.phase === "Setup" && (
            <Notice tone="info" title="Lớp chưa mở tìm nhóm">
              Khi lớp mở, bạn sẽ nhận thông báo và có thể chọn phòng. Bảng phòng còn trống trong giai đoạn này.
            </Notice>
          )}
          {me.skillsLocked && (
            <Notice tone="warn" icon={Lock}>
              Kỹ năng đã khoá vì một lớp của học kỳ này đã hết hạn tìm nhóm.
            </Notice>
          )}

          <Section title="Sinh viên" icon={User}>
            <Criteria columns={3}>
              <Criterion icon={User} label="Họ tên">
                {me.fullName}
              </Criterion>
              <Criterion icon={FileText} label="Mã sinh viên">
                {me.studentCode}
              </Criterion>
              <Criterion icon={LayoutGrid} label="Ngành">
                <span className="flex flex-wrap items-center gap-1.5 text-[13px] font-normal">
                  <MajorTag code={me.majorCode} />
                  {me.majorName}
                </span>
              </Criterion>
            </Criteria>
          </Section>

          <Section
            title="Mức kỹ năng"
            icon={Star}
            actions={
              catalog.length > 0 ? (
                <Badge tone={rated === catalog.length ? "good" : "warn"} icon={Check}>
                  Đã chấm {rated}/{catalog.length}
                </Badge>
              ) : undefined
            }
          >
            {skills.isLoading && <Skeleton className="h-64 rounded-xl" />}
            {skills.isError && <Failure error={skills.error} title="Không tải được danh sách kỹ năng" onRetry={() => void skills.refetch()} />}
            {skills.isSuccess && catalog.length === 0 && <EmptyState icon={Star} title="Chưa có kỹ năng nào để chấm" description="Kỹ năng do giáo vụ tạo sẽ hiện ở đây." />}
            {catalog.length > 0 && (
              <>
                <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Tên các mức">
                  {levels.map((level) => (
                    <Badge key={level.value} icon={Star}>
                      {level.value}: {level.label}
                    </Badge>
                  ))}
                </div>
                <ul className="flex list-none flex-col">
                  {catalog.map((skill) => {
                    const value = current[skill.id] ?? 0;
                    const Icon = skillIcons[skill.code] ?? Star;
                    return (
                      <li key={skill.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t py-2.5 first:border-t-0">
                        <span className="flex min-w-0 flex-[1_1_200px] flex-col gap-0.5">
                          <strong className="inline-flex items-center gap-1.5 text-[15px] font-bold">
                            <Icon className="size-4 shrink-0" aria-hidden />
                            {skill.name}
                          </strong>
                          <span className="text-[13px] text-muted-foreground">
                            {skill.code}, {value > 0 ? `mức ${value}: ${levels[value - 1]?.label}` : "chưa chấm"}
                          </span>
                        </span>
                        <LevelPicker skill={skill} value={value} disabled={me.skillsLocked} onChange={(level) => setDraft({ ...current, [skill.id]: level })} />
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </Section>

          {draft !== null && !me.skillsLocked && (
            <div role="region" aria-label="Thay đổi chưa lưu" className="sticky bottom-3 z-20 flex flex-wrap items-center justify-between gap-2 rounded-full border border-input bg-card px-3.5 py-2.5 text-[13px] shadow-lg">
              <span className="inline-flex items-center gap-1.5">
                <Pencil className="size-3.5" aria-hidden />
                Bạn có thay đổi chưa lưu.
              </span>
              <span className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" disabled={save.isPending} onClick={() => setDraft(null)}>
                  <Undo2 aria-hidden />
                  Hoàn tác
                </Button>
                <Button size="sm" pending={save.isPending} onClick={() => save.mutate()}>
                  {!save.isPending && <Save aria-hidden />}
                  {save.isPending ? "Đang lưu" : "Lưu kỹ năng"}
                </Button>
              </span>
            </div>
          )}
        </section>

        <aside className="flex min-w-0 flex-col gap-3.5">
          <Section title="Kỹ năng được dùng thế nào" icon={Info}>
            <ul className="flex list-none flex-col text-[13px]">
              {usageLines.map((line) => (
                <li key={line.text} className="flex items-center gap-2 border-t py-2.5 first:border-t-0">
                  <line.icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  {line.text}
                </li>
              ))}
            </ul>
          </Section>
          {(course || types.length > 0) && (
            <Section title="Tiêu chí nhóm hợp lệ" icon={ClipboardList}>
              <Criteria>
                {course && (
                  <Criterion icon={UsersRound} label="Số thành viên">
                    {course.minGroupSize} đến {course.maxGroupSize} người
                  </Criterion>
                )}
                {types.flatMap((type) => {
                  const suffix = types.length > 1 ? ` (${type.code})` : "";
                  const required = type.majors.filter((major) => major.minMembers > 0);
                  return [
                    <Criterion key={`${type.id}-count`} icon={LayoutGrid} label={`Số ngành${suffix}`}>
                      Từ {type.minDistinctMajors} ngành
                    </Criterion>,
                    required.length > 0 && (
                      <Criterion key={`${type.id}-required`} icon={Lock} label={`Ngành bắt buộc${suffix}`} wide>
                        <span className="flex flex-wrap items-center gap-1.5">
                          {required.map((major) => (
                            <MajorTag key={major.majorId} code={major.majorCode} />
                          ))}
                        </span>
                      </Criterion>
                    ),
                  ];
                })}
              </Criteria>
            </Section>
          )}
        </aside>
      </div>
    </div>
  );
}
