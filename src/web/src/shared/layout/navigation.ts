import { Bell, BookOpen, CalendarRange, Blocks, GraduationCap, LayoutDashboard, Library, Shapes, Sparkles, UsersRound, type LucideIcon } from "lucide-react";
import type { Role } from "../auth/sessionStore";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

export interface NavSection {
  title: string;
  roles: Role[];
  items: NavItem[];
}

export const navSections: NavSection[] = [
  { title: "Sinh viên", roles: ["Student"], items: [{ to: "/student", label: "Course của tôi", icon: BookOpen }] },
  { title: "Giảng viên", roles: ["Lecturer"], items: [{ to: "/lecturer", label: "Course giảng dạy", icon: GraduationCap }] },
  {
    title: "Vận hành",
    roles: ["Administrator"],
    items: [
      { to: "/admin", label: "Tổng quan", icon: LayoutDashboard, end: true },
      { to: "/admin/courses", label: "Course", icon: BookOpen },
    ],
  },
  {
    title: "Dữ liệu nền",
    roles: ["Administrator"],
    items: [
      { to: "/admin/semesters", label: "Học kỳ", icon: CalendarRange },
      { to: "/admin/subjects", label: "Môn học", icon: Library },
      { to: "/admin/majors", label: "Ngành", icon: Shapes },
      { to: "/admin/skills", label: "Skill", icon: Sparkles },
      { to: "/admin/group-types", label: "Loại nhóm", icon: Blocks },
    ],
  },
  { title: "Hệ thống", roles: ["Administrator"], items: [{ to: "/admin/users", label: "Tài khoản", icon: UsersRound }] },
  { title: "Cá nhân", roles: ["Student", "Lecturer", "Administrator"], items: [{ to: "/notifications", label: "Thông báo", icon: Bell }] },
];

export const roleLabels: Record<Role, string> = {
  Student: "Sinh viên",
  Lecturer: "Giảng viên",
  Administrator: "Quản trị viên",
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
