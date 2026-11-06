import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { ArrowRight, Bell, Check, Clock, Crown, DoorOpen, Flag, Inbox, Info, LayoutGrid, Layers, LogOut, MessageSquare, MoveRight, Pencil, TriangleAlert, User, UsersRound, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { ApiResult } from "../../shared/api/types";
import { useAuth } from "../../shared/auth/useAuth";
import { formatDateTime } from "../common/messages";
import type { Course, JoinRequest, RoomDetail, RoomSummary, StudentProfile } from "../common/types";
import { Badge, Criteria, Criterion, Failure, LinkButton, Loading, Section, SummaryCard } from "../common/ui";
import { RoomStatusBadge } from "../rooms/RoomCard";
import { MajorTag, SeatStrip } from "../rooms/seats";
import { useCourseRooms } from "../rooms/useCourseRooms";
import { CourseHero } from "./CourseHero";
import { RequestStatusBadge, RoomCheckList } from "./courseParts";
import { heroCopy, requestReason, sumMembers } from "./studentCourse";

function MyRoomBox({ room, userId }: { room: RoomSummary; userId: string | undefined }) {
  const { api } = useAuth();
  const detail = useQuery({ queryKey: ["room", room.id], queryFn: () => api.get<RoomDetail>(`/api/v1/rooms/${room.id}`) });
  const data = detail.data?.data;

  return (
    <Section
      title="Phòng của bạn"
      icon={DoorOpen}
      actions={
        <LinkButton size="sm" to={`/rooms/${room.id}`}>
          <ArrowRight aria-hidden />
          Vào phòng
        </LinkButton>
      }
    >
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <strong className="text-[15px] font-bold">{room.name}</strong>
          <RoomStatusBadge status={room.status} />
          {data && (
            <Badge tone={data.eligible ? "good" : "warn"} icon={data.eligible ? Check : TriangleAlert}>
              {data.eligible ? "Đủ điều kiện" : "Chưa đủ điều kiện"}
            </Badge>
          )}
          <Badge icon={UsersRound}>
            <span className="tabular">
              {room.memberCount}/{room.capacity}
            </span>{" "}
            người
          </Badge>
          <Badge icon={Layers}>{room.groupTypeCode}</Badge>
        </div>
        <span className="text-[13px] text-muted-foreground">{room.topic ?? "Chưa có đề tài"}</span>
      </div>
      <SeatStrip capacity={room.capacity} memberCount={room.memberCount} majors={room.majors} missingMajorSeats={room.missingMajorSeats ?? 0} />
      {detail.isLoading && <Skeleton className="h-40 rounded-xl" />}
      {detail.isError && <Failure error={detail.error} title="Không tải được thành viên" onRetry={() => void detail.refetch()} />}
      {data && (
        <>
          <ul className="flex list-none flex-col" aria-label="Thành viên">
            {data.members.map((member) => (
              <li key={member.studentId} className="flex flex-wrap items-center gap-1.5 border-t py-2.5 text-[13px] first:border-t-0">
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
              </li>
            ))}
          </ul>
          <RoomCheckList room={data} />
        </>
      )}
    </Section>
  );
}

function NextStep({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return (
    <li className="flex items-start gap-2.5 border-t py-3.5 first:border-t-0">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      <span className="flex flex-col gap-0.5">
        <strong className="text-[15px] font-bold">{title}</strong>
        <span className="text-[13px] text-muted-foreground">{text}</span>
      </span>
    </li>
  );
}

export function StudentExpiredView({
  course,
  myRoom,
  applications,
  showBoard,
}: {
  course: Course;
  myRoom: UseQueryResult<ApiResult<RoomSummary[]>>;
  applications: UseQueryResult<ApiResult<JoinRequest[]>>;
  showBoard: () => void;
}) {
  const { api, user } = useAuth();
  const mine = myRoom.data?.data[0] ?? null;
  const everyRoom = useCourseRooms(course.id);
  const profile = useQuery({
    queryKey: ["profile", course.semesterId],
    queryFn: () => api.get<StudentProfile>(`/api/v1/semesters/${course.semesterId}/students/me`),
    enabled: myRoom.isSuccess && mine === null,
  });

  const placed = everyRoom.data ? sumMembers(everyRoom.data.data) : null;
  const left = placed === null ? null : Math.max(course.studentCount - placed, 0);
  const placing = left === null ? "Giáo vụ xếp nốt sinh viên chưa có phòng" : left > 0 ? `Giáo vụ xếp nốt ${left} sinh viên` : "Cả lớp đã có phòng";
  const requests = applications.data?.data ?? [];
  const copy = heroCopy("Expired", mine !== null);

  return (
    <div className="space-y-4">
      <CourseHero
        course={course}
        title={copy.title}
        text={copy.text}
        extra={
          <Button variant="outline" size="sm" onClick={showBoard}>
            <LayoutGrid aria-hidden />
            Xem bảng phòng
          </Button>
        }
        aside={
          <SummaryCard icon={UsersRound} label="Tiến độ của lớp" value={placed === null ? "—" : `${placed}/${course.studentCount}`}>
            {placed !== null && <progress value={placed} max={Math.max(course.studentCount, 1)} aria-label="Sinh viên đã có phòng" />}
            <span className="text-[13px] font-semibold">sinh viên đã có phòng</span>
          </SummaryCard>
        }
      />

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(340px,2fr)]">
        <div className="flex min-w-0 flex-col gap-3.5">
          {myRoom.isLoading && <Skeleton className="h-64 rounded-xl" />}
          {myRoom.isError && (
            <Section>
              <Failure error={myRoom.error} title="Không tải được phòng của bạn" onRetry={() => void myRoom.refetch()} />
            </Section>
          )}

          {mine && (
            <>
              <MyRoomBox room={mine} userId={user?.userId} />
              <Section title="Điều còn làm được sau hạn" icon={Info}>
                <Criteria>
                  <Criterion icon={LogOut} label="Rời hoặc đổi phòng">
                    <span className="text-ink">Không còn được</span>
                  </Criterion>
                  <Criterion icon={MessageSquare} label="Trò chuyện của phòng">
                    <span className="text-success-ink">Vẫn mở</span>
                  </Criterion>
                  <Criterion icon={Pencil} label="Đề tài">
                    Trưởng nhóm vẫn sửa được
                  </Criterion>
                  <Criterion icon={MoveRight} label="Thay đổi người">
                    Chỉ giáo vụ
                  </Criterion>
                </Criteria>
              </Section>
            </>
          )}

          {myRoom.isSuccess && !mine && (
            <Section title="Tình trạng của bạn" icon={User}>
              <Criteria columns={3}>
                <Criterion icon={DoorOpen} label="Phòng hiện tại">
                  <span className="text-ink">Chưa có</span>
                </Criterion>
                <Criterion icon={LayoutGrid} label="Ngành của bạn">
                  {profile.data ? <MajorTag code={profile.data.data.majorCode} /> : "—"}
                </Criterion>
                <Criterion icon={Check} label="Việc bạn cần làm">
                  <span className="text-success-ink">Không có</span>
                </Criterion>
              </Criteria>
            </Section>
          )}

          {(applications.isLoading || applications.isError || requests.length > 0) && (
            <Section
              title="Đơn xin vào phòng"
              icon={Inbox}
              actions={
                <LinkButton variant="link" size="sm" to="/student/applications">
                  Xem mọi đơn
                </LinkButton>
              }
            >
              <Loading when={applications.isLoading} rows={2} className="px-0 py-0" />
              {applications.isError && <Failure error={applications.error} title="Không tải được đơn xin vào phòng" onRetry={() => void applications.refetch()} />}
              {requests.length > 0 && (
                <>
                  <ul className="flex list-none flex-col">
                    {requests.map((request) => (
                      <li key={request.id} className="flex flex-wrap items-center justify-between gap-3 border-t py-2.5 first:border-t-0">
                        <span className="flex min-w-0 flex-col gap-0.5">
                          <strong className="text-[15px] font-bold">{request.roomName}</strong>
                          <span className="text-[13px] text-muted-foreground">
                            Gửi {formatDateTime(request.createdAt)}. {requestReason(request)}
                          </span>
                        </span>
                        <RequestStatusBadge status={request.status} />
                      </li>
                    ))}
                  </ul>
                  <Criteria>
                    <Criterion icon={Clock} label="Đơn còn chờ lúc hết hạn">
                      Tự động bị từ chối
                    </Criterion>
                    <Criterion icon={Crown} label="Người từ chối">
                      Hệ thống, không phải trưởng nhóm
                    </Criterion>
                  </Criteria>
                </>
              )}
            </Section>
          )}
        </div>

        <Section title="Việc tiếp theo" icon={Info}>
          <ul className="flex list-none flex-col">
            <NextStep icon={MoveRight} title={placing} text={mine ? "Phòng còn chỗ có thể có thêm người, kể cả phòng của bạn." : "Bạn nằm trong số này. Phòng được xếp có thể không còn thiếu ngành của bạn."} />
            <NextStep icon={Bell} title={mine ? "Bạn nhận thông báo nếu bị chuyển phòng" : "Bạn nhận thông báo"} text={mine ? "Thông báo cho biết bạn được chuyển khỏi phòng nào." : "Thông báo cho biết phòng bạn được xếp vào."} />
            <NextStep icon={Flag} title="Lớp chốt nhóm chính thức" text="Các phòng được đánh số thành nhóm và danh sách chỉ còn đọc." />
          </ul>
          <Criteria>
            <Criterion icon={MoveRight} label="Giáo vụ xếp theo" wide>
              Chỗ còn trống trong phòng
            </Criterion>
            <Criterion icon={TriangleAlert} label="Phòng chưa đủ điều kiện lúc chốt" wide>
              Giữ lại nếu giáo vụ chấp nhận ngoại lệ
            </Criterion>
          </Criteria>
        </Section>
      </div>
    </div>
  );
}
