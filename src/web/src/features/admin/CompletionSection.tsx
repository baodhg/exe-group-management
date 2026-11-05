import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAuth } from "../../shared/auth/useAuth";
import { suggestionReasonText } from "../common/messages";
import type { Course, CourseOverview, PlacementSuggestions } from "../common/types";
import { ErrorNote, Loading } from "../common/ui";

interface Move {
  studentId: string;
  roomId: string;
}

export function PlacementSection({ course }: { course: Course }) {
  const { api } = useAuth();
  const queryClient = useQueryClient();
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [manual, setManual] = useState<Move>({ studentId: "", roomId: "" });

  const suggestions = useQuery({
    queryKey: ["placementSuggestions", course.id],
    queryFn: () => api.get<PlacementSuggestions>(`/api/v1/courses/${course.id}/placement-suggestions`),
  });
  const refresh = () =>
    Promise.all(
      [["placementSuggestions", course.id], ["overview", course.id], ["roster", course.id], ["rooms", course.id]].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
    );
  const place = useMutation({
    mutationFn: (placements: Move[]) => api.post<CourseOverview>(`/api/v1/courses/${course.id}/placements`, { placements }),
    onSuccess: async () => {
      setSkipped(new Set());
      setManual({ studentId: "", roomId: "" });
      await refresh();
    },
  });

  if (suggestions.isLoading) {
    return <Loading when />;
  }

  const data = suggestions.data?.data;
  const chosen = (data?.placements ?? []).filter((placement) => !skipped.has(placement.student.studentId));
  return (
    <section className="card">
      <h2>Xếp người sau hạn</h2>
      <ErrorNote error={suggestions.error ?? place.error} />
      {data && !data.ranked && <p className="muted">Dịch vụ gợi ý chưa trả lời; hãy xếp tay bên dưới.</p>}
      {data && data.placements.length > 0 && (
        <>
          <table>
            <thead>
              <tr>
                <th />
                <th>Sinh viên</th>
                <th>Ngành</th>
                <th>Phòng gợi ý</th>
                <th>Lý do</th>
              </tr>
            </thead>
            <tbody>
              {data.placements.map((placement) => (
                <tr key={placement.student.studentId}>
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`Chọn ${placement.student.studentCode}`}
                      checked={!skipped.has(placement.student.studentId)}
                      onChange={(event) => {
                        const next = new Set(skipped);
                        if (event.target.checked) {
                          next.delete(placement.student.studentId);
                        } else {
                          next.add(placement.student.studentId);
                        }

                        setSkipped(next);
                      }}
                    />
                  </td>
                  <td>
                    {placement.student.studentCode} · {placement.student.fullName}
                  </td>
                  <td>{placement.student.majorCode}</td>
                  <td>{placement.roomName}</td>
                  <td>{placement.reasons.map((reason) => suggestionReasonText(reason.code, reason.detail)).join("; ") || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            type="button"
            disabled={chosen.length === 0 || place.isPending}
            onClick={() => place.mutate(chosen.map((placement) => ({ studentId: placement.student.studentId, roomId: placement.roomId })))}
          >
            Áp dụng {chosen.length} gợi ý
          </button>
        </>
      )}
      {data && data.placements.length === 0 && data.unplaced.length === 0 && <p className="muted">Mọi sinh viên đã có phòng.</p>}
      {data && data.unplaced.length > 0 && (
        <form
          className="inline-form"
          onSubmit={(event) => {
            event.preventDefault();
            place.mutate([manual]);
          }}
        >
          <select required value={manual.studentId} onChange={(event) => setManual({ ...manual, studentId: event.target.value })} aria-label="Sinh viên">
            <option value="">Sinh viên chưa xếp…</option>
            {data.unplaced.map((student) => (
              <option key={student.studentId} value={student.studentId}>
                {student.studentCode} · {student.fullName} ({student.majorCode})
              </option>
            ))}
          </select>
          <select required value={manual.roomId} onChange={(event) => setManual({ ...manual, roomId: event.target.value })} aria-label="Phòng">
            <option value="">Phòng còn chỗ…</option>
            {data.rooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.name} ({room.memberCount}/{room.capacity})
              </option>
            ))}
          </select>
          <button type="submit" disabled={place.isPending}>
            Xếp tay
          </button>
        </form>
      )}
    </section>
  );
}

export function FinalizeSection({ course }: { course: Course }) {
  const { api } = useAuth();
  const queryClient = useQueryClient();
  const [acceptExceptions, setAcceptExceptions] = useState(false);
  const overview = useQuery({ queryKey: ["overview", course.id], queryFn: () => api.get<CourseOverview>(`/api/v1/courses/${course.id}/overview`) });
  const finalize = useMutation({
    mutationFn: () => api.post<{ groups: number; deletedRooms: number }>(`/api/v1/courses/${course.id}/finalize`, { acceptExceptions }),
    onSuccess: () => Promise.all([["course", course.id], ["overview", course.id], ["rooms", course.id]].map((queryKey) => queryClient.invalidateQueries({ queryKey }))),
  });

  const data = overview.data?.data;
  const exceptions = data?.ineligibleRooms.length ?? 0;
  const unplaced = data?.unplaced.length ?? 0;
  return (
    <section className="card">
      <h2>Chốt nhóm (Finalize)</h2>
      {unplaced > 0 && <p className="error">Còn {unplaced} sinh viên chưa có phòng: hãy xếp hết trước khi chốt.</p>}
      {exceptions > 0 && (
        <label className="inline warning">
          <input type="checkbox" checked={acceptExceptions} onChange={(event) => setAcceptExceptions(event.target.checked)} />
          Chấp nhận ngoại lệ: {exceptions} phòng chưa đủ người hoặc chưa đủ ngành vẫn thành nhóm chính thức.
        </label>
      )}
      <p className="muted">Khi chốt: phòng trống bị xóa, các phòng còn lại được đánh số nhóm 1..n và không thay đổi được nữa.</p>
      <button
        type="button"
        disabled={finalize.isPending || unplaced > 0}
        onClick={() => {
          if (window.confirm("Chốt danh sách nhóm chính thức? Không hoàn tác được.")) {
            finalize.mutate();
          }
        }}
      >
        Chốt nhóm
      </button>
      <ErrorNote error={finalize.error ?? overview.error} />
      {finalize.data && (
        <p className="notice">
          Đã chốt {finalize.data.data.groups} nhóm, xóa {finalize.data.data.deletedRooms} phòng trống.
        </p>
      )}
    </section>
  );
}
