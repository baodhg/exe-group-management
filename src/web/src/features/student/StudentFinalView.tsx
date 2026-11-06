import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { Award, Check, Crown, LayoutGrid, Layers, MessageSquare, TriangleAlert, User, UsersRound } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { ApiResult } from "../../shared/api/types";
import { useAuth } from "../../shared/auth/useAuth";
import { formatDate } from "../common/messages";
import type { Course, RoomDetail, RoomSummary } from "../common/types";
import { Badge, Failure, LinkButton, Notice, Section, SummaryCard } from "../common/ui";
import { RoomBoard } from "../rooms/RoomBoard";
import { MajorTag } from "../rooms/seats";
import { useCourseRooms } from "../rooms/useCourseRooms";
import { CourseHero } from "./CourseHero";
import { JoinedViaBadge, RoomCheckList } from "./courseParts";
import { heroCopy, sumMembers } from "./studentCourse";

function MyGroupPanel({ room, userId }: { room: RoomSummary; userId: string | undefined }) {
  const { api } = useAuth();
  const detail = useQuery({ queryKey: ["room", room.id], queryFn: () => api.get<RoomDetail>(`/api/v1/rooms/${room.id}`) });
  const data = detail.data?.data;

  return (
    <Section
      title="Nhóm của tôi"
      icon={Award}
      actions={
        <Badge icon={UsersRound}>
          <span className="tabular">
            {room.memberCount}/{room.capacity}
          </span>{" "}
          người
        </Badge>
      }
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone="good" icon={Award}>
          Chính thức
        </Badge>
        {data && (
          <Badge tone={data.eligible ? "good" : "warn"} icon={data.eligible ? Check : TriangleAlert}>
            {data.eligible ? "Đủ điều kiện" : "Ngoại lệ"}
          </Badge>
        )}
        <Badge icon={Layers}>{room.groupTypeCode}</Badge>
      </div>
      {detail.isLoading && <Skeleton className="h-64 rounded-xl" />}
      {detail.isError && <Failure error={detail.error} title="Không tải được nhóm của bạn" onRetry={() => void detail.refetch()} />}
      {data && (
        <>
          {!data.eligible && (
            <Notice tone="warn" icon={TriangleAlert}>
              Nhóm này chưa đủ điều kiện. Giáo vụ đã chấp nhận ngoại lệ khi chốt nên nhóm vẫn chính thức.
            </Notice>
          )}
          <ul className="flex list-none flex-col" aria-label="Thành viên">
            {data.members.map((member) => (
              <li key={member.studentId} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-t py-2.5 text-[13px] first:border-t-0">
                <span className="flex flex-wrap items-center gap-1.5">
                  <strong>{member.fullName}</strong>
                  <MajorTag code={member.majorCode} />
                  {member.isLeader && (
                    <Badge className="border-current text-ink" icon={Crown}>
                      Trưởng nhóm
                    </Badge>
                  )}
                  {member.studentId === userId && (
                    <Badge tone="info" icon={User}>
                      Bạn
                    </Badge>
                  )}
                </span>
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="tabular text-muted-foreground">{formatDate(member.joinedAt)}</span>
                  <JoinedViaBadge via={member.joinedVia} />
                </span>
              </li>
            ))}
          </ul>
          <RoomCheckList room={data} />
        </>
      )}
      <LinkButton to={`/rooms/${room.id}`}>
        <MessageSquare aria-hidden />
        Mở trò chuyện của nhóm
      </LinkButton>
    </Section>
  );
}

export function StudentFinalView({ course, myRoom }: { course: Course; myRoom: UseQueryResult<ApiResult<RoomSummary[]>> }) {
  const { user } = useAuth();
  const mine = myRoom.data?.data[0] ?? null;
  const everyRoom = useCourseRooms(course.id, { sort: "groupNo" });
  const groupTotal = everyRoom.data?.pagination?.totalItems ?? everyRoom.data?.data.length;
  const placed = everyRoom.data ? sumMembers(everyRoom.data.data) : null;

  const copy = heroCopy("Finalized", mine !== null);
  const title = mine ? (mine.groupNo !== null ? `Nhóm ${mine.groupNo}: ${mine.name}` : mine.name) : copy.title;
  const text = mine?.topic ? `${mine.topic}. ${copy.text}` : copy.text;
  const studentsText = placed === null ? "" : placed === 0 ? "Chưa có sinh viên nào có nhóm" : mine ? `${placed}/${course.studentCount} sinh viên đã có nhóm` : `${placed} sinh viên đã có nhóm`;

  return (
    <div className="space-y-4">
      <CourseHero
        course={course}
        title={title}
        text={text}
        aside={
          <SummaryCard icon={UsersRound} label="Cả lớp" value={groupTotal === undefined ? "—" : `${groupTotal} nhóm`}>
            {studentsText && <span className="tabular text-[13px] font-semibold">{studentsText}</span>}
          </SummaryCard>
        }
      />

      <div className={cn("grid items-start gap-4", (mine || myRoom.isLoading) && "xl:grid-cols-[minmax(340px,2fr)_minmax(0,3fr)]")}>
        {myRoom.isLoading && <Skeleton className="h-96 rounded-xl" />}
        {mine && <MyGroupPanel room={mine} userId={user?.userId} />}
        <div className="flex min-w-0 flex-col gap-3.5">
          {myRoom.isError && (
            <Section>
              <Failure error={myRoom.error} title="Không tải được nhóm của bạn" onRetry={() => void myRoom.refetch()} />
            </Section>
          )}
          <Section flush title="Danh sách nhóm chính thức" icon={LayoutGrid}>
            <RoomBoard courseId={course.id} finalized myRoomId={mine?.id ?? null} minGroupSize={course.minGroupSize} />
          </Section>
        </div>
      </div>
    </div>
  );
}
