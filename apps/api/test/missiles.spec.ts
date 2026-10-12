import {
  MISSILE_DAMAGE,
  missileCapacity,
  missileFlightSeconds,
  missileRange,
} from '@xnova/game-config';
import { resolveMissileStrike } from '@xnova/game-engine';

describe('missiles : règles pures', () => {
  it('capacité, portée et durée de vol', () => {
    expect(missileCapacity(0)).toBe(0);
    expect(missileCapacity(3)).toBe(30);
    expect(missileRange(0)).toBe(0);
    expect(missileRange(1)).toBe(4);
    expect(missileRange(4)).toBe(19);
    expect(missileFlightSeconds(0)).toBe(30);
    expect(missileFlightSeconds(10)).toBe(630);
  });

  it('les missiles d\'interception abattent un missile chacun et se consomment', () => {
    const r = resolveMissileStrike({
      missiles: 5, antiBallistic: 3, defenses: { 401: 1000 }, attackerWeapon: 0, defenderArmor: 0,
    });
    expect(r).toMatchObject({ launched: 5, intercepted: 3, antiBallisticUsed: 3, hits: 2 });
    // 2 × 12000 = 24000 ; lanceur de missiles : 200 de coque → 120 détruits
    expect(r.destroyed).toEqual({ 401: 120 });
  });

  it('assez de missiles d\'interception : aucune défense détruite', () => {
    const r = resolveMissileStrike({
      missiles: 4, antiBallistic: 10, defenses: { 401: 50 }, attackerWeapon: 5, defenderArmor: 0,
    });
    expect(r.intercepted).toBe(4);
    expect(r.antiBallisticUsed).toBe(4);
    expect(r.hits).toBe(0);
    expect(r.destroyed).toEqual({});
  });

  it('suit l\'ordre par défaut puis passe au type suivant quand le premier est détruit', () => {
    // 1 missile = 12000. 10 lanceurs (200 chacun = 2000) puis artillerie laser légère (2000 de coque)
    const r = resolveMissileStrike({
      missiles: 1, antiBallistic: 0, defenses: { 401: 10, 402: 100 }, attackerWeapon: 0, defenderArmor: 0,
    });
    expect(r.destroyed).toEqual({ 401: 10, 402: 5 });
  });

  it('la cible prioritaire passe avant l\'ordre par défaut', () => {
    const r = resolveMissileStrike({
      missiles: 1, antiBallistic: 0, defenses: { 401: 100, 404: 100 }, attackerWeapon: 0, defenderArmor: 0,
      primaryTarget: 404,
    });
    // Canon de Gauss : 35 000 de coque → 12 000 ne détruisent rien, et les dégâts restants sont perdus
    expect(r.destroyed).toEqual({});
  });

  it('les dégâts qui ne détruisent pas une unité entière sont perdus', () => {
    const r = resolveMissileStrike({
      missiles: 1, antiBallistic: 0, defenses: { 402: 100, 401: 0, 403: 100 }, attackerWeapon: 0, defenderArmor: 0,
    });
    // 12 000 / 2 000 = 6 artilleries légères, le reste ne touche pas l'artillerie lourde
    expect(r.destroyed).toEqual({ 402: 6 });
  });

  it('la technologie Armes augmente les dégâts et Protection renforce les défenses', () => {
    const base = resolveMissileStrike({ missiles: 1, antiBallistic: 0, defenses: { 401: 1000 }, attackerWeapon: 0, defenderArmor: 0 });
    const weapon = resolveMissileStrike({ missiles: 1, antiBallistic: 0, defenses: { 401: 1000 }, attackerWeapon: 10, defenderArmor: 0 });
    const armor = resolveMissileStrike({ missiles: 1, antiBallistic: 0, defenses: { 401: 1000 }, attackerWeapon: 0, defenderArmor: 10 });
    expect(base.destroyed[401]).toBe(MISSILE_DAMAGE / 200);
    expect(weapon.destroyed[401]).toBe((MISSILE_DAMAGE * 2) / 200);
    expect(armor.destroyed[401]).toBe(MISSILE_DAMAGE / 400);
  });

  it('ne détruit jamais plus que le stock et ignore les missiles stockés', () => {
    const r = resolveMissileStrike({
      missiles: 100, antiBallistic: 0, defenses: { 401: 3, 503: 50, 502: 50 }, attackerWeapon: 0, defenderArmor: 0,
    });
    expect(r.destroyed).toEqual({ 401: 3 });
  });
});
