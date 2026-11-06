import { useQuery } from "@tanstack/react-query";
import { Award, Clock, Eye, GraduationCap, LayoutGrid, SlidersHorizontal, UsersRound } from "lucide-react";
import { useState } from "react";
import { useParams } from "react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "../../shared/auth/useAuth";
import { formatDateTime } from "../common/messages";
import type { Course, CourseOverview } from "../common/types";
import { Badge, Count, Criteria, Criterion, EmptyState, Failure, Notice, PageHeader, PageLoading, Section, SummaryCard } from "../common/ui";
import { useCourseOverview, useNow } from "../courses/courseData";
import { CourseFailure } from "../courses/CourseFailure";
import { CourseRoomsTable } from "../courses/CourseRoomsTable";
import { countdownText, shortDateTime } from "../courses/overview";
import { IneligibleRooms, OverviewSkeleton, OverviewTiles, PlacementProgress, UnplacedMajors, UnplacedStudents } from "../courses/OverviewPanel";
import { PhaseChip } from "../courses/PhaseChip";
import { RosterTable } from "../courses/RosterTable";
import { useWatchCourse } from "../realtime/realtimeContext";

function ProgressCard({ course, data, now }: { course: Course; data: CourseOverview | undefined; now: number }) {
  const deadline = course.expireAt ? `Hạn ${shortDateTime(course.expireAt)}` : "Chưa đặt hạn";
  if (course.phase === "Setup") {
    return (
      <SummaryCard icon={SlidersHorizontal} label="Chưa mở chọn phòng" value={`${course.studentCount} sinh viên`}>
        <span className="text-xs">{course.publishAt ? `Tự mở lúc ${shortDateTime(course.publishAt)}` : "Chưa hẹn giờ mở"}</span>
        <span className="text-xs text-muted-foreground">{deadline}</span>
      </SummaryCard>
    );
  }

  if (course.phase === "Finalized") {
    return (
      <SummaryCard icon={Award} label="Đã chốt nhóm" value={`${course.roomCount} nhóm`}>
        {data && (
          <span className="text-xs">
            {data.placedCount}/{data.studentCount} sinh viên đã có nhóm
          </span>
        )}
        <span className="text-xs text-muted-foreground">Chốt nhóm lúc {formatDateTime(course.finalizedAt)}</span>
      </SummaryCard>
    );
  }

  const countdown = countdownText(course.expireAt, now);
  return (
    <SummaryCard icon={course.phase === "Expired" ? Clock : UsersRound} label={course.phase === "Expired" ? "Đã hết hạn" : "Tiến độ"} value={data ? `${data.placedCount}/${data.studentCount}` : undefined}>
      {data && <progress value={data.placedCount} max={Math.max(data.studentCount, 1)} aria-label="Tiến độ xếp phòng" />}
      <span className="text-xs">{course.phase === "Expired" ? "Giáo vụ đang xếp người còn lại rồi chốt nhóm" : countdown ? `Còn ${countdown} tới hạn` : "Đang đóng"}</span>
      <span className="text-xs text-muted-foreground">{deadline}</span>
    </SummaryCard>
  );
}

export function LecturerCoursePage() {
  const { courseId = "" } = useParams();
  const { api } = useAuth();
  const now = useNow();
  const [tab, setTab] = useState("progress");
  useWatchCourse(courseId);
  const course = useQuery({ queryKey: ["course", courseId], queryFn: () => api.get<Course>(`/api/v1/courses/${courseId}`) });
  const overview = useCourseOverview(courseId);

  if (course.isLoading) {
    return <PageLoading />;
  }

  if (!course.data) {
    return (
      <CourseFailure
        error={course.error}
        onRetry={() => void course.refetch()}
        failTitle="Không tải được thông tin lớp"
        forbiddenText="Tiến độ và danh sách sinh viên chỉ mở cho giáo vụ và giảng viên của lớp."
        missingText="Lớp này không còn tồn tại hoặc đường dẫn đã sai."
        backTo="/lecturer"
        backLabel="Về các lớp giảng dạy"
      />
    );
  }

  const current = course.data.data;
  const data = overview.data?.data;
  const finalized = current.phase === "Finalized";

  return (
    <div className="space-y-5">
      <PageHeader
        crumbs={[{ label: "Các lớp giảng dạy", to: "/lecturer" }, { label: `${current.subjectCode} ${current.classCode}` }]}
        title={`${current.subjectCode}: ${current.subjectName}`}
        description="Bạn đang xem lớp mình dạy ở chế độ chỉ xem. Mọi thay đổi do sinh viên và giáo vụ thực hiện."
        meta={
          <>
            <PhaseChip phase={current.phase} />
            <Badge icon={GraduationCap}>Lớp {current.classCode}</Badge>
            <Badge icon={Eye}>Chỉ xem</Badge>
            <Badge icon={UsersRound}>
              {current.studentCount} sinh viên, {current.roomCount} {finalized ? "nhóm" : "phòng"}
            </Badge>
          </>
        }
        aside={<ProgressCard course={current} data={data} now={now} />}
      />

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Tabs value={tab} onValueChange={(value) => setTab(String(value))} className="min-w-0">
          <TabsList>
            <TabsTrigger value="progress">
              <UsersRound />
              Tiến độ
              {data && <Count>{`${data.placedCount}/${data.studentCount}`}</Count>}
            </TabsTrigger>
            <TabsTrigger value="rooms">
              {finalized ? <Award /> : <LayoutGrid />}
              {finalized ? "Nhóm chính thức" : "Bảng phòng"}
              <Count>{current.roomCount}</Count>
            </TabsTrigger>
            <TabsTrigger value="roster">
              <GraduationCap />
              Sinh viên
              <Count>{current.studentCount}</Count>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="progress" className="space-y-5">
            {current.phase === "Setup" && <Notice tone="info">Lớp đang chuẩn bị. Sinh viên chưa chọn phòng được nên tiến độ còn trống.</Notice>}
            {overview.isLoading && <OverviewSkeleton />}
            {overview.isError && <Failure error={overview.error} title="Không tải được tiến độ của lớp" onRetry={() => void overview.refetch()} />}
            {data && (
              <>
                <OverviewTiles data={data} columns={2} />
                <PlacementProgress data={data} />
                <IneligibleRooms data={data} />
                <UnplacedStudents data={data} />
              </>
            )}
          </TabsContent>
          <TabsContent value="rooms">
            <CourseRoomsTable courseId={courseId} minGroupSize={current.minGroupSize} finalized={finalized} layout="compact" title={finalized ? "Nhóm chính thức" : "Bảng phòng"} />
          </TabsContent>
          <TabsContent value="roster">
            <RosterTable courseId={courseId} total={current.studentCount} finalized={finalized} empty={<EmptyState icon={UsersRound} title="Lớp chưa có sinh viên" description="Giáo vụ nhập danh sách lớp, sinh viên sẽ hiện ở đây." />} />
          </TabsContent>
        </Tabs>

        <div className="min-w-0 space-y-5">
          {data && data.unplaced.length > 0 && <UnplacedMajors data={data} compact />}
          <Section title="Quyền xem của bạn" icon={Eye}>
            <Criteria columns={2} className="sm:grid-cols-1">
              <Criterion label="Tiến độ và danh sách sinh viên">Chỉ lớp bạn được phân công</Criterion>
              <Criterion label="Trò chuyện của phòng">Chỉ thành viên đọc được</Criterion>
              <Criterion label="Thông báo cho giảng viên">Chỉ khi lớp chốt nhóm</Criterion>
              <Criterion label="Nhóm chính thức">{finalized ? "Ở tab Nhóm chính thức" : "Hiện tại đây khi lớp chốt"}</Criterion>
            </Criteria>
          </Section>
        </div>
      </div>
    </div>
  );
}
