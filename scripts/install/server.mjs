import { createServer } from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createConfiguration, readConfiguration, writeConfiguration, updateConfiguration } from './config.mjs';

const assets = new Map([
  ['/', ['text/html; charset=utf-8', readFileSync(new URL('./web/index.html', import.meta.url))]],
  ['/bootstrap/ui.js', ['text/javascript; charset=utf-8', readFileSync(new URL('./web/ui.js', import.meta.url))]],
  ['/bootstrap/ui.css', ['text/css; charset=utf-8', readFileSync(new URL('./web/ui.css', import.meta.url))]],
]);

function equal(value, expected) {
  if (typeof value !== 'string') return false;
  const a = Buffer.from(value), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function requestOrigin(req) {
  const https = req.headers['x-forwarded-proto'] === 'https' || req.socket.encrypted;
  return `${https ? 'https' : 'http'}://${req.headers.host}`;
}

async function jsonBody(req) {
  if (!req.headers['content-type']?.startsWith('application/json')) throw Object.assign(new Error('JSON requis.'), { status: 415 });
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (Buffer.byteLength(body) > 8192) throw Object.assign(new Error('Requête trop volumineuse.'), { status: 413 });
  }
  try { return JSON.parse(body); } catch { throw Object.assign(new Error('JSON invalide.'), { status: 400 }); }
}

export function createBootstrapServer({ root, accessCode, install, handoff, existingServices = () => [], now = Date.now, logError = console.error }) {
  // Aucun appel apt, npm, PostgreSQL ou Prisma lors de la création du serveur.
  let config = readConfiguration(root);
  let state = { phase: 'idle', stage: '', error: null };
  let session = null;
  let attempts = [];
  let job = Promise.resolve();
  const tokenExpires = now() + 2 * 60 * 60 * 1000;
  const csrf = randomBytes(32).toString('hex');
  const summary = () => ({
    ...state,
    existingServices: existingServices(),
    config: config ? { ...config.state } : null,
  });
  const server = createServer(async (req, res) => {
    // Un proxy ne doit pas réutiliser une connexion au bootstrap après la reprise du port par Next.
    res.setHeader('Connection', 'close');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'");
    const reply = (status, data) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(data));
    };
    try {
      const path = new URL(req.url, 'http://localhost').pathname;
      if (req.method === 'GET' && ['/setup', '/fr/setup', '/login', '/fr/login'].includes(path)) {
        const [type, body] = assets.get('/');
        res.writeHead(200, { 'Content-Type': type });
        res.end(body);
        return;
      }
      if (req.method === 'GET' && assets.has(path)) {
        const [type, body] = assets.get(path);
        res.writeHead(200, { 'Content-Type': type });
        res.end(body);
        return;
      }
      if (now() > tokenExpires) return reply(401, { error: 'Le code a expiré. Relancez la commande d’installation.' });
      if (req.method === 'POST' && req.headers.origin !== requestOrigin(req)) return reply(403, { error: 'Origine refusée.' });
      if (path === '/bootstrap/auth' && req.method === 'POST') {
        attempts = attempts.filter(time => time > now() - 60000);
        if (attempts.length >= 10) return reply(429, { error: 'Trop de tentatives. Attendez une minute.' });
        const { code } = await jsonBody(req);
        if (!equal(code, accessCode)) {
          attempts.push(now());
          return reply(401, { error: 'Code d’accès invalide.' });
        }
        session = { id: randomBytes(32).toString('hex'), expires: now() + 60 * 60 * 1000 };
        res.setHeader('Set-Cookie', `xnova_bootstrap=${session.id}; HttpOnly; SameSite=Strict; Path=/bootstrap; Max-Age=3600${requestOrigin(req).startsWith('https:') ? '; Secure' : ''}`);
        return reply(200, { csrf, ...summary() });
      }
      const cookie = req.headers.cookie?.split(';').map(part => part.trim()).find(part => part.startsWith('xnova_bootstrap='))?.slice('xnova_bootstrap='.length);
      if (!session || session.expires < now() || !equal(cookie, session.id)) return reply(401, { error: 'Saisissez le code d’accès affiché sur le serveur.' });
      if (req.method === 'GET' && path === '/bootstrap/status') return reply(200, { csrf, ...summary() });
      if (req.method !== 'POST' || !equal(req.headers['x-xnova-bootstrap-csrf'], csrf)) return reply(403, { error: 'Requête refusée.' });
      if (path === '/bootstrap/install') {
        if (['running', 'ready', 'handoff'].includes(state.phase)) return reply(409, { error: 'L’installation est déjà en cours ou prête.' });
        const options = await jsonBody(req);
        if (!options || Array.isArray(options) || typeof options !== 'object') return reply(400, { error: 'Configuration invalide.' });
        if ((existingServices().length || options.serviceAction !== undefined) && !['keep', 'recreate'].includes(options.serviceAction)) {
          return reply(400, { error: 'Des services existent déjà. Choisissez « Garder et reprendre » ou « Supprimer et recréer ».' });
        }
        if (options.serviceAction !== undefined) options.replaceServices = options.serviceAction === 'keep';
        const origin = new URL(requestOrigin(req));
        if (options.database === 'external' && origin.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname)) {
          return reply(400, { error: 'Utilisez HTTPS ou un tunnel SSH local pour transmettre l’URL de la base externe.' });
        }
        try {
          if (config) config = updateConfiguration(root, config, options);
          else {
            config = createConfiguration(options);
            writeConfiguration(root, config);
          }
        } catch (error) { return reply(400, { error: error.message }); }
        state = { phase: 'running', stage: 'Préparation de l’installation', error: null };
        job = Promise.resolve().then(() => install(config, accessCode, stage => { state.stage = stage; })).then(result => {
          state = { phase: 'ready', stage: 'La base et l’API sont prêtes. Continuer vers le SMTP.', error: null, setupRequired: result.setupRequired };
        }).catch(error => {
          logError(error);
          state = { phase: 'failed', stage: state.stage, error: `Échec : ${state.stage}. Consultez le terminal du serveur, puis reprenez l’installation. Les secrets et la base sont conservés.` };
        });
        return reply(202, summary());
      }
      if (path === '/bootstrap/handoff') {
        if (state.phase !== 'ready') return reply(409, { error: 'La préparation n’est pas terminée.' });
        const next = `${config.state.url}/${state.setupRequired ? `setup#bootstrap-token=${accessCode}` : 'login'}`;
        state.phase = 'handoff';
        res.setHeader('Set-Cookie', 'xnova_bootstrap=; HttpOnly; SameSite=Strict; Path=/bootstrap; Max-Age=0');
        // Fermer l'écoute libère le port, tout en gardant cette réponse ouverte jusqu'à ce que Next soit prêt.
        server.close();
        try { await handoff(); } catch (error) {
          logError(error);
          return reply(500, { error: 'Le site web n’a pas démarré. Consultez le terminal et relancez la commande d’installation.' });
        }
        reply(200, { next });
        return;
      }
      return reply(404, { error: 'Route inconnue.' });
    } catch (error) {
      if (res.writableEnded) return;
      if (!error.status) logError(error);
      return reply(error.status || 400, { error: error.status ? error.message : 'Requête invalide.' });
    }
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  return { server, settled: () => job };
}
