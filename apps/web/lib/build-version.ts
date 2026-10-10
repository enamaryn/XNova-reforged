import release from "../version.json";

interface BuildInfo {
  version: string;
  stage: string;
  commit: string | null;
  pullRequest: number | null;
  modified: boolean;
}

// Next embeds this public metadata in the server and browser bundles at build time.
export const buildInfo: BuildInfo = JSON.parse(
  process.env.NEXT_PUBLIC_XNOVA_BUILD_INFO ||
    JSON.stringify({
      ...release,
      commit: null,
      pullRequest: null,
      modified: false,
    }),
);

export const buildVersionLabel = [
  buildInfo.stage ? `v${buildInfo.version} ${buildInfo.stage}` : `v${buildInfo.version}`,
  buildInfo.pullRequest ? `PR #${buildInfo.pullRequest}` : null,
  buildInfo.commit
    ? `${buildInfo.commit.slice(0, 7)}${buildInfo.modified ? "+local" : ""}`
    : "build inconnu",
]
  .filter(Boolean)
  .join(" · ");
