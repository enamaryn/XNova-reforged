import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export function resolveBuildInfo({
  root,
  output,
  productionBuild = false,
  productionServer = false,
  env = process.env,
}) {
  const release = JSON.parse(
    readFileSync(join(root, "apps/web/version.json"), "utf8"),
  );
  const unknown = {
    ...release,
    commit: null,
    pullRequest: null,
    modified: false,
  };
  if (productionServer) {
    try {
      const saved = JSON.parse(readFileSync(output, "utf8"));
      if (
        !saved.version ||
        typeof saved.stage !== "string" ||
        (saved.commit !== null && !/^[a-f0-9]{40}$/.test(saved.commit))
      )
        return unknown;
      return saved;
    } catch {
      return unknown;
    }
  }
  let commit = null,
    pullRequest = null,
    modified = false;
  const git = (args) =>
    execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  try {
    commit = git(["rev-parse", "HEAD"]);
    if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error("Invalid commit");
    const subject = git(["log", "-1", "--format=%s"]);
    const pr =
      subject.match(/^Merge pull request #(\d+)\b/) ??
      subject.match(/\(#(\d+)\)$/);
    pullRequest = pr ? Number(pr[1]) : null;
    modified = Boolean(
      git(["status", "--porcelain", "--untracked-files=normal"]),
    );
  } catch {
    commit = /^[a-f0-9]{40}$/.test(env.GITHUB_SHA ?? "")
      ? env.GITHUB_SHA
      : null;
  }
  const info = { ...release, commit, pullRequest, modified };
  if (productionBuild) writeFileSync(output, JSON.stringify(info) + "\n");
  return info;
}
