import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock } from "lucide-react";
import { useState } from "react";
import { useParams } from "react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "../../shared/auth/useAuth";
import { errorText } from "../common/messages";
import type { CatalogItem, StudentProfile } from "../common/types";
import { Badge, ErrorNote, Loading, PageHeader, Section } from "../common/ui";
import { MajorTag } from "../rooms/seats";

const levels = [
  { value: 1, label: "Mới biết" },
  { value: 2, label: "Cơ bản" },
  { value: 3, label: "Khá" },
  { value: 4, label: "Tốt" },
  { value: 5, label: "Thành thạo" },
] as const;

function LevelPicker({ skill, value, disabled, onChange }: { skill: CatalogItem; value: number; disabled: boolean; onChange: (level: number) => void }) {
  return (
    <div role="radiogroup" aria-label={`Mức ${skill.code}`} className="inline-flex rounded-lg border bg-muted/50 p-0.5">
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
              "tabular size-9 rounded-md text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60",
              level.value <= value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-card hover:text-foreground",
              active && "shadow-sm",
            )}
          >
            {level.value}
          </button>
        );
      })}
    </div>
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
      toast.success("Đã lưu skill");
      await queryClient.invalidateQueries({ queryKey: ["profile", semesterId] });
    },
    onError: (error) => toast.error(errorText(error)),
  });

  if (profile.isLoading || skills.isLoading) {
    return <Loading when rows={5} />;
  }

  if (!profile.data) {
    return <ErrorNote error={profile.error} />;
  }

  const me = profile.data.data;
  const rated = Object.values(current).filter((level) => level > 0).length;

  return (
    <div className="space-y-6 pb-20">
      <PageHeader
        crumbs={[{ label: "Course của tôi", to: "/student" }, { label: "Skill của tôi" }]}
        title="Skill của tôi"
        description="Tự chấm từ 1 (mới biết) đến 5 (thành thạo). Skill chỉ dùng để gợi ý phòng hợp với bạn, không chặn thao tác nào."
        meta={
          <>
            <span className="text-sm font-medium">{me.fullName}</span>
            <span className="text-sm text-muted-foreground">{me.studentCode}</span>
            <MajorTag code={me.majorCode} />
            <span className="text-sm text-muted-foreground">{me.majorName}</span>
          </>
        }
      />

      {me.skillsLocked && (
        <div className="flex items-start gap-3 rounded-xl border border-deadline/30 bg-deadline-soft p-4 text-sm text-deadline-ink">
          <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
          Skill đã khóa vì một course của học kỳ này đã hết hạn tìm nhóm.
        </div>
      )}
      <ErrorNote error={skills.error} />

      <Section title="Mức skill" actions={<Badge>{rated} skill đã chấm</Badge>}>
        <ul className="divide-y">
          {skills.data?.data.map((skill) => {
            const value = current[skill.id] ?? 0;
            return (
              <li key={skill.id} className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{skill.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {skill.code}
                    {value > 0 ? `, mức ${value}: ${levels[value - 1]?.label}` : ", chưa chấm"}
                  </p>
                </div>
                <LevelPicker skill={skill} value={value} disabled={me.skillsLocked} onChange={(level) => setDraft({ ...current, [skill.id]: level })} />
              </li>
            );
          })}
        </ul>
      </Section>

      {draft !== null && !me.skillsLocked && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 backdrop-blur-sm lg:left-64">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
            <p className="text-sm text-muted-foreground">Bạn có thay đổi chưa lưu.</p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setDraft(null)} disabled={save.isPending}>
                Hoàn tác
              </Button>
              <Button onClick={() => save.mutate()} disabled={save.isPending}>
                Lưu skill
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
