#!/usr/bin/env node
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const envFile = join(repo, ".env");
const fileEnv = existsSync(envFile)
  ? Object.fromEntries(
      readFileSync(envFile, "utf8")
        .split(/\r?\n/)
        .filter((line) => line.includes("=") && !line.trimStart().startsWith("#"))
        .map((line) => [line.slice(0, line.indexOf("=")).trim(), line.slice(line.indexOf("=") + 1).trim()]),
    )
  : {};
const env = { ...fileEnv, ...process.env };
const base = env.SEED_GATEWAY_URL ?? `http://localhost:${env.GATEWAY_HOST_PORT || 8080}`;
const require = createRequire(join(repo, "src", "web", "package.json"));
const signalR = require("@microsoft/signalr");

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const tag = randomBytes(3).toString("hex").toUpperCase();
const password = `E2e#${randomBytes(6).toString("base64url")}9a`;

async function call(token, method, path, body) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { "Content-Type": "application/json", Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), "X-Correlation-ID": `e2e-${tag}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  const json = text ? JSON.parse(text) : null;
  return { status: response.status, data: json?.data, json };
}

async function must(token, method, path, body, expected = [200, 201, 204]) {
  const result = await call(token, method, path, body);
  if (!expected.includes(result.status)) {
    throw new Error(`${method} ${path} -> ${result.status} ${JSON.stringify(result.json?.errors ?? result.json)}`);
  }
  return result.data;
}

const login = async (email, secret) => (await must(null, "POST", "/api/v1/auth/login", { email, password: secret })).accessToken;

async function poll(what, fn, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const value = await fn();
    if (value) return value;
    await sleep(500);
  }
  throw new Error(`timed out waiting for ${what}`);
}

try {
  const health = await fetch(`${base}/health/ready`).then((r) => r.status).catch(() => 0);
  check("gateway is ready", health === 200, `status ${health}`);
  const admin = await login(env.SEED_ADMIN_EMAIL, env.SEED_ADMIN_PASSWORD);
  check("administrator signs in", Boolean(admin));

  const semesterCode = `SU${String(Math.floor(Math.random() * 90) + 10)}`;
  const existing = (await must(admin, "GET", `/api/v1/semesters?search=${semesterCode}`)).find((item) => item.code === semesterCode);
  const semester = existing ?? (await must(admin, "POST", "/api/v1/semesters", { code: semesterCode, name: `E2E ${tag}`, startDate: "2026-06-01", endDate: "2026-08-31" }));
  const subject = await must(admin, "POST", "/api/v1/subjects", { code: `S${tag}`, name: "E2E subject" });
  const se = await must(admin, "POST", "/api/v1/majors", { code: `SE${tag}`, name: "Software Engineering" });
  const ai = await must(admin, "POST", "/api/v1/majors", { code: `AI${tag}`, name: "Artificial Intelligence" });
  const backend = await must(admin, "POST", "/api/v1/skills", { code: `BE${tag}`, name: "Back end" });
  const groupType = await must(admin, "POST", "/api/v1/group-types", { code: `G${tag}`, name: "E2E group", minDistinctMajors: 2 });
  await must(admin, "PUT", `/api/v1/group-types/${groupType.id}/majors`, [{ majorId: ai.id, minMembers: 1 }]);
  const allowedBefore = await must(admin, "GET", `/api/v1/semesters/${semester.id}/group-types`);
  await must(admin, "PUT", `/api/v1/semesters/${semester.id}/group-types`, { groupTypeIds: [...allowedBefore.map((item) => item.id), groupType.id] });
  check("catalog, group type and semester allowance are set up", true);

  const lecturerEmail = `lect.${tag.toLowerCase()}@e2e.vn`;
  const lecturerUser = await must(admin, "POST", "/api/v1/users", { email: lecturerEmail, fullName: "E2E Lecturer", password, roles: ["Lecturer"] });
  const course = await must(admin, "POST", "/api/v1/courses", {
    semesterId: semester.id, subjectId: subject.id, classCode: `C${tag}`, lecturerId: lecturerUser.id, lecturerName: lecturerUser.fullName,
    minGroupSize: 2, maxGroupSize: 3, roomFactor: 1.2, expireAt: new Date(Date.now() + 3600_000).toISOString(),
  });
  const people = [
    { code: `${tag}01`, major: se }, { code: `${tag}02`, major: ai }, { code: `${tag}03`, major: se },
    { code: `${tag}04`, major: se }, { code: `${tag}05`, major: ai }, { code: `${tag}06`, major: se },
  ].map((person, index) => ({ ...person, email: `st${index + 1}.${tag.toLowerCase()}@e2e.vn`, fullName: `Student ${index + 1}` }));
  const accounts = await must(admin, "POST", "/api/v1/users/import", { defaultPassword: password, students: people.map(({ email, fullName, code }) => ({ email, fullName, userCode: code })) });
  const ids = new Map(accounts.map((account) => [account.email.toLowerCase(), account.userId]));
  people.forEach((person) => (person.id = ids.get(person.email)));
  await must(admin, "POST", `/api/v1/semesters/${semester.id}/students`, { students: people.map((p) => ({ studentId: p.id, studentCode: p.code, fullName: p.fullName, email: p.email, majorId: p.major.id })) });
  const enrollment = await must(admin, "POST", `/api/v1/courses/${course.id}/students`, { studentIds: people.map((p) => p.id) });
  check("CSV-like import creates accounts, semester students and enrollment", enrollment.enrolled === 6, JSON.stringify(enrollment));

  const generated = await must(admin, "POST", `/api/v1/courses/${course.id}/rooms/generate`, { groupTypeId: groupType.id });
  check("rooms are generated by BR-03", generated.target === 3 && generated.rooms[0].name === "Room 01", `target ${generated.target}`);
  const published = await must(admin, "POST", `/api/v1/courses/${course.id}/publish`);
  check("course is published", published.phase === "Published");

  const tokens = await Promise.all(people.map((p) => login(p.email, password)));
  const [t1, t2, t3, t4] = tokens;
  await must(t1, "PUT", `/api/v1/semesters/${semester.id}/students/me/skills`, [{ skillId: backend.id, level: 4 }]);
  const room1 = generated.rooms[0].id;
  const room2 = generated.rooms[1].id;

  const hubUrl = `${base}/hubs/realtime`;
  const received = [];
  const hub2 = new signalR.HubConnectionBuilder().withUrl(hubUrl, { accessTokenFactory: () => t2 }).configureLogging(signalR.LogLevel.None).build();
  hub2.on("messageReceived", (message) => received.push(["message", message]));
  hub2.on("notificationReceived", (notification) => received.push(["notification", notification]));
  await hub2.start();
  check("SignalR connects through the gateway with access_token", hub2.state === "Connected");
  const hub1 = new signalR.HubConnectionBuilder().withUrl(hubUrl, { accessTokenFactory: () => t1 }).configureLogging(signalR.LogLevel.None).build();
  const boardChanges = [];
  hub1.on("roomChanged", (change) => boardChanges.push(change));
  await hub1.start();
  await hub1.invoke("watchCourse", course.id);

  const joined = await must(t1, "POST", `/api/v1/rooms/${room1}/join`);
  check("student 1 joins Room 01 and leads it", joined.leaderId === people[0].id);
  await must(t1, "POST", `/api/v1/rooms/${room1}/lock`);
  const blocked = await call(t3, "POST", `/api/v1/rooms/${room1}/join`);
  check("a locked room refuses direct joins", blocked.status === 409 && blocked.json.errors[0].code === "ROOM_LOCKED");
  const application = await must(t2, "POST", "/api/v1/join-requests", { roomId: room1, message: "I bring AI" });
  const pending = await must(t1, "GET", `/api/v1/join-requests?roomId=${room1}&status=Pending`);
  check("leader sees the application with major and skills", pending.length === 1 && pending[0].majorCode === ai.code, pending[0]?.majorCode);
  const approved = await must(t1, "POST", `/api/v1/join-requests/${application.id}/approve`);
  check("approval answers 200 with the new status at once", approved.status === "Approved");

  const suggestions = await must(t3, "GET", `/api/v1/courses/${course.id}/rooms/suggestions?top=3`);
  check("room suggestions come ranked over gRPC", suggestions.ranked === true && suggestions.rooms.length > 0, `ranked=${suggestions.ranked}, ${suggestions.rooms.length} rooms`);
  await must(t3, "POST", `/api/v1/rooms/${room2}/join`);
  const mine = await must(t3, "GET", `/api/v1/courses/${course.id}/rooms?mine=true`);
  check("mine=true finds my room", mine.length === 1 && mine[0].id === room2);

  await poll("room chat", async () => (await call(t1, "GET", `/api/v1/conversations/${room1}/messages`)).status === 200);
  await poll("student 2 in chat", async () => (await call(t2, "GET", `/api/v1/conversations/${room1}/messages`)).status === 200);
  await sleep(1000);
  await must(t1, "POST", `/api/v1/conversations/${room1}/messages`, { content: `Hello ${tag}` });
  await poll("pushed message", async () => received.some(([kind, value]) => kind === "message" && value.content === `Hello ${tag}`), 10000);
  check("a message reaches the other member's browser connection at once", true);
  const outsider = await call(t4, "GET", `/api/v1/conversations/${room1}/messages`);
  check("a non-member cannot read the room chat", outsider.status === 403);

  const leaderNotes = await poll("leader notifications", async () => {
    const list = await must(t1, "GET", "/api/v1/notifications?pageSize=20");
    return list.some((n) => n.type === "JoinRequestSubmitted") ? list : null;
  });
  check("leader is notified of the application", leaderNotes.length > 0);
  const applicantNotes = await poll("applicant notifications", async () => {
    const list = await must(t2, "GET", "/api/v1/notifications?pageSize=20");
    return list.some((n) => n.type === "JoinRequestDecided") ? list : null;
  });
  check("applicant is notified of the approval", applicantNotes.some((n) => n.title === "Application approved"));
  check("room board changes are pushed to watchers", boardChanges.some((change) => change.roomId === room1), `${boardChanges.length} changes`);

  const lecturer = await login(lecturerEmail, password);
  const overview = await must(lecturer, "GET", `/api/v1/courses/${course.id}/overview`);
  check("lecturer reads the overview", overview.studentCount === 6 && overview.placedCount === 3, `${overview.placedCount}/6 placed`);
  const otherLecturer = await call(t1, "GET", `/api/v1/courses/${course.id}/overview`);
  check("a student cannot read the overview", otherLecturer.status === 403);

  const expired = await must(admin, "POST", `/api/v1/courses/${course.id}/expire`);
  check("course expires", expired.phase === "Expired");
  const lateJoin = await call(t4, "POST", `/api/v1/rooms/${room2}/join`);
  check("students cannot join after the deadline", lateJoin.status === 409 && lateJoin.json.errors[0].code === "COURSE_NOT_PUBLISHED");
  const placement = await must(admin, "GET", `/api/v1/courses/${course.id}/placement-suggestions`);
  check("placement suggestions come ranked over gRPC", placement.ranked === true, `${placement.placements.length} placements, ${placement.unplaced.length} unplaced`);
  const moves = placement.placements.map((p) => ({ studentId: p.student.studentId, roomId: p.roomId }));
  const rooms = await must(admin, "GET", `/api/v1/courses/${course.id}/rooms?hasSeat=true`);
  for (const student of placement.unplaced) {
    moves.push({ studentId: student.studentId, roomId: rooms[0].id });
  }
  if (moves.length > 0) {
    await must(admin, "POST", `/api/v1/courses/${course.id}/placements`, { placements: moves });
  }
  const blockedFinalize = await call(admin, "POST", `/api/v1/courses/${course.id}/finalize`, { acceptExceptions: false });
  const finalized = blockedFinalize.status === 200 ? blockedFinalize.data : await must(admin, "POST", `/api/v1/courses/${course.id}/finalize`, { acceptExceptions: true });
  check("course is finalized into numbered groups", finalized.course.phase === "Finalized" && finalized.groups > 0, `${finalized.groups} groups, ${finalized.deletedRooms} empty rooms deleted`);
  const groups = await must(lecturer, "GET", `/api/v1/courses/${course.id}/rooms?sort=groupNo`);
  check("official groups are numbered 1..n", groups.every((room, index) => room.groupNo === index + 1));

  const phaseNote = await poll("finalize notification", async () => {
    const list = await must(lecturer, "GET", "/api/v1/notifications?pageSize=20");
    return list.find((n) => n.type === "CoursePhaseChanged") ?? null;
  });
  check("lecturer is notified when the groups are final", phaseNote.title === "Groups are final");

  await hub1.stop();
  await hub2.stop();
  const index = await fetch(`http://localhost:${env.WEB_HOST_PORT || 3000}/`).then((r) => r.status).catch(() => 0);
  check("web app is served by nginx", index === 200, `status ${index}`);
  const spa = await fetch(`http://localhost:${env.WEB_HOST_PORT || 3000}/student/courses/${course.id}`).then((r) => r.status).catch(() => 0);
  check("web routes fall back to the SPA", spa === 200, `status ${spa}`);
  console.log(JSON.stringify({ course: course.id, room1, tag }));
} catch (error) {
  check("scenario ran to the end", false, String(error?.message ?? error));
}

const failed = results.filter((result) => !result.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length === 0 ? 0 : 1);
