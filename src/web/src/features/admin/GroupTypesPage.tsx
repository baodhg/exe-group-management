import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAuth } from "../../shared/auth/useAuth";
import type { CatalogItem, GroupType, Semester } from "../common/types";
import { ErrorNote } from "../common/ui";

export function GroupTypesPage() {
  const { api } = useAuth();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState({ code: "", name: "", minDistinctMajors: 1 });
  const [selected, setSelected] = useState<string | null>(null);

  const groupTypes = useQuery({ queryKey: ["groupTypes"], queryFn: () => api.get<GroupType[]>("/api/v1/group-types", { pageSize: 100, sort: "code" }) });
  const majors = useQuery({ queryKey: ["majors", "all"], queryFn: () => api.get<CatalogItem[]>("/api/v1/majors", { pageSize: 100, sort: "code" }) });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["groupTypes"] });

  const create = useMutation({
    mutationFn: () => api.post("/api/v1/group-types", { ...draft, code: draft.code.trim(), name: draft.name.trim() }),
    onSuccess: async () => {
      setDraft({ code: "", name: "", minDistinctMajors: 1 });
      await refresh();
    },
  });
  const remove = useMutation({ mutationFn: (id: string) => api.delete(`/api/v1/group-types/${id}`), onSuccess: refresh });

  const current = groupTypes.data?.data.find((groupType) => groupType.id === selected) ?? null;
  return (
    <div className="stack">
      <section className="card">
        <h1>Loại nhóm</h1>
        <p className="muted">Mỗi loại nhóm quy định số ngành khác nhau tối thiểu và số người tối thiểu của từng ngành (BR-09, BR-13).</p>
        <form
          className="inline-form"
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate();
          }}
        >
          <input required placeholder="Mã (VD: EXE)" value={draft.code} onChange={(event) => setDraft({ ...draft, code: event.target.value })} aria-label="Mã loại nhóm" />
          <input required placeholder="Tên" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} aria-label="Tên loại nhóm" />
          <label className="inline">
            Số ngành tối thiểu
            <input type="number" min={1} max={10} value={draft.minDistinctMajors} onChange={(event) => setDraft({ ...draft, minDistinctMajors: Number(event.target.value) })} />
          </label>
          <button type="submit" disabled={create.isPending}>
            Thêm
          </button>
        </form>
        <ErrorNote error={create.error ?? remove.error ?? groupTypes.error} />
        <table>
          <thead>
            <tr>
              <th>Mã</th>
              <th>Tên</th>
              <th>Số ngành tối thiểu</th>
              <th>Tối thiểu theo ngành</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {groupTypes.data?.data.map((groupType) => (
              <tr key={groupType.id} className={groupType.id === selected ? "mine" : undefined}>
                <td>{groupType.code}</td>
                <td>{groupType.name}</td>
                <td>{groupType.minDistinctMajors}</td>
                <td>{groupType.majors.map((major) => `${major.majorCode} ≥ ${major.minMembers}`).join(", ") || <span className="muted">—</span>}</td>
                <td className="actions">
                  <button type="button" onClick={() => setSelected(groupType.id)}>
                    Sửa
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`Xóa loại nhóm ${groupType.code}?`)) {
                        remove.mutate(groupType.id);
                      }
                    }}
                  >
                    Xóa
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {current && <GroupTypeEditor key={current.id} groupType={current} majors={majors.data?.data ?? []} onDone={() => setSelected(null)} />}

      <SemesterAllowance groupTypes={groupTypes.data?.data ?? []} />
    </div>
  );
}

function GroupTypeEditor({ groupType, majors, onDone }: { groupType: GroupType; majors: CatalogItem[]; onDone: () => void }) {
  const { api } = useAuth();
  const queryClient = useQueryClient();
  const [name, setName] = useState(groupType.name);
  const [minDistinctMajors, setMinDistinctMajors] = useState(groupType.minDistinctMajors);
  const [minimums, setMinimums] = useState<Record<string, number>>(Object.fromEntries(groupType.majors.map((major) => [major.majorId, major.minMembers])));

  const save = useMutation({
    mutationFn: async () => {
      await api.put(`/api/v1/group-types/${groupType.id}`, { code: groupType.code, name: name.trim(), minDistinctMajors });
      await api.put(
        `/api/v1/group-types/${groupType.id}/majors`,
        Object.entries(minimums)
          .filter(([, minMembers]) => minMembers > 0)
          .map(([majorId, minMembers]) => ({ majorId, minMembers })),
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["groupTypes"] });
      onDone();
    },
  });

  return (
    <section className="card">
      <h2>Sửa loại nhóm {groupType.code}</h2>
      <div className="inline-form">
        <input value={name} onChange={(event) => setName(event.target.value)} aria-label="Tên" />
        <label className="inline">
          Số ngành tối thiểu
          <input type="number" min={1} max={10} value={minDistinctMajors} onChange={(event) => setMinDistinctMajors(Number(event.target.value))} />
        </label>
      </div>
      <table>
        <thead>
          <tr>
            <th>Ngành</th>
            <th>Số người tối thiểu (0 = không yêu cầu)</th>
          </tr>
        </thead>
        <tbody>
          {majors.map((major) => (
            <tr key={major.id}>
              <td>
                {major.code} – {major.name}
              </td>
              <td>
                <input
                  type="number"
                  min={0}
                  max={20}
                  value={minimums[major.id] ?? 0}
                  onChange={(event) => setMinimums({ ...minimums, [major.id]: Number(event.target.value) })}
                  aria-label={`Tối thiểu ${major.code}`}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <ErrorNote error={save.error} />
      <div className="actions">
        <button type="button" disabled={save.isPending} onClick={() => save.mutate()}>
          Lưu
        </button>
        <button type="button" onClick={onDone}>
          Thôi
        </button>
      </div>
    </section>
  );
}

function SemesterAllowance({ groupTypes }: { groupTypes: GroupType[] }) {
  const { api } = useAuth();
  const queryClient = useQueryClient();
  const [semesterId, setSemesterId] = useState("");
  const [draft, setDraft] = useState<Set<string> | null>(null);

  const semesters = useQuery({ queryKey: ["semesters", "all"], queryFn: () => api.get<Semester[]>("/api/v1/semesters", { pageSize: 100, sort: "-startDate" }) });
  const allowed = useQuery({
    queryKey: ["semesterGroupTypes", semesterId],
    queryFn: () => api.get<GroupType[]>(`/api/v1/semesters/${semesterId}/group-types`),
    enabled: semesterId !== "",
  });
  const current = draft ?? new Set((allowed.data?.data ?? []).map((groupType) => groupType.id));

  const save = useMutation({
    mutationFn: () => api.put(`/api/v1/semesters/${semesterId}/group-types`, { groupTypeIds: [...current] }),
    onSuccess: async () => {
      setDraft(null);
      await queryClient.invalidateQueries({ queryKey: ["semesterGroupTypes", semesterId] });
    },
  });

  return (
    <section className="card">
      <h2>Loại nhóm được dùng trong học kỳ</h2>
      <select
        value={semesterId}
        onChange={(event) => {
          setSemesterId(event.target.value);
          setDraft(null);
        }}
        aria-label="Học kỳ"
      >
        <option value="">Chọn học kỳ…</option>
        {semesters.data?.data.map((semester) => (
          <option key={semester.id} value={semester.id}>
            {semester.code} – {semester.name}
          </option>
        ))}
      </select>
      {semesterId !== "" && allowed.isSuccess && (
        <>
          <ul className="checklist">
            {groupTypes.map((groupType) => (
              <li key={groupType.id}>
                <label className="inline">
                  <input
                    type="checkbox"
                    checked={current.has(groupType.id)}
                    onChange={(event) => {
                      const next = new Set(current);
                      if (event.target.checked) {
                        next.add(groupType.id);
                      } else {
                        next.delete(groupType.id);
                      }

                      setDraft(next);
                    }}
                  />
                  {groupType.code} – {groupType.name}
                </label>
              </li>
            ))}
          </ul>
          <button type="button" disabled={draft === null || save.isPending} onClick={() => save.mutate()}>
            Lưu
          </button>
        </>
      )}
      <ErrorNote error={save.error ?? allowed.error} />
    </section>
  );
}
