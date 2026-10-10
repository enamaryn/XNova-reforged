import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { resolveBuildInfo } from "../build-info.mjs";

function fixture(t, withGit = true) {
  const root = mkdtempSync(join(tmpdir(), "xnova-version-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, "apps/web"), { recursive: true });
  writeFileSync(
    join(root, "apps/web/version.json"),
    '{"version":"0.1.0","stage":"Alpha"}',
  );
  writeFileSync(join(root, ".gitignore"), "apps/web/.build-info.json\n");
  const git = (args) =>
    execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  if (withGit) {
    git(["init", "-b", "main"]);
    git(["config", "user.name", "Version test"]);
    git(["config", "user.email", "version@example.test"]);
    git(["add", "."]);
    git(["commit", "-m", "Merge pull request #29 from example/update"]);
  }
  return { root, output: join(root, "apps/web/.build-info.json"), git };
}

test("build records exact Git commit and merge PR, without making the clone dirty", (t) => {
  const f = fixture(t);
  const info = resolveBuildInfo({ ...f, productionBuild: true });
  assert.equal(info.commit, f.git(["rev-parse", "HEAD"]));
  assert.equal(info.pullRequest, 29);
  assert.equal(info.modified, false);
  assert.equal(resolveBuildInfo(f).modified, false);
});

test("restart retains the built commit and release after checkout advances", (t) => {
  const f = fixture(t);
  const built = resolveBuildInfo({ ...f, productionBuild: true });
  writeFileSync(
    join(f.root, "apps/web/version.json"),
    '{"version":"0.2.0","stage":"Beta"}',
  );
  f.git(["commit", "-am", "New release (#30)"]);
  assert.deepEqual(resolveBuildInfo({ ...f, productionServer: true }), built);
  const next = resolveBuildInfo({ ...f, productionBuild: true });
  assert.equal(next.pullRequest, 30);
  assert.notEqual(next.commit, built.commit);
  assert.equal(next.version, "0.2.0");
});

test("local edits are identified; commits without a PR do not invent one", (t) => {
  const f = fixture(t);
  writeFileSync(join(f.root, "local.txt"), "local");
  assert.equal(resolveBuildInfo(f).modified, true);
  f.git(["add", "."]);
  f.git(["commit", "-m", "Manual update"]);
  assert.equal(resolveBuildInfo(f).pullRequest, null);
});

test("archive build uses validated GitHub SHA, otherwise reports unknown", (t) => {
  const f = fixture(t, false);
  assert.equal(
    resolveBuildInfo({ ...f, env: { GITHUB_SHA: "a".repeat(40) } }).commit,
    "a".repeat(40),
  );
  assert.equal(
    resolveBuildInfo({ ...f, env: { GITHUB_SHA: "invalid" } }).commit,
    null,
  );
});

test("missing or corrupt saved metadata never substitutes the runtime checkout", (t) => {
  const f = fixture(t);
  assert.equal(resolveBuildInfo({ ...f, productionServer: true }).commit, null);
  writeFileSync(
    f.output,
    '{"version":"0.1.0","stage":"Alpha","commit":"invalid"}',
  );
  assert.equal(resolveBuildInfo({ ...f, productionServer: true }).commit, null);
});

test("une version sans étape (release stable) est acceptée, au build comme au démarrage", (t) => {
  const f = fixture(t);
  writeFileSync(
    join(f.root, "apps/web/version.json"),
    '{"version":"0.2.0","stage":""}',
  );
  const built = resolveBuildInfo({ ...f, productionBuild: true });
  assert.equal(built.version, "0.2.0");
  assert.equal(built.stage, "");
  const served = resolveBuildInfo({ ...f, productionServer: true });
  assert.equal(served.version, "0.2.0");
  assert.equal(served.stage, "");
  assert.equal(served.commit, built.commit);
  assert.equal(served.pullRequest, 29);
});
