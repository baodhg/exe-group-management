import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const owner = "baodhg";
const repo = "exe-group-management";
const head = "head-sha";
const workflow = readFileSync(join(import.meta.dirname, "..", ".github", "workflows", "infra-guard.yml"), "utf8");
const inlineScript = workflow.split("script: |\n")[1].replace(/^ {12}/gm, "");
const memberPaths = readFileSync(join(import.meta.dirname, "..", ".github", "member-paths.txt"), "utf8");
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

async function guard({
  files,
  author = "member",
  actor = author,
  action = "synchronize",
  pushers = [author],
  reviews = [],
  changedFiles = files.length,
  headRepository = `${owner}/${repo}`,
}) {
  const result = { failure: null, info: [] };
  const listFiles = Symbol("listFiles");
  const listReviews = Symbol("listReviews");
  const github = {
    rest: {
      repos: { getContent: async () => ({ data: { content: Buffer.from(memberPaths).toString("base64") } }) },
      pulls: { listFiles, listReviews },
    },
    paginate: async (endpoint) => (endpoint === listFiles ? files.map((filename) => ({ filename })) : reviews),
    request: async () => ({ data: pushers.map((login) => ({ actor: { login } })) }),
  };
  const context = {
    repo: { owner, repo },
    actor,
    payload: {
      action,
      pull_request: {
        number: 1,
        changed_files: changedFiles,
        user: { login: author },
        base: { sha: "base-sha" },
        head: { sha: head, ref: "work", repo: { full_name: headRepository } },
      },
    },
  };
  const core = {
    info: (message) => result.info.push(message),
    setFailed: (message) => {
      result.failure = message;
    },
  };
  await new AsyncFunction("github", "context", "core", inlineScript)(github, context, core);
  return result;
}

const approval = (commit = head) => ({ user: { login: owner }, state: "APPROVED", commit_id: commit });

test("a member working inside the member areas passes without approval", async () => {
  const paths = [
    "src/GroupService/ExeGroup.Group.Services/Courses/CourseService.cs",
    "src/GroupService/ExeGroup.Group.API/appsettings.json",
    "src/GroupService/ExeGroup.Group.Repositories/Data/Migrations/20261105_AddCourses.cs",
    "src/web/src/features/courses/CoursesPage.tsx",
    "src/web/src/app/App.tsx",
    "src/web/src/styles.css",
    "tests/ExeGroup.Group.IntegrationTests/CoursesTests.cs",
    "database/schema.sql",
    "docs/notes.md",
    "README.md",
  ];
  assert.equal((await guard({ files: paths })).failure, null);
});

for (const path of [
  ".github/workflows/ci.yml",
  ".github/member-paths.txt",
  ".gitleaks.toml",
  "compose.yaml",
  "docker-compose.yml",
  "deploy/docker-compose.demo.yml",
  "scripts/demo-deploy.sh",
  "scripts/check-conventions.mjs",
  "global.json",
  "Directory.Packages.props",
  "src/BuildingBlocks/ExeGroup.BuildingBlocks/Paging/ListQuery.cs",
  "src/ApiGateway/ExeGroup.ApiGateway/appsettings.json",
  "src/Contracts/ExeGroup.Contracts/group_membership.proto",
  "src/GroupService/ExeGroup.Group.API/ExeGroup.Group.API.csproj",
  "src/GroupService/Directory.Build.props",
  "src/GroupService/Dockerfile",
  "src/GroupService/Dockerfile.dev",
  "src/GroupService/ExeGroup.Group.API/ExeGroup.Group.API.csproj.user",
  "src/web/package.json",
  "src/web/package-lock.json",
  "src/web/vite.config.ts",
  "src/web/nginx.conf",
  "src/web/src/shared/api/apiClient.ts",
  "tests/ExeGroup.ArchitectureTests/LayeringTests.cs",
  "tests/ExeGroup.Testing/TestTokens.cs",
  ".GITHUB/workflows/ci.yml",
]) {
  test(`a member changing ${path} needs approval`, async () => {
    const result = await guard({ files: [path] });
    assert.match(result.failure ?? "", /must approve the latest commit/);
  });
}

test("the owner's approval of the latest commit lets a member's change pass", async () => {
  assert.equal((await guard({ files: ["docker-compose.yml"], reviews: [approval()] })).failure, null);
});

test("an approval of an older commit no longer counts", async () => {
  const result = await guard({ files: ["docker-compose.yml"], reviews: [approval("older-sha")] });
  assert.match(result.failure ?? "", /must approve/);
});

test("requesting changes after approving withdraws the approval", async () => {
  const changes = { user: { login: owner }, state: "CHANGES_REQUESTED", commit_id: head };
  const result = await guard({ files: ["docker-compose.yml"], reviews: [approval(), changes] });
  assert.match(result.failure ?? "", /must approve/);
});

test("a comment after approving keeps the approval", async () => {
  const comment = { user: { login: owner }, state: "COMMENTED", commit_id: head };
  assert.equal((await guard({ files: ["docker-compose.yml"], reviews: [approval(), comment] })).failure, null);
});

test("another member's approval does not count", async () => {
  const other = { user: { login: "other" }, state: "APPROVED", commit_id: head };
  const result = await guard({ files: ["docker-compose.yml"], reviews: [other] });
  assert.match(result.failure ?? "", /must approve/);
});

test("the owner's own infrastructure pull request passes", async () => {
  const result = await guard({ files: ["docker-compose.yml"], author: owner, pushers: [owner] });
  assert.equal(result.failure, null);
});

test("the owner editing the title of their own pull request still passes", async () => {
  const result = await guard({ files: ["docker-compose.yml"], author: owner, pushers: [owner], action: "edited" });
  assert.equal(result.failure, null);
});

test("a member pushing infrastructure onto the owner's pull request needs approval", async () => {
  const result = await guard({ files: ["docker-compose.yml"], author: owner, actor: "member", pushers: [owner, "member"] });
  assert.match(result.failure ?? "", /must approve/);
});

test("the owner editing the title cannot launder a member's push", async () => {
  const result = await guard({ files: ["docker-compose.yml"], author: owner, actor: owner, action: "edited", pushers: [owner, "member"] });
  assert.match(result.failure ?? "", /must approve/);
});

test("a fork using the owner's name is not exempt", async () => {
  const result = await guard({ files: ["docker-compose.yml"], author: owner, pushers: [owner], headRepository: "someone/fork" });
  assert.match(result.failure ?? "", /must approve/);
});

test("a dependency bot changing packages needs approval", async () => {
  const result = await guard({ files: ["src/web/package.json"], author: "dependabot[bot]", pushers: ["dependabot[bot]"] });
  assert.match(result.failure ?? "", /must approve/);
});

test("a list of changed files that was cut short fails closed", async () => {
  const result = await guard({ files: ["docs/notes.md"], changedFiles: 3001 });
  assert.match(result.failure ?? "", /cannot be checked/);
});
