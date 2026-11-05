import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { useAuth } from "../../shared/auth/useAuth";
import type { CourseOverview } from "../common/types";
import { ErrorNote, Loading } from "../common/ui";
import { missingMajorsText, missingMembersText } from "./overview";

export function OverviewPanel({ courseId }: { courseId: string }) {
  const { api } = useAuth();
  const overview = useQuery({
    queryKey: ["overview", courseId],
    queryFn: () => api.get<CourseOverview>(`/api/v1/courses/${courseId}/overview`),
  });

  if (overview.isLoading) {
    return <Loading when />;
  }

  if (!overview.data) {
    return <ErrorNote error={overview.error} />;
  }

  const data = overview.data.data;
  return (
    <div>
      <div className="stats">
        <Stat label="Sinh viên" value={data.studentCount} />
        <Stat label="Đã có phòng" value={data.placedCount} />
        <Stat label="Chưa có phòng" value={data.unplaced.length} tone={data.unplaced.length > 0 ? "warn" : "good"} />
        <Stat label="Phòng đủ điều kiện" value={`${data.eligibleRoomCount}/${data.roomCount - data.emptyRoomCount}`} />
        <Stat label="Phòng trống" value={data.emptyRoomCount} />
      </div>

      <h3>Sinh viên chưa có phòng</h3>
      {data.unplaced.length === 0 ? (
        <p className="muted">Mọi sinh viên đã có phòng.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>MSSV</th>
              <th>Họ tên</th>
              <th>Ngành</th>
            </tr>
          </thead>
          <tbody>
            {data.unplaced.map((student) => (
              <tr key={student.studentId}>
                <td>{student.studentCode}</td>
                <td>{student.fullName}</td>
                <td>{student.majorCode}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h3>Phòng chưa đủ điều kiện</h3>
      {data.ineligibleRooms.length === 0 ? (
        <p className="muted">Không có phòng nào thiếu người hoặc thiếu ngành.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Phòng</th>
              <th>Số người</th>
              <th>Thiếu người</th>
              <th>Thiếu ngành</th>
            </tr>
          </thead>
          <tbody>
            {data.ineligibleRooms.map((item) => (
              <tr key={item.room.id}>
                <td>
                  <Link to={`/rooms/${item.room.id}`}>{item.room.name}</Link>
                </td>
                <td>
                  {item.room.memberCount}/{item.room.capacity}
                </td>
                <td>{missingMembersText(item, data.minGroupSize)}</td>
                <td>{missingMajorsText(item)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function Stat({ label, value, tone = "neutral" }: { label: string; value: number | string; tone?: "neutral" | "good" | "warn" }) {
  return (
    <div className={`stat stat-${tone}`}>
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}
