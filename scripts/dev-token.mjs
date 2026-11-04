#!/usr/bin/env node
import { createHmac, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const roles = ["Student", "Lecturer", "Administrator"];
const [role = "Administrator", userId = randomUUID(), minutes = "60"] = process.argv.slice(2);

if (!roles.includes(role)) {
  console.error(`Usage: node scripts/dev-token.mjs <${roles.join("|")}> [userId] [minutes]`);
  process.exit(1);
}

const envFile = join(dirname(fileURLToPath(import.meta.url)), "..", ".env");
const env = existsSync(envFile)
  ? Object.fromEntries(
      readFileSync(envFile, "utf8")
        .split(/\r?\n/)
        .filter((line) => line.includes("=") && !line.trimStart().startsWith("#"))
        .map((line) => [line.slice(0, line.indexOf("=")).trim(), line.slice(line.indexOf("=") + 1).trim()]),
    )
  : {};

const key = process.env.JWT_SIGNING_KEY ?? env.JWT_SIGNING_KEY;
if (!key || Buffer.byteLength(key) < 32) {
  console.error("JWT_SIGNING_KEY (env or .env) must be at least 32 bytes.");
  process.exit(1);
}

const now = Math.floor(Date.now() / 1000);
const header = { alg: "HS256", typ: "JWT" };
const payload = {
  sub: userId,
  role,
  jti: randomUUID().replaceAll("-", ""),
  iss: process.env.JWT_ISSUER ?? env.JWT_ISSUER ?? "exe-group-system",
  aud: process.env.JWT_AUDIENCE ?? env.JWT_AUDIENCE ?? "exe-group-clients",
  iat: now,
  nbf: now,
  exp: now + Number(minutes) * 60,
};

const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const unsigned = `${encode(header)}.${encode(payload)}`;
const signature = createHmac("sha256", key).update(unsigned).digest("base64url");
process.stdout.write(`${unsigned}.${signature}\n`);
