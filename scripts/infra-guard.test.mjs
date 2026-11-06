import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const owner = "baodhg";
const repo = "exe-group-management";
const head = "head-sha";
const workflowCommit = "workflow-sha";
const workflow = readFileSync(join(import.meta.dirname, "..", ".github", "workflows", "infra-guard.yml"), "utf8");
const inlineScript = workflow.split("script: |\n")[1].replace(/^ {12}/gm, "");
const devOpsPaths = readFileSync(join(import.meta.dirname, "..", ".github", "devops-paths.txt"), "utf8");
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
  const result = { failure: null, info: [], listRef: null };
  const listFiles = Symbol("listFiles");
  const listReviews = Symbol("listReviews");
  const github = {
    rest: {
      repos: {
        getContent: async ({ ref, path }) => {
          assert.equal(path, ".github/devops-paths.txt");
          result.listRef = ref;
          return { data: { content: Buffer.from(devOpsPaths).toString("base64") } };
        },
      },
      pulls: { listFiles, listReviews },
    },
    paginate: async (endpoint) =>
      endpoint === listFiles ? files.map((file) => (typeof file === "string" ? { filename: file } : file)) : reviews,
    request: async () => ({ data: pushers.map((login) => ({ actor: { login } })) }),
  };
  const context = {
    repo: { owner, repo },
    actor,
    sha: workflowCommit,
    payload: {
      action,
      pull_request: {
        number: 1,
        changed_files: changedFiles,
        user: { login: author },
        base: { sha: "older-base-sha" },
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

for (const path of [
  "src/GroupService/ExeGroup.Group.Services/Courses/CourseService.cs",
  "src/GroupService/ExeGroup.Group.API/ExeGroup.Group.API.csproj",
  "src/GroupService/ExeGroup.Group.API/appsettings.json",
  "src/GroupService/ExeGroup.Group.Repositories/Data/Migrations/20261105_AddCourses.cs",
  "src/BuildingBlocks/ExeGroup.BuildingBlocks/Paging/ListQuery.cs",
  "src/ApiGateway/ExeGroup.ApiGateway/appsettings.json",
  "src/Contracts/ExeGroup.Contracts/recommendation.proto",
  "src/web/src/features/courses/CoursesPage.tsx",
  "src/web/src/shared/api/apiClient.ts",
  "src/web/package.json",
  "src/web/package-lock.json",
  "src/web/vite.config.ts",
  "tests/ExeGroup.Group.IntegrationTests/CoursesTests.cs",
  "tests/ExeGroup.ArchitectureTests/LayeringTests.cs",
  "tests/ExeGroup.Testing/TestTokens.cs",
  "database/schema.sql",
  "docs/notes.md",
  "README.md",
  "CONTRIBUTING.md",
  "ExeGroup.sln",
  "ExeGroup.slnLaunch",
  "Directory.Packages.props",
  ".editorconfig",
  ".env.local.example",
  "scripts/seed-demo.mjs",
  "scripts/smoke-e2e.mjs",
  "scripts/dev-token.mjs",
  "scripts/ef.sh",
  "scripts/ef.ps1",
  "scripts/nested/helper.test.mjs",
  "scripts/demo-deploy.sh.bak",
  "docs/deploy/notes.md",
  "docs/docker/notes.md",
  "docs/scripts/zz.test.mjs",
  "mydocker-compose.yml",
  "src/GroupService/.env.example",
]) {
  test(`a member changing ${path} passes without approval`, async () => {
    assert.equal((await guard({ files: [path] })).failure, null);
  });
}

for (const path of [
  ".github/workflows/ci.yml",
  ".github/workflows/deploy-demo.yml",
  ".github/devops-paths.txt",
  ".github/dependabot.yml",
  ".GITHUB/workflows/ci.yml",
  ".gitleaks.toml",
  ".dockerignore",
  "src/web/.dockerignore",
  "compose.yaml",
  "docker-compose.yml",
  "docker-compose.override.yml",
  "deploy/docker-compose.demo.yml",
  "deploy/anything-new.conf",
  "docker/dotnet-service.Dockerfile",
  "docker/settings.conf",
  ".env.example",
  ".gitattributes",
  "src/GroupService/.gitattributes",
  ".GITATTRIBUTES",
  "dotnet-tools.json",
  ".config/dotnet-tools.json",
  ".gitleaksignore",
  "scripts/zz.test.mjs",
  "scripts/ZZ.TEST.MJS",
  "src/web/Dockerfile",
  "src/GroupService/Dockerfile.dev",
  "src/GroupService/custom.Dockerfile",
  "src/web/nginx.conf",
  "global.json",
  "nuget.config",
  "src/GroupService/NuGet.Config",
  "Directory.Build.props",
  "Directory.Build.targets",
  "tests/Directory.Build.props",
  "scripts/check-conventions.mjs",
  "scripts/check-conventions.test.mjs",
  "scripts/check-demo-compose.mjs",
  "scripts/demo-deploy.sh",
  "scripts/demo-deploy-entry.sh",
  "scripts/demo-deploy.test.mjs",
  "scripts/infra-guard.test.mjs",
]) {
  test(`a member changing ${path} needs approval`, async () => {
    const result = await guard({ files: [path] });
    assert.match(result.failure ?? "", /must approve the latest commit/);
  });
}

test("the guard runs on every pull request event against main with read-only access", () => {
  const header = workflow.split("steps:")[0].replaceAll("\r", "");
  const block = (...parts) => parts.join("\n");
  assert.ok(header.includes(block("on:", "  pull_request_target:", "    branches: [main]", "    types: [opened, synchronize, reopened, edited, ready_for_review]")));
  assert.ok(header.includes(block("permissions:", "  contents: read", "  pull-requests: read")));
  assert.ok(header.includes(block("  infra-guard:", "    name: infra-guard")));
  assert.ok(!header.includes("write"));
});

test("every test file the conventions job runs is protected", async () => {
  const conventions = readFileSync(join(import.meta.dirname, "..", ".github", "workflows", "conventions.yml"), "utf8");
  assert.ok(conventions.includes('node --test "scripts/*.test.mjs"'));
  assert.match((await guard({ files: ["scripts/anything-new.test.mjs"] })).failure ?? "", /must approve/);
});

test("the list is read from the commit the workflow runs from, not the older base of the pull request", async () => {
  assert.equal((await guard({ files: ["docs/notes.md"] })).listRef, workflowCommit);
});

test("one DevOps file among many feature files still needs approval", async () => {
  const result = await guard({ files: ["src/web/src/app/App.tsx", "deploy/docker-compose.demo.yml", "README.md"] });
  assert.match(result.failure ?? "", /must approve/);
  assert.ok(result.info.join("\n").includes("deploy/docker-compose.demo.yml"));
  assert.ok(!result.info.join("\n").includes("README.md"));
});

test("moving a DevOps file somewhere else still needs approval", async () => {
  const result = await guard({ files: [{ filename: "docs/old-compose.md", previous_filename: "docker-compose.yml" }] });
  assert.match(result.failure ?? "", /must approve/);
});

test("moving a file into a DevOps folder needs approval", async () => {
  const result = await guard({ files: [{ filename: ".github/workflows/x.yml", previous_filename: "docs/x.yml" }] });
  assert.match(result.failure ?? "", /must approve/);
});

test("a folder that only starts like a DevOps folder passes", async () => {
  assert.equal((await guard({ files: ["deployment-notes/plan.md", "docker-notes.md"] })).failure, null);
});

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

test("the owner's own DevOps pull request passes", async () => {
  const result = await guard({ files: ["docker-compose.yml"], author: owner, pushers: [owner] });
  assert.equal(result.failure, null);
});

test("the owner editing the title of their own pull request still passes", async () => {
  const result = await guard({ files: ["docker-compose.yml"], author: owner, pushers: [owner], action: "edited" });
  assert.equal(result.failure, null);
});

test("a member pushing DevOps files onto the owner's pull request needs approval", async () => {
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

test("a dependency bot changing packages passes on green checks alone", async () => {
  const result = await guard({ files: ["src/web/package.json"], author: "dependabot[bot]", pushers: ["dependabot[bot]"] });
  assert.equal(result.failure, null);
});

test("a dependency bot changing a workflow needs approval", async () => {
  const result = await guard({ files: [".github/workflows/ci.yml"], author: "dependabot[bot]", pushers: ["dependabot[bot]"] });
  assert.match(result.failure ?? "", /must approve/);
});

test("a list of changed files that was cut short fails closed", async () => {
  const result = await guard({ files: ["docs/notes.md"], changedFiles: 3001 });
  assert.match(result.failure ?? "", /cannot be checked/);
});
