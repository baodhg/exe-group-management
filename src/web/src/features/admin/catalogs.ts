export interface CatalogConfig {
  resource: "subjects" | "majors" | "skills";
  title: string;
  unit: string;
  codeHint: string;
}

export const catalogs = {
  subjects: { resource: "subjects", title: "Môn học", unit: "môn", codeHint: "VD: PRN232" },
  majors: { resource: "majors", title: "Ngành", unit: "ngành", codeHint: "VD: SE, AI, GD" },
  skills: { resource: "skills", title: "Skill", unit: "skill", codeHint: "VD: BE, FE, UI" },
} as const satisfies Record<string, CatalogConfig>;
