import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { test } from "node:test";

const fakeDocker = `#!/usr/bin/env bash
echo "docker $*" >> "$FAKE_LOG"
args="$*"
case "$args" in
  *" up -d "*)
    if [[ "$IMAGE_TAG" == "$FAKE_BROKEN_UP" ]]; then exit 1; fi
    ;;
  *"-w %{http_code} http://web/"*)
    if [[ "$IMAGE_TAG" == "$FAKE_BROKEN_WEB" ]]; then printf 500; exit 0; fi
    if [[ "$args" == *"/api/v1/semesters"* ]]; then printf 401; else printf 200; fi
    ;;
  *"curl -s http://web/api/v1/semesters"*)
    printf '{"errors":[{"code":"UNAUTHORIZED"}],"traceId":"t"}'
    ;;
  *"health/ready"*)
    if [[ "$IMAGE_TAG" == "$FAKE_BROKEN_READY" ]]; then exit 22; fi
    ;;
esac
exit 0
`;

const fakeGit = `#!/usr/bin/env bash
echo "git $*" >> "$FAKE_LOG"
if [[ "$1" == "rev-parse" ]]; then
  if [[ -n "$FAKE_BROKEN_REV_PARSE" ]]; then exit 128; fi
  echo "commit-of-$IMAGE_TAG"
fi
if [[ "$1" == "checkout" && -n "$FAKE_OLD_SCRIPT" ]]; then
  { printf '#!/usr/bin/env bash\n'; for i in $(seq 1 400); do echo "echo OLD_SCRIPT_RAN_$i"; done; } > scripts/demo-deploy.sh
fi
exit 0
`;

function deployment({ tag = "new", lastGood, lastGoodCommit, ...fake } = {}) {
  const root = mkdtempSync(join(tmpdir(), "demo-deploy-"));
  try {
    const bin = join(root, "bin");
    const state = join(root, "state");
    const work = join(root, "work");
    for (const directory of [bin, state, join(work, "scripts")]) {
      mkdirSync(directory, { recursive: true });
    }

    writeFileSync(join(bin, "docker"), fakeDocker);
    writeFileSync(join(bin, "git"), fakeGit);
    chmodSync(join(bin, "docker"), 0o755);
    chmodSync(join(bin, "git"), 0o755);
    copyFileSync(join(import.meta.dirname, "demo-deploy.sh"), join(work, "scripts", "demo-deploy.sh"));
    writeFileSync(join(work, ".env.example"), "JWT_SIGNING_KEY=sample\n");
    writeFileSync(join(state, "demo.env"), "JWT_SIGNING_KEY=real\n");
    if (lastGood) {
      writeFileSync(join(state, "last-good"), `${lastGood}\n`);
    }

    if (lastGoodCommit) {
      writeFileSync(join(state, "last-good-commit"), `${lastGoodCommit}\n`);
    }

    const log = join(root, "calls.log");
    writeFileSync(log, "");
    const result = spawnSync("bash", ["scripts/demo-deploy.sh"], {
      cwd: work,
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${bin}${delimiter}${process.env.PATH}`,
        IMAGE_TAG: tag,
        DEMO_STATE_DIR: state,
        DEMO_SKIP_BUILD: "1",
        FAKE_LOG: log,
        FAKE_BROKEN_UP: fake.brokenUp ?? "",
        FAKE_BROKEN_WEB: fake.brokenWeb ?? "",
        FAKE_BROKEN_READY: fake.brokenReady ?? "",
        FAKE_BROKEN_REV_PARSE: fake.brokenRevParse ?? "",
        FAKE_OLD_SCRIPT: fake.oldScript ?? "",
      },
    });
    const read = (name) => (existsSync(join(state, name)) ? readFileSync(join(state, name), "utf8").trim() : null);
    return { status: result.status, output: `${result.stdout}${result.stderr}`, calls: readFileSync(log, "utf8"), lastGood: read("last-good"), lastGoodCommit: read("last-good-commit") };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("a healthy deploy records the good version", () => {
  const result = deployment({ lastGood: "old" });
  assert.equal(result.status, 0, result.output);
  assert.match(result.output, /Deployed new/);
  assert.equal(result.lastGood, "new");
  assert.equal(result.lastGoodCommit, "commit-of-new");
});

test("a page answering 500 fails the deploy and returns to the good version", () => {
  const result = deployment({ lastGood: "old", lastGoodCommit: "abc", brokenWeb: "new" });
  assert.equal(result.status, 1, result.output);
  assert.doesNotMatch(result.output, /Deployed new/);
  assert.match(result.output, /Smoke check failed/);
  assert.match(result.output, /Rolled back to old/);
  assert.match(result.calls, /git checkout --quiet --detach abc/);
  assert.equal(result.lastGood, "old");
});

test("a service that is not ready fails the deploy", () => {
  const result = deployment({ lastGood: "old", brokenReady: "new" });
  assert.equal(result.status, 1, result.output);
  assert.match(result.output, /identity-service is not ready/);
  assert.equal(result.lastGood, "old");
});

test("a failed rollback says so instead of claiming success", () => {
  const result = deployment({ lastGood: "old", brokenUp: "new", brokenWeb: "old" });
  assert.equal(result.status, 1, result.output);
  assert.match(result.output, /Rollback to old failed/);
  assert.doesNotMatch(result.output, /Rolled back to old/);
});

test("a rollback survives the checkout replacing the running script with an older one", () => {
  const result = deployment({ lastGood: "old", lastGoodCommit: "abc", brokenWeb: "new", oldScript: "yes" });
  assert.equal(result.status, 1, result.output);
  assert.doesNotMatch(result.output, /OLD_SCRIPT_RAN/);
  assert.match(result.output, /Rolled back to old/);
  assert.equal(result.lastGood, "old");
});

test("a rollback without a recorded commit reports failure instead of running mismatched files", () => {
  const result = deployment({ lastGood: "old", brokenWeb: "new" });
  assert.equal(result.status, 1, result.output);
  assert.match(result.output, /Rollback to old failed: its commit is unknown/);
  assert.doesNotMatch(result.output, /Rolled back to old/);
});

test("an unreadable commit stops before anything changes", () => {
  const result = deployment({ lastGood: "old", lastGoodCommit: "abc", brokenRevParse: "yes" });
  assert.equal(result.status, 1, result.output);
  assert.doesNotMatch(result.calls, / up -d /);
  assert.equal(result.lastGoodCommit, "abc");
});

test("redeploying the good version that fails leaves it running instead of stopping the demo", () => {
  const result = deployment({ tag: "same", lastGood: "same", brokenWeb: "same" });
  assert.equal(result.status, 1, result.output);
  assert.doesNotMatch(result.calls, / stop/);
  assert.equal(result.lastGood, "same");
});

test("the first deploy that fails stops the crashing stack", () => {
  const result = deployment({ brokenUp: "new" });
  assert.equal(result.status, 1, result.output);
  assert.match(result.output, /No earlier good version/);
  assert.match(result.calls, / stop/);
});

test("an example file without a sample key stops the deploy instead of skipping the check", () => {
  const root = mkdtempSync(join(tmpdir(), "demo-deploy-"));
  try {
    writeFileSync(join(root, ".env.example"), "OTHER=1\n");
    writeFileSync(join(root, "demo.env"), "JWT_SIGNING_KEY=real\n");
    const result = spawnSync("bash", [join(import.meta.dirname, "demo-deploy.sh")], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, IMAGE_TAG: "new", DEMO_STATE_DIR: root },
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /has no JWT_SIGNING_KEY/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("the sample signing key is refused before anything runs", () => {
  const root = mkdtempSync(join(tmpdir(), "demo-deploy-"));
  try {
    writeFileSync(join(root, ".env.example"), "JWT_SIGNING_KEY=sample\n");
    writeFileSync(join(root, "demo.env"), "JWT_SIGNING_KEY=sample\n");
    const result = spawnSync("bash", [join(import.meta.dirname, "demo-deploy.sh")], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, IMAGE_TAG: "new", DEMO_STATE_DIR: root },
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /still holds the sample/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
