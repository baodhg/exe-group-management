export interface DayGroup<T> {
  label: string;
  items: T[];
}

export function groupByDay<T extends { createdAt: string }>(items: readonly T[], now: number): DayGroup<T>[] {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const midnight = today.getTime();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const dayBefore = yesterday.getTime();
  const momentOf = (item: T) => new Date(item.createdAt).getTime();

  return [
    { label: "Hôm nay", items: items.filter((item) => momentOf(item) >= midnight) },
    { label: "Hôm qua", items: items.filter((item) => momentOf(item) < midnight && momentOf(item) >= dayBefore) },
    { label: "Trước đó", items: items.filter((item) => momentOf(item) < dayBefore) },
  ].filter((group) => group.items.length > 0);
}

export function notificationAction(notification: { roomId?: string | null; courseId?: string | null }): string | null {
  if (notification.roomId) {
    return "Xem phòng";
  }

  return notification.courseId ? "Xem lớp" : null;
}

export function onlyAdministrator(roles: readonly string[]): boolean {
  return roles.length > 0 && roles.every((role) => role === "Administrator");
}

export function notificationsIntro(roles: readonly string[]): string {
  if (onlyAdministrator(roles)) {
    return "Thông báo gửi cho sinh viên, trưởng nhóm và giảng viên.";
  }

  if (roles.includes("Student")) {
    return "Kết quả đơn xin vào phòng, thay đổi phòng của bạn và các mốc của lớp.";
  }

  return "Giảng viên nhận thông báo khi lớp mình dạy đã chốt nhóm.";
}
