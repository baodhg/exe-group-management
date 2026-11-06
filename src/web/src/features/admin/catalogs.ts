export interface CatalogConfig {
  resource: "subjects" | "majors" | "skills";
  title: string;
  unit: string;
  codeHint: string;
  description: string;
}

export const catalogs = {
  subjects: { resource: "subjects", title: "Môn học", unit: "môn", codeHint: "VD: PRN232", description: "Các môn làm dự án theo nhóm. Mỗi course là một môn của một lớp." },
  majors: {
    resource: "majors",
    title: "Ngành",
    unit: "ngành",
    codeHint: "VD: SE, AI, GD",
    description: "Ngành của sinh viên. Màu của mỗi ngành dùng chung trên bảng phòng, theo thứ tự mã ngành.",
  },
  skills: { resource: "skills", title: "Skill", unit: "skill", codeHint: "VD: BE, FE, UI", description: "Sinh viên tự chấm các skill này từ 1 đến 5 để hệ thống gợi ý phòng." },
} as const satisfies Record<string, CatalogConfig>;
