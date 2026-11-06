import { describe, expect, it } from "vitest";
import { groupByDay, notificationAction, notificationsIntro, onlyAdministrator } from "./notificationList";

const now = new Date(2026, 10, 13, 16, 0).getTime();
const at = (day: number, hour = 9) => ({ id: `${day}-${hour}`, createdAt: new Date(2026, 10, day, hour).toISOString() });

describe("notification list", () => {
  it("groups rows into today, yesterday and earlier by local midnight", () => {
    const groups = groupByDay([at(13, 15), at(13, 0), at(12, 23), at(12, 0), at(11, 23)], now);

    expect(groups.map((group) => [group.label, group.items.length])).toEqual([
      ["Hôm nay", 2],
      ["Hôm qua", 2],
      ["Trước đó", 1],
    ]);
  });

  it("leaves out groups with no rows", () => {
    expect(groupByDay([at(5)], now).map((group) => group.label)).toEqual(["Trước đó"]);
    expect(groupByDay([], now)).toEqual([]);
  });

  it("names the action from what the notification points to", () => {
    expect(notificationAction({ roomId: "r", courseId: "c" })).toBe("Xem phòng");
    expect(notificationAction({ roomId: null, courseId: "c" })).toBe("Xem lớp");
    expect(notificationAction({ roomId: null, courseId: null })).toBeNull();
    expect(notificationAction({})).toBeNull();
  });

  it("recognizes an account that only has the administrator role", () => {
    expect(onlyAdministrator(["Administrator"])).toBe(true);
    expect(onlyAdministrator(["Lecturer", "Administrator"])).toBe(false);
    expect(onlyAdministrator(["Student"])).toBe(false);
    expect(onlyAdministrator([])).toBe(false);
  });

  it("explains the list by the roles of the reader", () => {
    expect(notificationsIntro(["Administrator"])).toBe("Thông báo gửi cho sinh viên, trưởng nhóm và giảng viên.");
    expect(notificationsIntro(["Lecturer"])).toBe("Giảng viên nhận thông báo khi lớp mình dạy đã chốt nhóm.");
    expect(notificationsIntro(["Lecturer", "Student"])).toBe("Kết quả đơn xin vào phòng, thay đổi phòng của bạn và các mốc của lớp.");
    expect(notificationsIntro(["Student"])).toBe("Kết quả đơn xin vào phòng, thay đổi phòng của bạn và các mốc của lớp.");
  });
});
