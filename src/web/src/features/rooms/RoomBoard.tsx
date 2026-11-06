import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router";
import { useAuth } from "../../shared/auth/useAuth";
import { roomStatusLabels } from "../common/messages";
import type { RoomSummary } from "../common/types";
import { Badge, ErrorNote, Pager } from "../common/ui";
import { useWatchCourse } from "../realtime/realtimeContext";
import { roomSorts } from "./roomActions";

export function RoomBoard({ courseId, finalized = false, myRoomId = null }: { courseId: string; finalized?: boolean; myRoomId?: string | null }) {
  const { api } = useAuth();
  const [search, setSearch] = useState("");
  const [onlyWithSeat, setOnlyWithSeat] = useState(false);
  const [sort, setSort] = useState<string>(finalized ? "groupNo" : "name");
  const [page, setPage] = useState(1);
  useWatchCourse(courseId);

  const rooms = useQuery({
    queryKey: ["rooms", courseId, { search, onlyWithSeat, sort, page }],
    queryFn: () =>
      api.get<RoomSummary[]>(`/api/v1/courses/${courseId}/rooms`, {
        search,
        hasSeat: onlyWithSeat ? true : undefined,
        sort,
        page,
        pageSize: 20,
      }),
    placeholderData: keepPreviousData,
  });

  return (
    <div>
      <div className="toolbar">
        <input
          placeholder="Tìm theo tên phòng hoặc đề tài"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />
        {!finalized && (
          <label className="inline">
            <input
              type="checkbox"
              checked={onlyWithSeat}
              onChange={(event) => {
                setOnlyWithSeat(event.target.checked);
                setPage(1);
              }}
            />
            Còn chỗ
          </label>
        )}
        <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sắp xếp">
          {finalized && <option value="groupNo">Số nhóm</option>}
          {roomSorts.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <ErrorNote error={rooms.error} />
      <table>
        <thead>
          <tr>
            {finalized && <th>Nhóm</th>}
            <th>Phòng</th>
            <th>Đề tài</th>
            <th>Trưởng phòng</th>
            <th>Số người</th>
            <th>Loại nhóm</th>
            <th>Trạng thái</th>
          </tr>
        </thead>
        <tbody>
          {rooms.data?.data.map((room) => (
            <tr key={room.id} className={room.id === myRoomId ? "mine" : undefined}>
              {finalized && <td>{room.groupNo ?? "—"}</td>}
              <td>
                <Link to={`/rooms/${room.id}`}>{room.name}</Link>
                {room.id === myRoomId && <Badge tone="good">Phòng của tôi</Badge>}
              </td>
              <td>{room.topic ?? <span className="muted">Chưa có</span>}</td>
              <td>{room.leaderName ?? <span className="muted">—</span>}</td>
              <td>
                {room.memberCount}/{room.capacity}
              </td>
              <td>{room.groupTypeCode}</td>
              <td>
                <Badge tone={room.status === "Open" ? "good" : room.status === "Locked" ? "warn" : "neutral"}>{roomStatusLabels[room.status]}</Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rooms.data?.data.length === 0 && <p className="muted">Không có phòng nào.</p>}
      <Pager pagination={rooms.data?.pagination} page={page} onPage={setPage} unit="phòng" />
    </div>
  );
}
