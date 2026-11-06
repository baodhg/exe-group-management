import { describe, expect, it } from "vitest";
import type { Course } from "../common/types";
import { adminTodos } from "./adminTodos";

const base: Course = {
  id: "c",
  semesterId: "s",
  semesterCode: "FA26",
  subjectId: "x",
  subjectCode: "EXE201",
  subjectName: "Experiential Entrepreneurship 2",
  classCode: "SE1801",
  lecturerId: null,
  lecturerName: null,
  minGroupSize: 4,
  maxGroupSize: 6,
  roomFactor: 1.2,
  phase: "Setup",
  publishAt: null,
  expireAt: "2026-11-20T10:00:00Z",
  finalizedAt: null,
  studentCount: 30,
  roomCount: 6,
};

describe("adminTodos", () => {
  const now = Date.parse("2026-11-06T10:00:00Z");

  it("asks for the next setup step in order", () => {
    expect(adminTodos([{ ...base, studentCount: 0, roomCount: 0 }], now)[0]).toMatchObject({ action: "Chưa có sinh viên: nhập danh sách lớp", section: "roster" });
    expect(adminTodos([{ ...base, roomCount: 0 }], now)[0]).toMatchObject({ action: "Chưa có phòng: sinh phòng", section: "settings" });
    expect(adminTodos([base], now)[0]).toMatchObject({ action: "Đã sẵn sàng: mở tìm nhóm hoặc hẹn giờ mở", section: "settings" });
    expect(adminTodos([{ ...base, publishAt: "2026-11-07T00:00:00Z" }], now)).toEqual([]);
  });

  it("puts expired courses and close deadlines first", () => {
    const todos = adminTodos(
      [
        { ...base, id: "setup", roomCount: 0 },
        { ...base, id: "soon", phase: "Published", expireAt: "2026-11-07T10:00:00Z" },
        { ...base, id: "later", phase: "Published", expireAt: "2026-11-15T10:00:00Z" },
        { ...base, id: "expired", phase: "Expired" },
        { ...base, id: "done", phase: "Finalized" },
      ],
      now,
    );

    expect(todos.map((todo) => todo.course.id)).toEqual(["soon", "expired", "setup"]);
    expect(todos[0]).toMatchObject({ action: "Sắp hết hạn tìm nhóm (còn 24 giờ)", section: "overview" });
    expect(todos[1]).toMatchObject({ section: "placement" });
  });
});
