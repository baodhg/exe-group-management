import { deadlineInfo } from "../common/messages";
import type { Course } from "../common/types";

export interface AdminTodo {
  course: Course;
  action: string;
  urgent: boolean;
}

export function adminTodos(courses: readonly Course[], now: number = Date.now()): AdminTodo[] {
  const todos: AdminTodo[] = [];
  for (const course of courses) {
    if (course.phase === "Expired") {
      todos.push({ course, action: "Đã hết hạn: xếp người còn lại rồi chốt nhóm", urgent: true });
    } else if (course.phase === "Setup" && course.studentCount === 0) {
      todos.push({ course, action: "Chưa có sinh viên: import danh sách lớp", urgent: false });
    } else if (course.phase === "Setup" && course.roomCount === 0) {
      todos.push({ course, action: "Chưa có phòng: sinh phòng", urgent: false });
    } else if (course.phase === "Setup" && course.publishAt === null) {
      todos.push({ course, action: "Đã sẵn sàng: mở tìm nhóm hoặc hẹn giờ mở", urgent: false });
    } else if (course.phase === "Published") {
      const deadline = deadlineInfo(course.expireAt, now);
      if (deadline?.urgent) {
        todos.push({ course, action: `Sắp hết hạn tìm nhóm (${deadline.text.toLowerCase()})`, urgent: true });
      }
    }
  }

  return todos.sort((first, second) => Number(second.urgent) - Number(first.urgent));
}
