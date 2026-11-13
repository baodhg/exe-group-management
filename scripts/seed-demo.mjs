#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const envFile = join(dirname(fileURLToPath(import.meta.url)), "..", ".env");
const fileEnv = existsSync(envFile)
  ? Object.fromEntries(
      readFileSync(envFile, "utf8")
        .split(/\r?\n/)
        .filter((line) => line.includes("=") && !line.trimStart().startsWith("#"))
        .map((line) => [line.slice(0, line.indexOf("=")).trim(), line.slice(line.indexOf("=") + 1).trim()]),
    )
  : {};
const setting = (name, fallback) => process.env[name] ?? fileEnv[name] ?? fallback;
const rateSkills = !process.argv.includes("--no-skills");
const seedOnce = process.argv.includes("--once");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const gateway = setting("SEED_GATEWAY_URL", `http://localhost:${setting("GATEWAY_HOST_PORT", "8080")}`);
const adminEmail = setting("SEED_ADMIN_EMAIL");
const adminPassword = setting("SEED_ADMIN_PASSWORD");
const demoPassword = setting("SEED_DEMO_PASSWORD");
if (!adminEmail || !adminPassword || !demoPassword) {
  console.error("Set SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD and SEED_DEMO_PASSWORD (env or .env), then start the stack with docker compose up -d.");
  process.exit(1);
}

const semester = { code: "FA26", name: "Fall 2026", startDate: "2026-09-07", endDate: "2026-12-26" };
const subjects = [
  { code: "EXE101", name: "Experiential Entrepreneurship 1" },
  { code: "EXE201", name: "Experiential Entrepreneurship 2" },
];
const majors = [
  { code: "SE", name: "Software Engineering" },
  { code: "GD", name: "Graphic Design" },
  { code: "MKT", name: "Digital Marketing" },
  { code: "IB", name: "International Business" },
];
const skills = [
  { code: "PROG", name: "Programming" },
  { code: "DESIGN", name: "Design" },
  { code: "MKT", name: "Marketing" },
  { code: "MGMT", name: "Management" },
];
const groupType = { code: "EXE", name: "EXE startup team", minDistinctMajors: 2, minimums: { SE: 1, MKT: 1 } };
const lecturer = { email: "lecturer@fpt.edu.vn", fullName: "Nguyen Thi Lan", userCode: "LANNT" };
const course = { classCode: "SE1919", subject: "EXE101", minGroupSize: 4, maxGroupSize: 6, roomFactor: 1.2 };
const majorPlan = [...Array(12).fill("SE"), ...Array(6).fill("GD"), ...Array(6).fill("MKT"), ...Array(6).fill("IB")];
const familyNames = ["Nguyen", "Tran", "Le", "Pham", "Hoang", "Vo", "Dang", "Bui", "Do", "Ngo"];
const givenNames = ["An", "Binh", "Chi", "Dung", "Giang", "Hieu", "Khanh", "Linh", "Minh", "Nam", "Phuong", "Quan", "Son", "Trang", "Uyen"];
const strengths = { SE: { PROG: 4, MGMT: 2 }, GD: { DESIGN: 4, MKT: 2 }, MKT: { MKT: 4, MGMT: 3 }, IB: { MGMT: 4, MKT: 3 } };
const students = majorPlan.map((major, index) => {
  const number = String(index + 1).padStart(2, "0");
  return {
    email: `sv${number}@fpt.edu.vn`,
    fullName: `${familyNames[index % familyNames.length]} ${givenNames[index % givenNames.length]}`,
    userCode: `HE1900${number}`,
    major,
    level: 3 + (index % 3) - 1,
  };
});

async function call(token, method, path, body, attempt = 1) {
  const response = await fetch(`${gateway}${path}`, {
    method,
    headers: { Accept: "application/json", "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (response.status === 429 && attempt <= 5) {
    const seconds = Number(response.headers.get("Retry-After")) || 61;
    console.log(`The gateway limits sign-ins; waiting ${seconds} s…`);
    await sleep(seconds * 1000);
    return call(token, method, path, body, attempt + 1);
  }

  const text = await response.text();
  const envelope = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const error = envelope?.errors?.[0];
    throw new Error(`${method} ${path} -> ${response.status} ${error?.code ?? ""} ${error?.message ?? envelope?.message ?? ""}`.trim());
  }

  return envelope?.data;
}

async function signIn(email, password) {
  return (await call(null, "POST", "/api/v1/auth/login", { email, password })).accessToken;
}

async function ensureByCode(token, resource, item, create = item) {
  const found = (await call(token, "GET", `/api/v1/${resource}?search=${encodeURIComponent(item.code)}&pageSize=100`)).find((existing) => existing.code === item.code);
  if (found) {
    return { item: found, created: false };
  }

  return { item: await call(token, "POST", `/api/v1/${resource}`, create), created: true };
}

const counts = { created: 0, kept: 0 };
const note = ({ created }) => (created ? counts.created++ : counts.kept++);

const admin = await signIn(adminEmail, adminPassword);

if (seedOnce) {
  const seeded = (await call(admin, "GET", `/api/v1/semesters?search=${encodeURIComponent(semester.code)}&pageSize=100`)).some((existing) => existing.code === semester.code);
  if (seeded) {
    console.log(`Seed skipped: semester ${semester.code} is already at ${gateway}, so its data was left as it is.`);
    process.exit(0);
  }
}

const fa26 = await ensureByCode(admin, "semesters", semester);
note(fa26);
const subjectIds = {};
for (const subject of subjects) {
  const result = await ensureByCode(admin, "subjects", subject);
  note(result);
  subjectIds[subject.code] = result.item.id;
}

const majorIds = {};
for (const major of majors) {
  const result = await ensureByCode(admin, "majors", major);
  note(result);
  majorIds[major.code] = result.item.id;
}

const skillIds = {};
for (const skill of skills) {
  const result = await ensureByCode(admin, "skills", skill);
  note(result);
  skillIds[skill.code] = result.item.id;
}

const exe = await ensureByCode(admin, "group-types", groupType, { code: groupType.code, name: groupType.name, minDistinctMajors: groupType.minDistinctMajors });
note(exe);
await call(
  admin,
  "PUT",
  `/api/v1/group-types/${exe.item.id}/majors`,
  Object.entries(groupType.minimums).map(([code, minMembers]) => ({ majorId: majorIds[code], minMembers })),
);
const allowed = await call(admin, "GET", `/api/v1/semesters/${fa26.item.id}/group-types`);
if (!allowed.some((item) => item.id === exe.item.id)) {
  await call(admin, "PUT", `/api/v1/semesters/${fa26.item.id}/group-types`, { groupTypeIds: [...allowed.map((item) => item.id), exe.item.id] });
}

let lecturerUser = (await call(admin, "GET", `/api/v1/users?search=${encodeURIComponent(lecturer.email)}&role=Lecturer`)).find((user) => user.email === lecturer.email);
if (lecturerUser) {
  counts.kept++;
} else {
  lecturerUser = await call(admin, "POST", "/api/v1/users", { ...lecturer, password: demoPassword, roles: ["Lecturer"] });
  counts.created++;
}

const accounts = await call(admin, "POST", "/api/v1/users/import", {
  defaultPassword: demoPassword,
  students: students.map(({ email, fullName, userCode }) => ({ email, fullName, userCode })),
});
const accountIds = new Map(accounts.map((account) => [account.email.toLowerCase(), account.userId]));
const newAccounts = accounts.filter((account) => account.created).length;
await call(admin, "POST", `/api/v1/semesters/${fa26.item.id}/students`, {
  students: students.map((student) => ({
    studentId: accountIds.get(student.email),
    studentCode: student.userCode,
    fullName: student.fullName,
    email: student.email,
    majorId: majorIds[student.major],
  })),
});

const subjectId = subjectIds[course.subject];
let exe101 = (await call(admin, "GET", `/api/v1/courses?semesterId=${fa26.item.id}&subjectId=${subjectId}&search=${course.classCode}`)).find((item) => item.classCode === course.classCode);
if (exe101) {
  counts.kept++;
} else {
  exe101 = await call(admin, "POST", "/api/v1/courses", {
    semesterId: fa26.item.id,
    subjectId,
    classCode: course.classCode,
    lecturerId: lecturerUser.id,
    lecturerName: lecturerUser.fullName,
    minGroupSize: course.minGroupSize,
    maxGroupSize: course.maxGroupSize,
    roomFactor: course.roomFactor,
  });
  counts.created++;
}

const enrollment = await call(admin, "POST", `/api/v1/courses/${exe101.id}/students`, { studentIds: students.map((student) => accountIds.get(student.email)) });

let rated = 0;
for (const student of rateSkills ? students : []) {
  try {
    const token = await signIn(student.email, demoPassword);
    const ratings = Object.entries(strengths[student.major]).map(([code, level]) => ({ skillId: skillIds[code], level: Math.min(5, Math.max(1, level + student.level - 3)) }));
    await call(token, "PUT", `/api/v1/semesters/${fa26.item.id}/students/me/skills`, ratings);
    rated++;
  } catch (error) {
    console.warn(`Skipped the skills of ${student.email}: ${error.message}`);
  }
}

console.log(`Seed done at ${gateway}`);
console.log(`- catalog and accounts: ${counts.created} created, ${counts.kept} already there`);
console.log(`- students: ${students.length} (${newAccounts} new accounts), enrolled ${enrollment.enrolled} new, ${enrollment.alreadyEnrolled} already enrolled, ${rated} rated their skills`);
console.log(`- course ${course.subject} – ${course.classCode} (${exe101.phase}): /admin/courses/${exe101.id}`);
console.log(`- sign in: ${adminEmail} (admin), ${lecturer.email} (lecturer), sv01..sv30@fpt.edu.vn (students); lecturer and students use SEED_DEMO_PASSWORD`);
