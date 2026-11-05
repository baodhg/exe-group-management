import { describe, expect, it, vi } from "vitest";
import { importStudents, parseStudentCsv } from "./studentImport";

describe("parseStudentCsv", () => {
  it("reads the columns in any order, with quotes and semicolons", () => {
    const parsed = parseStudentCsv('majorCode;email;fullName;userCode\nse;an@fpt.edu.vn;"Nguyen, An";se180001\r\nai;binh@fpt.edu.vn;Tran Binh;se180002\n');

    expect(parsed.problems).toEqual([]);
    expect(parsed.rows).toEqual([
      { email: "an@fpt.edu.vn", fullName: "Nguyen, An", userCode: "SE180001", majorCode: "SE" },
      { email: "binh@fpt.edu.vn", fullName: "Tran Binh", userCode: "SE180002", majorCode: "AI" },
    ]);
  });

  it("reports missing columns, empty cells, bad emails and duplicates by line", () => {
    expect(parseStudentCsv("email,fullName\nan@x.vn,An").problems).toEqual(["Dòng đầu phải có các cột: email, fullName, userCode, majorCode."]);
    const parsed = parseStudentCsv("email,fullName,userCode,majorCode\nan@x.vn,An,SE1,SE\nnot-an-email,B,SE2,SE\nan@x.vn,An again,SE3,SE\nc@x.vn,,SE4,SE");

    expect(parsed.rows).toHaveLength(1);
    expect(parsed.problems).toEqual(['Dòng 3: email "not-an-email" không hợp lệ.', 'Dòng 4: email "an@x.vn" bị lặp.', "Dòng 5: thiếu dữ liệu."]);
  });
});

describe("importStudents", () => {
  it("creates accounts, adds them to the semester with their major and enrolls them", async () => {
    const post = vi.fn(async (path: string, body?: unknown) => {
      const data =
        path === "/api/v1/users/import"
          ? [
              { email: "an@fpt.edu.vn", userId: "u-an", created: true },
              { email: "binh@fpt.edu.vn", userId: "u-binh", created: false },
            ]
          : path.endsWith("/students") && path.startsWith("/api/v1/semesters")
            ? { added: 1, updated: 1 }
            : { enrolled: 2, alreadyEnrolled: 0 };
      return { data, message: "", traceId: null, body } as never;
    });

    const summary = await importStudents(
      { post },
      {
        semesterId: "s1",
        courseId: "c1",
        defaultPassword: "Secret#2026",
        majors: [
          { id: "m-se", code: "SE", name: "Software" },
          { id: "m-ai", code: "AI", name: "AI" },
        ],
        rows: [
          { email: "an@fpt.edu.vn", fullName: "An", userCode: "SE1", majorCode: "SE" },
          { email: "binh@fpt.edu.vn", fullName: "Binh", userCode: "SE2", majorCode: "AI" },
        ],
      },
    );

    expect(summary).toEqual({ accountsCreated: 1, accountsExisting: 1, addedToSemester: 1, updatedInSemester: 1, enrolled: 2, alreadyEnrolled: 0 });
    expect(post.mock.calls[1]).toEqual([
      "/api/v1/semesters/s1/students",
      {
        students: [
          { studentId: "u-an", studentCode: "SE1", fullName: "An", email: "an@fpt.edu.vn", majorId: "m-se" },
          { studentId: "u-binh", studentCode: "SE2", fullName: "Binh", email: "binh@fpt.edu.vn", majorId: "m-ai" },
        ],
      },
    ]);
    expect(post.mock.calls[2]).toEqual(["/api/v1/courses/c1/students", { studentIds: ["u-an", "u-binh"] }]);
  });

  it("stops before creating accounts when a major does not exist", async () => {
    const post = vi.fn();

    await expect(
      importStudents({ post }, { semesterId: "s1", courseId: "c1", defaultPassword: "x", majors: [], rows: [{ email: "a@x.vn", fullName: "A", userCode: "S1", majorCode: "IA" }] }),
    ).rejects.toThrow("Chưa có ngành: IA. Hãy tạo ngành trước.");
    expect(post).not.toHaveBeenCalled();
  });
});
