import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { join } from "node:path";
import { test } from "node:test";

const script = join(import.meta.dirname, "seed-demo.mjs");

async function seedAgainst({ semesters, flags = [] }) {
  const requests = [];
  const server = createServer((request, response) => {
    const path = request.url.split("?")[0];
    requests.push(`${request.method} ${path}`);
    request.resume();
    request.on("end", () => {
      response.setHeader("Content-Type", "application/json");
      if (request.method === "POST" && path === "/api/v1/auth/login") {
        response.end(JSON.stringify({ data: { accessToken: "token" } }));
      } else if (request.method === "GET" && path === "/api/v1/semesters") {
        response.end(JSON.stringify({ data: semesters }));
      } else {
        response.statusCode = 500;
        response.end(JSON.stringify({ errors: [{ code: "STOP", message: "the fake gateway ends here" }] }));
      }
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const child = spawn(process.execPath, [script, ...flags], {
      env: {
        ...process.env,
        SEED_GATEWAY_URL: `http://127.0.0.1:${server.address().port}`,
        SEED_ADMIN_EMAIL: "admin@example.test",
        SEED_ADMIN_PASSWORD: "admin-sample",
        SEED_DEMO_PASSWORD: "demo-sample",
      },
    });
    let output = "";
    child.stdout.on("data", (chunk) => (output += chunk));
    child.stderr.on("data", (chunk) => (output += chunk));
    const status = await new Promise((resolve) => child.on("close", resolve));
    return { status, output, requests };
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("seeding once leaves a seeded database untouched", async () => {
  const result = await seedAgainst({ semesters: [{ id: "s1", code: "FA26" }], flags: ["--once"] });
  assert.equal(result.status, 0, result.output);
  assert.match(result.output, /^Seed skipped/m);
  assert.deepEqual(result.requests, ["POST /api/v1/auth/login", "GET /api/v1/semesters"]);
});

test("seeding once loads the data into an empty database", async () => {
  const result = await seedAgainst({ semesters: [], flags: ["--once"] });
  assert.doesNotMatch(result.output, /Seed skipped/);
  assert.ok(result.requests.includes("POST /api/v1/semesters"), result.requests.join("\n"));
});

test("seeding once is not fooled by a semester whose code only contains the seeded one", async () => {
  const result = await seedAgainst({ semesters: [{ id: "s2", code: "FA26B" }], flags: ["--once"] });
  assert.doesNotMatch(result.output, /Seed skipped/);
  assert.ok(result.requests.includes("POST /api/v1/semesters"), result.requests.join("\n"));
});

test("without the flag the seed still tops up a seeded database", async () => {
  const result = await seedAgainst({ semesters: [{ id: "s1", code: "FA26" }] });
  assert.doesNotMatch(result.output, /Seed skipped/);
  assert.ok(result.requests.includes("GET /api/v1/subjects"), result.requests.join("\n"));
});
