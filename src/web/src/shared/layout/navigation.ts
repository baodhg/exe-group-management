import { Award, Bell, Blocks, BookMarked, CalendarRange, DoorOpen, Flag, GraduationCap, House, Inbox, LayoutGrid, Library, MessageSquare, Shapes, SlidersHorizontal, Sparkles, UsersRound, type LucideIcon } from "lucide-react";
import type { Role } from "../auth/sessionStore";

export type CoursePhaseName = "Setup" | "Published" | "Expired" | "Finalized";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  count?: number;
}

export interface NavSection {
  title: string;
  roles: Role[];
  items: NavItem[];
}

export const navSections: NavSection[] = [
  {
    title: "Học tập",
    roles: ["Student"],
    items: [
      { to: "/student", label: "Lớp của tôi", icon: GraduationCap, end: true },
      { to: "/student/applications", label: "Đơn của tôi", icon: Inbox },
      { to: "/conversations", label: "Trò chuyện", icon: MessageSquare },
    ],
  },
  { title: "Lớp tôi dạy", roles: ["Lecturer"], items: [{ to: "/lecturer", label: "Các lớp", icon: GraduationCap, end: true }] },
  {
    title: "Vận hành",
    roles: ["Administrator"],
    items: [
      { to: "/admin", label: "Tổng quan", icon: House, end: true },
      { to: "/admin/courses", label: "Các lớp", icon: GraduationCap, end: true },
    ],
  },
  {
    title: "Dữ liệu nền",
    roles: ["Administrator"],
    items: [
      { to: "/admin/semesters", label: "Học kỳ", icon: CalendarRange },
      { to: "/admin/subjects", label: "Môn học", icon: Library },
      { to: "/admin/majors", label: "Ngành", icon: BookMarked },
      { to: "/admin/skills", label: "Kỹ năng", icon: Sparkles },
      { to: "/admin/group-types", label: "Loại nhóm", icon: Blocks },
    ],
  },
  { title: "Hệ thống", roles: ["Administrator"], items: [{ to: "/admin/users", label: "Tài khoản", icon: UsersRound }] },
];

export const notificationsItem: NavItem = { to: "/notifications", label: "Thông báo", icon: Bell };

const courseSections: Record<string, { label: string; icon: LucideIcon }> = {
  settings: { label: "Thiết lập lớp", icon: SlidersHorizontal },
  roster: { label: "Sinh viên", icon: UsersRound },
  rooms: { label: "Phòng", icon: DoorOpen },
  overview: { label: "Điều phối", icon: LayoutGrid },
  placement: { label: "Xếp và chốt nhóm", icon: Flag },
  final: { label: "Nhóm chính thức", icon: Award },
};

const sectionsByPhase: Record<CoursePhaseName, string[]> = {
  Setup: ["settings", "roster", "rooms"],
  Published: ["overview", "settings", "roster", "rooms"],
  Expired: ["overview", "placement", "settings", "roster", "rooms"],
  Finalized: ["final", "overview", "roster"],
};

export function courseSectionsFor(phase: CoursePhaseName): string[] {
  return sectionsByPhase[phase];
}

export function defaultCourseSection(phase: CoursePhaseName): string {
  return sectionsByPhase[phase][0] ?? "settings";
}

export function adminCourseSection(courseId: string, phase: CoursePhaseName, classCode: string): NavSection {
  return {
    title: `Lớp ${classCode}`,
    roles: ["Administrator"],
    items: sectionsByPhase[phase].map((key) => {
      const section = courseSections[key] ?? { label: key, icon: Shapes };
      return { to: `/admin/courses/${courseId}/${key}`, label: section.label, icon: section.icon };
    }),
  };
}

export const roleLabels: Record<Role, string> = {
  Student: "Sinh viên",
  Lecturer: "Giảng viên",
  Administrator: "Giáo vụ",
};

export function initialsOf(name: string | null | undefined, fallback = "?"): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return fallback;
  }

  const first = words[0]?.[0] ?? "";
  const last = words.length > 1 ? (words.at(-1)?.[0] ?? "") : "";
  return `${first}${last}`.toLocaleUpperCase("vi-VN");
}
