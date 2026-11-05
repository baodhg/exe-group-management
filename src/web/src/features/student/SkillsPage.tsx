import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams } from "react-router";
import { useAuth } from "../../shared/auth/useAuth";
import type { CatalogItem, StudentProfile } from "../common/types";
import { ErrorNote, Loading } from "../common/ui";

const levels = [0, 1, 2, 3, 4, 5] as const;

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
      await queryClient.invalidateQueries({ queryKey: ["profile", semesterId] });
    },
  });

  if (profile.isLoading || skills.isLoading) {
    return <Loading when />;
  }

  if (!profile.data) {
    return <ErrorNote error={profile.error} />;
  }

  const me = profile.data.data;
  return (
    <section className="card">
      <p className="muted">
        <Link to="/student">Course của tôi</Link> / Skill của tôi
      </p>
      <h1>Hồ sơ học kỳ</h1>
      <p>
        {me.studentCode} · {me.fullName} · Ngành {me.majorName} ({me.majorCode})
      </p>
      <p className="muted">Tự chấm điểm mạnh từ 1 (mới biết) đến 5 (thành thạo). Skill chỉ dùng để gợi ý phòng, không chặn thao tác nào.</p>
      {me.skillsLocked && <p className="error">Skill đã khóa vì có course của học kỳ đã hết hạn.</p>}
      <ErrorNote error={skills.error ?? save.error} />
      <table>
        <thead>
          <tr>
            <th>Skill</th>
            <th>Mức</th>
          </tr>
        </thead>
        <tbody>
          {skills.data?.data.map((skill) => (
            <tr key={skill.id}>
              <td>
                {skill.code} – {skill.name}
              </td>
              <td>
                <select
                  aria-label={`Mức ${skill.code}`}
                  value={current[skill.id] ?? 0}
                  disabled={me.skillsLocked}
                  onChange={(event) => setDraft({ ...current, [skill.id]: Number(event.target.value) })}
                >
                  {levels.map((level) => (
                    <option key={level} value={level}>
                      {level === 0 ? "Chưa chấm" : level}
                    </option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!me.skillsLocked && (
        <button type="button" disabled={draft === null || save.isPending} onClick={() => save.mutate()}>
          Lưu skill
        </button>
      )}
      {save.isSuccess && draft === null && <p className="muted">Đã lưu.</p>}
    </section>
  );
}
