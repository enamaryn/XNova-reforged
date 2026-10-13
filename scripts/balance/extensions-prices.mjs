#!/usr/bin/env node
// Rythme des prix des extensions (officiers, commandants de flotte) à la vitesse du serveur donnée.
// Usage : node scripts/balance/extensions-prices.mjs [vitesse=50]
// Lit les constantes et formules du dépôt (game-config, game-engine) : à rejouer après toute modification de prix.
import { createRequire } from 'node:module';
import { join } from 'node:path';

const root = new URL('../..', import.meta.url).pathname;
const require = createRequire(join(root, 'package.json'));
const config = require(join(root, 'packages/game-config/dist/index.js'));
const engine = require(join(root, 'packages/game-engine/dist/index.js'));
const speed = Number(process.argv[2] ?? 50);

const levels = (patch) => ({
  metalMine: 0, crystalMine: 0, deuteriumMine: 0, solarPlant: 40, fusionPlant: 0,
  metalStorage: 0, crystalStorage: 0, deuteriumStorage: 0, ...patch,
});
const hourly = (patch) => {
  const p = engine.calculateMineProduction(levels(patch));
  return { metal: p.metal * speed, crystal: p.crystal * speed, deuterium: p.deuterium * speed };
};
const value = (r) => r.metal * config.MARKET_REFERENCE_VALUE.metal + r.crystal * config.MARKET_REFERENCE_VALUE.crystal + r.deuterium * config.MARKET_REFERENCE_VALUE.deuterium;
const hours = (h) => (h < 48 ? `${h.toFixed(1)} h` : `${(h / 24).toFixed(1)} j`);

console.log(`Vitesse du serveur ×${speed} — prix : officier ${config.OFFICER_COST_DEUTERIUM} deutérium, commandant ${config.FLEET_COMMANDER_COST_DEUTERIUM} deutérium\n`);
console.log('Mine de deutérium | production/h | un officier | un commandant (une planète, deutérium seul)');
for (const level of [5, 10, 15, 20, 25]) {
  const perHour = hourly({ deuteriumMine: level }).deuterium;
  console.log(`  niveau ${String(level).padStart(2)}       | ${String(Math.round(perHour)).padStart(9)}   | ${hours(config.OFFICER_COST_DEUTERIUM / perHour).padStart(8)}   | ${hours(config.FLEET_COMMANDER_COST_DEUTERIUM / perHour).padStart(8)}`);
}

console.log('\nRetour sur investissement du géologue (+10 % des mines), trois mines au même niveau, une planète :');
for (const level of [10, 15, 20]) {
  const income = hourly({ metalMine: level, crystalMine: level, deuteriumMine: level });
  const gain = value(income) * 0.1; // en équivalent métal
  const cost = config.OFFICER_COST_DEUTERIUM * config.MARKET_REFERENCE_VALUE.deuterium;
  console.log(`  mines niveau ${level} : revenu ${Math.round(value(income))} équiv. métal/h, gain ${Math.round(gain)}/h, remboursé en ${hours(cost / gain)} (une planète ; plus vite avec plusieurs)`);
}

console.log('\nExpérience d\'un commandant (combat d\'attaque : 100 + 1 par 1 000 de métal et cristal détruits) :');
for (const level of [2, 5, 10, 15, 20]) {
  const xp = config.experienceForLevel(level);
  console.log(`  niveau ${String(level).padStart(2)} : ${String(xp).padStart(9)} XP = ${Math.ceil(xp / 100)} combats sans perte adverse ou ${Math.ceil(xp / 10_100)} combats détruisant 10 M de métal et cristal`);
}
