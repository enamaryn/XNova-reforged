import { randomBytes } from 'node:crypto';
import { lstatSync, readFileSync, writeFileSync, renameSync, unlinkSync, chmodSync } from 'node:fs';
import { join } from 'node:path';

export const MARKER = '# Généré par XNova bootstrap v1';
export const ENV_KEYS = [
  'NODE_ENV', 'DATABASE_URL', 'REDIS_URL', 'JWT_SECRET', 'JWT_REFRESH_SECRET',
  'SECRETS_ENCRYPTION_KEY', 'JWT_EXPIRES_IN', 'JWT_REFRESH_EXPIRES_IN',
  'API_HOST', 'API_PORT', 'API_URL', 'PORT', 'NEXT_PUBLIC_API_URL', 'WEB_ORIGINS',
  'TRUST_PROXY', 'EMAIL_VERIFICATION_REQUIRED', 'SWAGGER_ENABLED', 'DEBUG_MODE',
];

export function publicUrl(value, mode) {
  let url;
  try { url = new URL(value); } catch { throw new Error('Adresse web invalide. Exemple : https://jeu.exemple.fr'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('Indiquez uniquement l’origine du site, sans identifiants, chemin ni paramètres.');
  }
  if (!/^(?=.{1,253}$)[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/i.test(url.hostname) || url.hostname.split('.').some(part => !part || part.length > 63 || part.startsWith('-') || part.endsWith('-'))) {
    throw new Error('Nom d’hôte invalide (DNS ou IPv4 requis).');
  }
  if (url.port) throw new Error('Utilisez les ports web standards (80/443).');
  if (mode === 'production' && url.protocol !== 'https:') throw new Error('Une adresse HTTPS est requise en production.');
  return url.origin;
}

export function externalDatabaseUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error('Une URL PostgreSQL externe est requise.'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || url.pathname === '/' || !url.pathname || url.hash || /[\r\n\0]/.test(value)) {
    throw new Error('URL PostgreSQL externe invalide : hôte et nom de base requis.');
  }
  return url.href.replace(/'/g, '%27');
}

export function createConfiguration({ mode, url, database, databaseUrl, tls, email = '', replaceServices = false }) {
  if (!['development', 'production'].includes(mode)) throw new Error('Mode attendu : development ou production.');
  if (!['local', 'external'].includes(database)) throw new Error('Base attendue : local ou external.');
  if (typeof replaceServices !== 'boolean') throw new Error('Choix de remplacement des services invalide.');
  const origin = publicUrl(url, mode);
  if (!['none', 'proxy', 'certbot'].includes(tls)) throw new Error('TLS attendu : none, proxy ou certbot.');
  if ((origin.startsWith('https:') && tls === 'none') || (origin.startsWith('http:') && tls !== 'none')) {
    throw new Error('Le choix TLS doit correspondre à l’adresse web.');
  }
  if (tls === 'certbot' && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || ['localhost', '127.0.0.1'].includes(new URL(origin).hostname))) {
    throw new Error('Certbot nécessite un domaine public et une adresse email valide.');
  }
  const id = randomBytes(6).toString('hex');
  const password = randomBytes(32).toString('hex');
  const state = {
    version: 1, mode, url: origin, database, tls, email, replaceServices,
    role: database === 'local' ? `xnova_${id}` : null,
    databaseName: database === 'local' ? `xnova_${mode === 'production' ? 'prod' : 'dev'}_${id}` : null,
  };
  const env = {
    NODE_ENV: mode,
    DATABASE_URL: database === 'local'
      ? `postgresql://${state.role}:${password}@127.0.0.1:5432/${state.databaseName}?schema=public`
      : externalDatabaseUrl(databaseUrl),
    REDIS_URL: 'redis://127.0.0.1:6379',
    JWT_SECRET: randomBytes(48).toString('hex'),
    JWT_REFRESH_SECRET: randomBytes(48).toString('hex'),
    SECRETS_ENCRYPTION_KEY: randomBytes(48).toString('hex'),
    JWT_EXPIRES_IN: '7d', JWT_REFRESH_EXPIRES_IN: '30d',
    API_HOST: '127.0.0.1', API_PORT: '3001', API_URL: 'http://127.0.0.1:3001', PORT: '3000',
    NEXT_PUBLIC_API_URL: '/api', WEB_ORIGINS: origin,
    TRUST_PROXY: tls === 'proxy' ? '2' : '1',
    EMAIL_VERIFICATION_REQUIRED: 'true', SWAGGER_ENABLED: 'false', DEBUG_MODE: 'false',
  };
  return { state, env };
}

export function serializeEnv(env) {
  // Apostrophes : lecture identique par dotenv, systemd et les procédures shell du dépôt.
  if (ENV_KEYS.some(key => typeof env[key] !== 'string' || /['\r\n\0]/.test(env[key]))) throw new Error('Valeur de configuration non sérialisable.');
  return `${MARKER}\n${ENV_KEYS.map(key => `${key}='${env[key]}'`).join('\n')}\n`;
}

function regularFile(path) {
  try {
    const stat = lstatSync(path);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`Fichier ordinaire requis : ${path}`);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

export function readConfiguration(root) {
  const envPath = join(root, '.env');
  const statePath = join(root, '.xnova-install.json');
  const hasEnv = regularFile(envPath);
  const hasState = regularFile(statePath);
  if (!hasEnv && !hasState) return null;
  if (hasEnv !== hasState) throw new Error('Configuration existante ou incomplète : .env et .xnova-install.json doivent appartenir à cet installateur. Aucun fichier remplacé.');
  const text = readFileSync(envPath, 'utf8');
  if (!text.startsWith(`${MARKER}\n`)) throw new Error('.env existant non géré par cet installateur : aucun fichier remplacé.');
  const env = Object.fromEntries(text.trim().split('\n').slice(1).map(line => {
    const index = line.indexOf('=');
    if (index < 1) throw new Error('Configuration .env invalide.');
    const value = line.slice(index + 1);
    if (!/^'[^'\r\n]*'$/.test(value)) throw new Error('Valeur .env invalide.');
    return [line.slice(0, index), value.slice(1, -1)];
  }));
  if (ENV_KEYS.some(key => typeof env[key] !== 'string') || Object.keys(env).some(key => !ENV_KEYS.includes(key))) {
    throw new Error('Configuration .env incomplète ou inconnue.');
  }
  const state = JSON.parse(readFileSync(statePath, 'utf8'));
  if (state.version !== 1) throw new Error('Version de configuration inconnue.');
  const validated = createConfiguration({ ...state, databaseUrl: env.DATABASE_URL });
  if (validated.state.url !== state.url || env.NODE_ENV !== state.mode || env.WEB_ORIGINS !== state.url || env.NEXT_PUBLIC_API_URL !== '/api') {
    throw new Error('Configuration incohérente : mode, adresse web ou URL API modifiés.');
  }
  for (const key of ['API_HOST', 'API_PORT', 'API_URL', 'PORT', 'REDIS_URL', 'EMAIL_VERIFICATION_REQUIRED']) {
    if (env[key] !== validated.env[key]) throw new Error(`Configuration incohérente : ${key}.`);
  }
  if (['JWT_SECRET', 'JWT_REFRESH_SECRET', 'SECRETS_ENCRYPTION_KEY'].some(key => !/^[a-f0-9]{96}$/.test(env[key])) || env.JWT_SECRET === env.JWT_REFRESH_SECRET) {
    throw new Error('Secrets générés absents ou modifiés.');
  }
  if (state.database === 'local') {
    const db = new URL(env.DATABASE_URL);
    if (!/^xnova_[a-f0-9]{12}$/.test(state.role) || !/^xnova_(?:prod|dev)_[a-f0-9]{12}$/.test(state.databaseName)
      || db.username !== state.role || db.pathname !== `/${state.databaseName}` || db.hostname !== '127.0.0.1' || db.port !== '5432'
      || !/^[a-f0-9]{64}$/.test(db.password)) throw new Error('Configuration de la base locale incohérente.');
  } else externalDatabaseUrl(env.DATABASE_URL);
  return { state, env };
}

export function writeConfiguration(root, config) {
  const envPath = join(root, '.env');
  const statePath = join(root, '.xnova-install.json');
  // Ne pas écraser les fichiers d’une installation manuelle, ni suivre un lien symbolique.
  if (regularFile(envPath) || regularFile(statePath)) throw new Error('Configuration déjà présente.');
  writeFileSync(envPath, serializeEnv(config.env), { mode: 0o600, flag: 'wx' });
  try {
    writeFileSync(statePath, `${JSON.stringify(config.state, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
  } catch (error) {
    unlinkSync(envPath);
    throw error;
  }
}

export function updateConfiguration(root, current, options) {
  const checked = createConfiguration({ ...current.state, ...options, databaseUrl: options.databaseUrl || current.env.DATABASE_URL });
  for (const key of ['mode', 'url', 'database', 'tls']) {
    if (current.state[key] !== checked.state[key]) throw new Error('La configuration initiale est déjà enregistrée. Reprenez avec le même mode, domaine et type de base.');
  }
  const next = {
    state: { ...current.state, email: checked.state.email, replaceServices: checked.state.replaceServices },
    env: { ...current.env, ...(current.state.database === 'external' ? { DATABASE_URL: checked.env.DATABASE_URL } : {}) },
  };
  // Seuls l'URL externe, l'email Certbot et l'adoption des services peuvent être corrigés à la reprise.
  for (const [name, content] of [['.env', serializeEnv(next.env)], ['.xnova-install.json', `${JSON.stringify(next.state, null, 2)}\n`]]) {
    const path = join(root, name);
    if (!regularFile(path)) throw new Error('Configuration initiale manquante.');
    const temp = `${path}.${randomBytes(6).toString('hex')}.tmp`;
    writeFileSync(temp, content, { mode: 0o600, flag: 'wx' });
    try { renameSync(temp, path); } catch (error) { unlinkSync(temp); throw error; }
  }
  return next;
}

export function managedFile(path, content) {
  if (regularFile(path)) {
    if (!readFileSync(path, 'utf8').startsWith(`${MARKER}\n`)) throw new Error(`Configuration système existante non gérée : ${path}`);
    // Certbot peut enrichir le bloc nginx : conserver sa configuration lors d’une reprise.
    return false;
  }
  const temp = `${path}.${randomBytes(6).toString('hex')}.tmp`;
  writeFileSync(temp, content, { flag: 'wx', mode: 0o644 });
  try { renameSync(temp, path); } catch (error) { unlinkSync(temp); throw error; }
  chmodSync(path, 0o644);
  return true;
}

export function renderProxy(state) {
  const host = new URL(publicUrl(state.url, state.mode)).hostname;
  return `${MARKER}
server {
    listen 80;
    server_name ${host};
    location /api/ {
        proxy_pass http://127.0.0.1:3001/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 3600s;
    }
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
`;
}

export function renderService(root, component, nodePath) {
  if (!/^\/[a-zA-Z0-9/_.-]+$/.test(root) || !/^\/[a-zA-Z0-9/_.-]+$/.test(nodePath)) throw new Error('Chemins absolus simples requis pour systemd (sans espaces ni caractères spéciaux).');
  if (!['api', 'web'].includes(component)) throw new Error('Service inconnu.');
  const executable = component === 'api'
    ? `${nodePath} dist/main.js`
    : `/usr/bin/env NODE_ENV=production ${nodePath} ../../node_modules/next/dist/bin/next start --hostname 127.0.0.1`;
  return `${MARKER}
[Unit]
Description=XNova Reforged ${component}
After=network.target postgresql.service redis-server.service

[Service]
Type=simple
User=xnova
Group=xnova
WorkingDirectory=${root}/apps/${component}
EnvironmentFile=${root}/.env
ExecStart=${executable}
Restart=on-failure
RestartSec=5
UMask=0077

[Install]
WantedBy=multi-user.target
`;
}
