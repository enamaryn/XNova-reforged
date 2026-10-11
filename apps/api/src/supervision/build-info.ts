import { execFileSync } from 'child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';

export interface BuildInfo {
  version: string;
  commit: string | null;
  startedAt: string;
}

const STARTED_AT = new Date().toISOString();
let cached: BuildInfo | null = null;

/** Racine du dépôt : `apps/api/dist/supervision` ou `apps/api/src/supervision` → trois niveaux plus haut + un. */
export function repoRoot(): string {
  return resolve(__dirname, '..', '..', '..', '..');
}

/** Version applicative (apps/web/version.json, source unique) et commit Git court ; jamais d'exception. */
export function getBuildInfo(): BuildInfo {
  if (cached) return cached;
  let version = process.env.APP_VERSION?.trim() || '';
  if (!version) {
    try {
      const file = join(repoRoot(), 'apps', 'web', 'version.json');
      if (existsSync(file)) version = String(JSON.parse(readFileSync(file, 'utf8')).version ?? '');
    } catch {
      /* version inconnue */
    }
  }
  let commit: string | null = process.env.APP_COMMIT?.trim() || null;
  if (!commit) {
    try {
      commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: repoRoot(), timeout: 2000, stdio: ['ignore', 'pipe', 'ignore'] })
        .toString()
        .trim() || null;
    } catch {
      commit = null;
    }
  }
  cached = { version: version || 'inconnue', commit, startedAt: STARTED_AT };
  return cached;
}

/** Dernière sauvegarde connue : fichier le plus récent du dossier `backups` (BACKUP_DIR). */
export function lastBackup(): { name: string; at: string } | null {
  try {
    const dir = process.env.BACKUP_DIR?.trim() || join(repoRoot(), 'backups');
    if (!existsSync(dir)) return null;
    let best: { name: string; time: number } | null = null;
    for (const name of readdirSync(dir)) {
      if (!/^xnova_backup_.*\.sql\.gz$/.test(name)) continue;
      const time = statSync(join(dir, name)).mtimeMs;
      if (!best || time > best.time) best = { name, time };
    }
    return best ? { name: best.name, at: new Date(best.time).toISOString() } : null;
  } catch {
    return null;
  }
}
