import { buildInfo, buildVersionLabel } from "@/lib/build-version";

export function BuildVersion() {
  return buildInfo.commit ? (
    <a
      href={`https://github.com/enamaryn/XNova-reforged/commit/${buildInfo.commit}`}
      target="_blank"
      rel="noopener noreferrer"
      title={`${buildInfo.commit}${buildInfo.modified ? " (modifications locales)" : ""}`}
      className="hover:text-slate-300"
      data-testid="build-version"
    >
      {buildVersionLabel}
    </a>
  ) : (
    <span data-testid="build-version">{buildVersionLabel}</span>
  );
}
