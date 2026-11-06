import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../../shared/api/apiClient";
import { courseLoadText, enrolPool, ImportStoppedError, importFailureOf, importStages, importStudents, overImportCap, parseStudentCsv, passwordProblem } from "./studentImport";

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

  const job = {
    semesterId: "s1",
    courseId: "c1",
    defaultPassword: "",
    majors: [{ id: "m-se", code: "SE", name: "Software" }],
    rows: [{ email: "an@fpt.edu.vn", fullName: "An", userCode: "SE1", majorCode: "SE" }],
  };
  const refused = new ApiError(409, "x", [{ code: "STUDENT_MAJOR_LOCKED", field: null, message: "" }], null);

  it("leaves the password out when none was typed, so existing accounts can be re-imported", async () => {
    const post = vi.fn(async (path: string) => ({
      data: path === "/api/v1/users/import" ? [{ email: "an@fpt.edu.vn", userId: "u-an", created: false }] : path.startsWith("/api/v1/semesters") ? { added: 0, updated: 1 } : { enrolled: 0, alreadyEnrolled: 1 },
      message: "",
      traceId: null,
    })) as never;

    await importStudents({ post }, job);

    expect((post as unknown as { mock: { calls: unknown[][] } }).mock.calls[0]?.[1]).toEqual({ defaultPassword: undefined, students: [{ email: "an@fpt.edu.vn", fullName: "An", userCode: "SE1" }] });
  });

  it("reports the semester step as refused and keeps what the accounts step did", async () => {
    const post = vi.fn(async (path: string) => {
      if (path === "/api/v1/users/import") {
        return { data: [{ email: "an@fpt.edu.vn", userId: "u-an", created: true }], message: "", traceId: null };
      }

      throw refused;
    }) as never;
    const stopped = await importStudents({ post }, job).catch((error: unknown) => error);

    expect(stopped).toBeInstanceOf(ImportStoppedError);
    expect(importStages(stopped as ImportStoppedError, "FA26", "SE1919")).toEqual([
      { label: "Tạo hoặc dùng lại tài khoản", state: "1 mới, 0 có sẵn", status: "done" },
      { label: "Thêm vào học kỳ FA26", state: "Bị từ chối", status: "failed" },
      { label: "Ghi danh vào lớp SE1919", state: "Chưa chạy", status: "waiting" },
    ]);
    expect((stopped as ImportStoppedError).cause).toBe(refused);
  });

  it("reports the enrol step as failed after the semester step went through", async () => {
    const post = vi.fn(async (path: string) => {
      if (path === "/api/v1/users/import") {
        return { data: [{ email: "an@fpt.edu.vn", userId: "u-an", created: false }], message: "", traceId: null };
      }

      if (path.startsWith("/api/v1/semesters")) {
        return { data: { added: 0, updated: 1 }, message: "", traceId: null };
      }

      throw refused;
    }) as never;
    const stopped = (await importStudents({ post }, job).catch((error: unknown) => error)) as ImportStoppedError;

    expect(importStages(stopped, "FA26", "SE1919")).toEqual([
      { label: "Tạo hoặc dùng lại tài khoản", state: "0 mới, 1 có sẵn", status: "done" },
      { label: "Thêm vào học kỳ FA26", state: "0 mới, 1 cập nhật", status: "done" },
      { label: "Ghi danh vào lớp SE1919", state: "Thất bại", status: "failed" },
    ]);
  });

  it("does not report steps when the accounts step itself failed", async () => {
    const post = vi.fn(async () => {
      throw refused;
    }) as never;

    await expect(importStudents({ post }, job)).rejects.toBe(refused);
  });
});

describe("importFailureOf", () => {
  it("names the new account that needs the password", () => {
    const error = new ApiError(400, "x", [{ code: "VALIDATION_FAILED", field: "defaultPassword", message: "New account sv51@fpt.edu.vn needs a password or a default password." }], null);

    expect(importFailureOf(error)).toMatchObject({ text: "Dữ liệu chưa hợp lệ.", passwordError: "Tài khoản mới sv51@fpt.edu.vn cần mật khẩu mặc định." });
  });

  it("names the code that belongs to another account", () => {
    const error = new ApiError(409, "x", [{ code: "USER_CODE_TAKEN", field: null, message: "Code 'HE190002' already belongs to another account." }], null);

    expect(importFailureOf(error)).toMatchObject({ text: "Mã người dùng đã tồn tại: HE190002.", passwordError: null });
  });

  it("says why a student cannot change major, and keeps a local message", () => {
    const locked = new ApiError(409, "x", [{ code: "STUDENT_MAJOR_LOCKED", field: null, message: "" }], null);

    expect(importFailureOf(new ImportStoppedError("semester", locked, { created: 1, existing: 0 }, null)).text).toBe("Sinh viên đã vào phòng trong học kỳ này nên không đổi được ngành.");
    expect(importFailureOf(new Error("Chưa có ngành: AI. Hãy tạo ngành trước."))).toEqual({ text: "Chưa có ngành: AI. Hãy tạo ngành trước.", trace: null, passwordError: null });
  });
});

describe("import limits", () => {
  it("caps a file at 1000 valid rows", () => {
    expect(overImportCap(1000)).toBe(false);
    expect(overImportCap(1001)).toBe(true);
  });

  it("allows an empty password and refuses one outside 8 to 100", () => {
    expect(passwordProblem("")).toBeNull();
    expect(passwordProblem("12345678")).toBeNull();
    expect(passwordProblem("1234567")).toBe("Mật khẩu từ 8 đến 100 ký tự.");
    expect(passwordProblem("x".repeat(101))).toBe("Mật khẩu từ 8 đến 100 ký tự.");
  });
});

describe("enrolPool", () => {
  const students = [
    { studentId: "a", studentCode: "HE1", fullName: "Đào Mai", email: "mai@x.vn", majorId: "m", majorCode: "SE", majorName: "SE", addedAt: "", courseCount: 1 },
    { studentId: "b", studentCode: "HE2", fullName: "Kim Oanh", email: "oanh@x.vn", majorId: "m", majorCode: "MKT", majorName: "MKT", addedAt: "", courseCount: 0 },
  ];

  it("leaves out students already in the course", () => {
    expect(enrolPool(students, new Set(["a"]), "").map((student) => student.studentId)).toEqual(["b"]);
  });

  it("searches by code, name or email without marks", () => {
    expect(enrolPool(students, new Set(), "dao mai").map((student) => student.studentId)).toEqual(["a"]);
    expect(enrolPool(students, new Set(), "HE2").map((student) => student.studentId)).toEqual(["b"]);
    expect(enrolPool(students, new Set(), "oanh@").map((student) => student.studentId)).toEqual(["b"]);
  });

  it("describes how many courses a student already has", () => {
    expect(courseLoadText(0)).toBe("Chưa ở lớp nào");
    expect(courseLoadText(2)).toBe("Đang học 2 lớp");
  });
});
