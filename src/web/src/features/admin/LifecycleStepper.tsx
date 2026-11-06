import type { Course, CoursePhase } from "../common/types";
import { Steps } from "../common/ui";
import { shortDateTime } from "../courses/overview";

const order: CoursePhase[] = ["Setup", "Published", "Expired", "Finalized"];

function stepsOf(course: Course) {
  return [
    { label: "Chuẩn bị", hint: `${course.studentCount} sinh viên, ${course.roomCount} phòng` },
    { label: "Chọn phòng", hint: course.publishAt ? `Mở ${shortDateTime(course.publishAt)}` : course.phase === "Setup" ? "Chưa hẹn giờ mở" : "Đã mở thủ công" },
    { label: "Xếp lại", hint: course.expireAt ? `Hạn ${shortDateTime(course.expireAt)}` : "Chưa đặt hạn" },
    { label: "Chốt nhóm", hint: course.finalizedAt ? `Chốt ${shortDateTime(course.finalizedAt)}` : "Danh sách chính thức" },
  ];
}

export function LifecycleStepper({ course, className }: { course: Course; className?: string }) {
  return (
    <div role="group" aria-label="Giai đoạn của lớp" className={className}>
      <Steps steps={stepsOf(course)} current={order.indexOf(course.phase)} allDone={course.phase === "Finalized"} />
    </div>
  );
}
