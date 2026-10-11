#!/usr/bin/env node
// OPS-03 — Test de charge : N joueurs simulés (HTTP + WebSocket) contre une API démarrée.
// Usage : API_URL=http://127.0.0.1:3001 PLAYERS=200 HOLD_S=600 RAMP_S=60 node scripts/load/load-test.mjs
// Les seuils sont fixés dans docs/LOAD_TEST.md (avant exécution). Code de sortie 1 si un seuil est dépassé.
import { io } from 'socket.io-client';
import { writeFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname } from 'node:path';

const API = (process.env.API_URL ?? 'http://127.0.0.1:3001').replace(/\/$/, '');
const PLAYERS = Number(process.env.PLAYERS ?? 200);
const RAMP_S = Number(process.env.RAMP_S ?? 60);
const HOLD_S = Number(process.env.HOLD_S ?? 600);
// Phase d'inactivité après le palier : les WebSocket restent ouvertes pour mesurer la diffusion du cron (resources:updated)
const IDLE_S = Number(process.env.IDLE_S ?? 0);
const OUT = process.env.OUT ?? 'docs/audits/load-test.json';
const RUN = Date.now().toString(36);

const THRESHOLDS = {
  read: { p95: 500, p99: 1500 },
  write: { p95: 1000, p99: 2500 },
  auth: { p95: 3000 },
  errorRate: 0.005,
  wsRatio: 0.99,
};

const samples = new Map(); // clé "METHOD route" -> { kind, times[], status{} }
let totalRequests = 0;
let serverErrors = 0; // 5xx + réseau
let rateLimited = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

async function call(player, method, route, { path = route, body, kind, token = player?.token } = {}) {
  const key = `${method} ${route}`;
  const k = kind ?? (method === 'GET' ? 'read' : 'write');
  const start = performance.now();
  let status = 0;
  let data = null;
  try {
    const res = await fetch(API + path, {
      method,
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30_000),
    });
    status = res.status;
    data = await res.json().catch(() => null);
  } catch {
    status = 0;
  }
  const ms = performance.now() - start;
  let s = samples.get(key);
  if (!s) samples.set(key, (s = { kind: k, times: [], status: {} }));
  s.times.push(ms);
  s.status[status] = (s.status[status] ?? 0) + 1;
  totalRequests++;
  if (status === 0 || status >= 500) serverErrors++;
  if (status === 429) rateLimited++;
  return { status, data, ms };
}

const wsStats = { attempted: 0, connected: 0, dropped: 0, resourceEvents: 0 };

function connectSocket(player) {
  wsStats.attempted++;
  return new Promise((resolve) => {
    const socket = io(`${API}/game`, { auth: { token: player.token }, transports: ['websocket'], reconnection: false });
    let up = false;
    const timer = setTimeout(() => resolve(null), 15_000);
    // Le gateway authentifie après la connexion : l'établissement est confirmé par l'événement `connected`
    socket.on('connected', () => {
      up = true;
      wsStats.connected++;
      clearTimeout(timer);
      if (player.planetId) socket.emit('subscribe:planet', { planetId: player.planetId });
      resolve(socket);
    });
    socket.on('subscribe:refused', () => { wsStats.subscribeRefused = (wsStats.subscribeRefused ?? 0) + 1; });
    socket.on('connect_error', () => { clearTimeout(timer); resolve(null); });
    socket.on('disconnect', () => { if (up && !player.stopped) { wsStats.dropped++; player.wsUp = false; } });
    socket.on('resources:updated', () => { wsStats.resourceEvents++; });
  });
}

async function register(i) {
  const player = { i, name: `lt${RUN}${i}`.slice(0, 20) };
  const password = 'LoadTest1234';
  const email = `${player.name}@load.test`;
  const r = await call(player, 'POST', '/auth/register', { body: { username: player.name, email, password }, kind: 'auth' });
  if (r.status !== 201 && r.status !== 200) return null;
  const l = await call(player, 'POST', '/auth/login', { body: { identifier: player.name, password }, kind: 'auth' });
  const alt = l.data ?? r.data;
  player.token = alt?.tokens?.accessToken;
  if (!player.token) return null;
  const me = await call(player, 'GET', '/auth/me');
  player.planetId = me.data?.planets?.[0]?.id;
  player.coords = me.data?.planets?.[0];
  player.username = player.name;
  return player.planetId ? player : null;
}

async function gameLoop(player, until, peers) {
  const p = player.planetId;
  while (Date.now() < until) {
    const roll = Math.random();
    if (roll < 0.15) await call(player, 'GET', '/auth/me');
    else if (roll < 0.35) await call(player, 'GET', '/planets/:id/resources', { path: `/planets/${p}/resources` });
    else if (roll < 0.45) await call(player, 'GET', '/planets/:id/buildings', { path: `/planets/${p}/buildings` });
    else if (roll < 0.55) {
      const b = await call(player, 'POST', '/planets/:id/build', { path: `/planets/${p}/build`, body: { buildingId: pick([1, 2, 3, 4, 12]) } });
      if (b.status < 300 && b.data?.id && Math.random() < 0.3) {
        await call(player, 'DELETE', '/planets/:id/build-queue/:queueId', { path: `/planets/${p}/build-queue/${b.data.id}` });
      }
    } else if (roll < 0.62) await call(player, 'GET', '/planets/:id/build-queue', { path: `/planets/${p}/build-queue` });
    else if (roll < 0.68) await call(player, 'GET', '/research-queue');
    else if (roll < 0.72) {
      const t = await call(player, 'GET', '/technologies', { path: `/technologies?planetId=${p}` });
      if (t.status === 200 && Math.random() < 0.4) await call(player, 'POST', '/research', { body: { planetId: p, techId: 113 } });
    }
    else if (roll < 0.80) {
      const c = player.coords;
      await call(player, 'GET', '/galaxy/:g/:s', { path: `/galaxy/${c.galaxy}/${c.system}` });
    } else if (roll < 0.85) await call(player, 'GET', '/statistics');
    else if (roll < 0.89) await call(player, 'GET', '/messages/inbox');
    else if (roll < 0.92) {
      const to = pick(peers);
      if (to && to !== player.username) {
        await call(player, 'POST', '/messages/send', { body: { toUsername: to, subject: 'Salut', body: 'Message de charge' } });
      }
    } else if (roll < 0.95) await call(player, 'GET', '/progression/onboarding');
    else if (roll < 0.97) {
      await call(player, 'GET', '/shipyard', { path: `/shipyard?planetId=${p}` });
      if (Math.random() < 0.3) await call(player, 'POST', '/shipyard/build', { body: { planetId: p, shipId: 202, amount: 1 } });
    }
    else if (roll < 0.99) await call(player, 'GET', '/fleet/active');
    else {
      // Envoi de flotte volontairement refusé ou accepté selon l'état : exerce la validation et les verrous
      const c = player.coords;
      await call(player, 'POST', '/fleet/send', {
        body: { planetId: p, toGalaxy: c.galaxy, toSystem: c.system, toPosition: ((c.position % 15) + 1), mission: 3, speedPercent: 100, ships: { 202: 1 } },
      });
    }
    await sleep(rand(1000, 4000));
  }
}

function pct(sorted, q) {
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.ceil(q * sorted.length) - 1)];
}

function summarize() {
  const endpoints = {};
  const agg = { read: [], write: [], auth: [] };
  for (const [key, s] of samples) {
    const t = [...s.times].sort((a, b) => a - b);
    agg[s.kind].push(...t);
    endpoints[key] = { kind: s.kind, count: t.length, p50: pct(t, 0.5), p95: pct(t, 0.95), p99: pct(t, 0.99), max: t.at(-1) ?? 0, status: s.status };
  }
  const groups = {};
  for (const [k, t] of Object.entries(agg)) {
    t.sort((a, b) => a - b);
    groups[k] = { count: t.length, p50: pct(t, 0.5), p95: pct(t, 0.95), p99: pct(t, 0.99) };
  }
  return { endpoints, groups };
}

async function main() {
  const startedAt = new Date().toISOString();
  console.log(`OPS-03 : ${PLAYERS} joueurs, montée ${RAMP_S}s, palier ${HOLD_S}s, ${API}`);
  const health0 = await fetch(`${API}/health`).then((r) => r.status).catch(() => 0);
  if (health0 !== 200) { console.error('API injoignable'); process.exit(2); }

  let healthFail = 0, healthTotal = 0, maxRssMb = 0;
  const healthTimer = setInterval(async () => {
    healthTotal++;
    try {
      const r = await fetch(`${API}/health`, { signal: AbortSignal.timeout(10_000) });
      if (r.status !== 200) healthFail++;
      else { const j = await r.json(); maxRssMb = Math.max(maxRssMb, j.memory?.rss ?? 0); if (j.status !== 'ok') healthFail++; }
    } catch { healthFail++; }
  }, 5000);

  const players = [];
  const rampMs = (RAMP_S * 1000) / PLAYERS;
  const regs = [];
  for (let i = 0; i < PLAYERS; i++) {
    regs.push(register(i).then(async (pl) => { if (pl) { pl.socket = await connectSocket(pl); pl.wsUp = !!pl.socket; players.push(pl); } }));
    await sleep(rampMs);
  }
  await Promise.all(regs);
  console.log(`Joueurs prêts : ${players.length}/${PLAYERS}, WebSocket : ${wsStats.connected}/${wsStats.attempted}`);

  // Dotation des comptes avant le palier (ex. SQL via psql) : exerce le chemin de succès des écritures
  if (process.env.BOOST_CMD) {
    execSync(process.env.BOOST_CMD, { stdio: 'inherit', shell: '/bin/bash' });
    console.log('Comptes dotés (BOOST_CMD)');
  }

  const holdStart = Date.now();
  const until = holdStart + HOLD_S * 1000;
  const names = players.map((p) => p.username);
  await Promise.all(players.map((p) => gameLoop(p, until, names)));
  const holdMs = Date.now() - holdStart;
  const eventsBeforeIdle = wsStats.resourceEvents;
  if (IDLE_S > 0) await sleep(IDLE_S * 1000);
  wsStats.resourceEventsDuringIdle = wsStats.resourceEvents - eventsBeforeIdle;

  const stillUp = players.filter((p) => p.socket?.connected).length;
  players.forEach((p) => { p.stopped = true; p.socket?.close(); });
  clearInterval(healthTimer);

  const { endpoints, groups } = summarize();
  const errorRate = totalRequests ? serverErrors / totalRequests : 0;
  const wsRatio = stillUp / PLAYERS;
  const checks = {
    read: groups.read.p95 <= THRESHOLDS.read.p95 && groups.read.p99 <= THRESHOLDS.read.p99,
    write: groups.write.p95 <= THRESHOLDS.write.p95 && groups.write.p99 <= THRESHOLDS.write.p99,
    auth: groups.auth.p95 <= THRESHOLDS.auth.p95,
    errors: errorRate <= THRESHOLDS.errorRate,
    websocket: wsRatio >= THRESHOLDS.wsRatio,
    health: healthFail === 0,
    rateLimited: rateLimited === 0,
  };
  const report = {
    startedAt, finishedAt: new Date().toISOString(), api: API,
    config: { boosted: !!process.env.BOOST_CMD, players: PLAYERS, rampS: RAMP_S, holdS: HOLD_S, idleS: IDLE_S },
    playersReady: players.length, holdSeconds: Math.round(holdMs / 1000),
    totalRequests, throughputRps: +(totalRequests / ((holdMs / 1000) + RAMP_S)).toFixed(1),
    serverErrors, errorRate, rateLimited,
    websocket: { ...wsStats, stillConnectedAtEnd: stillUp, ratio: wsRatio },
    health: { checks: healthTotal, failures: healthFail, maxRssMb },
    groups, endpoints, thresholds: THRESHOLDS, checks,
    passed: Object.values(checks).every(Boolean),
  };
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ groups, errorRate, rateLimited, websocket: report.websocket, health: report.health, checks, passed: report.passed }, null, 2));
  process.exit(report.passed ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(2); });
