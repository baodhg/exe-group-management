import { describe, expect, it } from "vitest";
import type { Role } from "../auth/sessionStore";
import { adminCourseSection, courseSectionsFor, defaultCourseSection, initialsOf, navSections } from "./navigation";

describe("initialsOf", () => {
  it("takes the first and last word of a Vietnamese name", () => {
    expect(initialsOf("Nguyễn Văn An")).toBe("NA");
    expect(initialsOf("đặng thị ánh")).toBe("ĐÁ");
  });

  it("handles one word and empty names", () => {
    expect(initialsOf("Admin")).toBe("A");
    expect(initialsOf("  ")).toBe("?");
    expect(initialsOf(null, "U")).toBe("U");
  });
});

describe("course sections", () => {
  it("shows the sections each phase allows, first one as the default", () => {
    expect(courseSectionsFor("Setup")).toEqual(["settings", "roster", "rooms"]);
    expect(courseSectionsFor("Published")).toEqual(["overview", "settings", "roster", "rooms"]);
    expect(courseSectionsFor("Expired")).toEqual(["overview", "placement", "settings", "roster", "rooms"]);
    expect(courseSectionsFor("Finalized")).toEqual(["final", "overview", "roster"]);
    expect(defaultCourseSection("Setup")).toBe("settings");
    expect(defaultCourseSection("Finalized")).toBe("final");
  });

  it("links each section to the course for administrators", () => {
    const section = adminCourseSection("c1", "Expired", "SE1919");

    expect(section.title).toBe("Lớp SE1919");
    expect(section.roles).toEqual(["Administrator"]);
    expect(section.items.map((item) => item.to)).toContain("/admin/courses/c1/placement");
  });
});

describe("navSections", () => {
  const titlesFor = (role: Role) => navSections.filter((section) => section.roles.includes(role)).map((section) => section.title);

  it("groups the menu by role", () => {
    expect(titlesFor("Student")).toEqual(["Học tập"]);
    expect(titlesFor("Lecturer")).toEqual(["Lớp tôi dạy"]);
    expect(titlesFor("Administrator")).toEqual(["Vận hành", "Dữ liệu nền", "Hệ thống"]);
  });
});
