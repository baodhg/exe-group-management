import { BookMarked, Library, Sparkles, type LucideIcon } from "lucide-react";

export interface CatalogConfig {
  resource: "subjects" | "majors" | "skills";
  title: string;
  unit: string;
  listTitle: string;
  icon: LucideIcon;
  codeHint: string;
  codeMax: number;
  nameMax: number;
  takenCode: string;
  description: string;
  blockers: readonly string[];
}

export const catalogs = {
  subjects: {
    resource: "subjects",
    title: "Môn học",
    unit: "môn",
    listTitle: "Danh sách môn",
    icon: Library,
    codeHint: "VD: PRN232",
    codeMax: 20,
    nameMax: 150,
    takenCode: "SUBJECT_CODE_TAKEN",
    description: "Các môn làm dự án theo nhóm. Mỗi lớp thuộc một môn.",
    blockers: ["Lớp thuộc môn này"],
  },
  majors: {
    resource: "majors",
    title: "Ngành",
    unit: "ngành",
    listTitle: "Danh sách ngành",
    icon: BookMarked,
    codeHint: "VD: SE, AI, GD",
    codeMax: 10,
    nameMax: 100,
    takenCode: "MAJOR_CODE_TAKEN",
    description: "Ngành của sinh viên. Nhãn của mỗi ngành dùng chung trên bảng phòng.",
    blockers: ["Sinh viên thuộc ngành", "Loại nhóm yêu cầu ngành"],
  },
  skills: {
    resource: "skills",
    title: "Kỹ năng",
    unit: "kỹ năng",
    listTitle: "Danh sách kỹ năng",
    icon: Sparkles,
    codeHint: "VD: BE, FE, UI",
    codeMax: 20,
    nameMax: 100,
    takenCode: "SKILL_CODE_TAKEN",
    description: "Sinh viên tự chấm các kỹ năng này từ 1 đến 5 để hệ thống gợi ý phòng.",
    blockers: ["Sinh viên đã chấm kỹ năng này"],
  },
} as const satisfies Record<string, CatalogConfig>;
