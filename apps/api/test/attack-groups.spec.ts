import { GROUP_MAX_DELAY_RATIO, MAX_GROUP_FLEETS, resolveGroupArrival } from '@xnova/game-config';
import { mergeShipMaps, simulateCombat, splitLoot } from '@xnova/game-engine';

const noTech = { weapon: 0, shield: 0, armor: 0 };

describe('attaques groupées : outils du moteur', () => {
  it('une flotte groupée compte au plus 5 flottes', () => {
    expect(MAX_GROUP_FLEETS).toBe(5);
  });

  it('mergeShipMaps additionne les vaisseaux de chaque flotte', () => {
    expect(mergeShipMaps([{ 202: 3, 206: 1 }, { 206: 2, 207: 4 }, {}])).toEqual({ 202: 3, 206: 3, 207: 4 });
  });

  describe('splitLoot', () => {
    it('partage au prorata de la place libre sans dépasser aucune flotte', () => {
      const shares = splitLoot({ metal: 1000, crystal: 500, deuterium: 100 }, [3000, 1000]);
      expect(shares).toHaveLength(2);
      expect(shares[0].metal + shares[1].metal).toBe(1000);
      expect(shares[0].crystal + shares[1].crystal).toBe(500);
      expect(shares[0].deuterium + shares[1].deuterium).toBe(100);
      expect(shares[0].metal).toBe(750);
      expect(shares[1].metal).toBe(250);
    });

    it('le reliquat des arrondis est distribué et le total est conservé', () => {
      const frees = [333, 333, 334];
      const shares = splitLoot({ metal: 1000, crystal: 0, deuterium: 0 }, frees);
      expect(shares.reduce((sum, s) => sum + s.metal, 0)).toBe(1000);
      shares.forEach((share, i) => expect(share.metal + share.crystal + share.deuterium).toBeLessThanOrEqual(frees[i]));
    });

    it("une flotte sans place libre ne reçoit rien, une seule flotte reçoit tout", () => {
      expect(splitLoot({ metal: 10, crystal: 20, deuterium: 30 }, [0, 100])[0]).toEqual({ metal: 0, crystal: 0, deuterium: 0 });
      expect(splitLoot({ metal: 10, crystal: 20, deuterium: 30 }, [100])[0]).toEqual({ metal: 10, crystal: 20, deuterium: 30 });
      expect(splitLoot({ metal: 10, crystal: 20, deuterium: 30 }, [0, 0])).toEqual([
        { metal: 0, crystal: 0, deuterium: 0 },
        { metal: 0, crystal: 0, deuterium: 0 },
      ]);
    });

    it('invariant sur des cas variés : jamais plus que la place libre, jamais plus que le butin', () => {
      for (let i = 0; i < 200; i += 1) {
        const frees = Array.from({ length: 1 + (i % 5) }, (_, k) => Math.floor(((i + 3) * (k + 7) * 37) % 5000));
        const loot = { metal: (i * 131) % 9000, crystal: (i * 71) % 4000, deuterium: (i * 17) % 2000 };
        const totalFree = frees.reduce((sum, f) => sum + f, 0);
        const shares = splitLoot(loot, frees);
        const given = shares.reduce((sum, s) => sum + s.metal + s.crystal + s.deuterium, 0);
        shares.forEach((s, k) => expect(s.metal + s.crystal + s.deuterium).toBeLessThanOrEqual(frees[k]));
        expect(given).toBeLessThanOrEqual(Math.min(totalFree, loot.metal + loot.crystal + loot.deuterium));
      }
    });
  });

  describe('combat à plusieurs flottes', () => {
    const run = (groups: { key: string; ships: Record<number, number>; tech: typeof noTech }[]) =>
      simulateCombat({
        attackerShips: mergeShipMaps(groups.map((g) => g.ships)),
        defenderShips: { 204: 60 },
        attackerTech: noTech,
        attackerGroups: groups,
        defenderTech: noTech,
      });

    it('rend les survivants de chaque flotte, dont la somme est celle du camp', () => {
      const result = run([
        { key: 'a', ships: { 206: 3 }, tech: noTech },
        { key: 'b', ships: { 206: 3 }, tech: noTech },
      ]);
      const a = result.attackerGroupsRemaining!.a;
      const b = result.attackerGroupsRemaining!.b;
      expect((a[206] ?? 0) + (b[206] ?? 0)).toBe(result.attackerRemaining[206] ?? 0);
      expect(a[206] ?? 0).toBeLessThanOrEqual(3);
      expect(b[206] ?? 0).toBeLessThanOrEqual(3);
    });

    it('sans groupes, le résultat ne contient pas de détail par flotte', () => {
      const result = simulateCombat({
        attackerShips: { 206: 3 }, defenderShips: { 204: 5 }, attackerTech: noTech, defenderTech: noTech,
      });
      expect(result.attackerGroupsRemaining).toBeUndefined();
    });

    it("chaque flotte combat avec ses propres technologies", () => {
      // Deux sondes (210, 1 000 de coque) : celle de la flotte « a » a +10 % de coque, pas celle de « b ». Un seul
      // tir de 1 000 (207) détruit une sonde sans bonus : « a » survit donc TOUJOURS, quel que soit le tirage
      // de la cible ; « b » tombe quand elle est visée (une fois sur deux : sur 40 combats, quasi certain).
      let bLost = 0;
      for (let i = 0; i < 40; i += 1) {
        const r = simulateCombat({
          attackerShips: { 210: 2 },
          defenderShips: { 207: 1 },
          attackerTech: noTech,
          attackerGroups: [
            { key: 'a', ships: { 210: 1 }, tech: { ...noTech, armorBonus: 0.1 } },
            { key: 'b', ships: { 210: 1 }, tech: noTech },
          ],
          defenderTech: noTech,
          maxRounds: 1,
        });
        expect(r.attackerGroupsRemaining!.a[210]).toBe(1);
        if (!r.attackerGroupsRemaining!.b[210]) bLost += 1;
      }
      expect(bLost).toBeGreaterThan(0);
    });
  });
});

describe('attaque groupée coordonnée : heure d\'arrivée du groupe', () => {
  const minute = 60_000;
  const t0 = new Date('2026-10-19T12:00:00.000Z');
  /** Groupe créé à t0, arrivée prévue 100 minutes plus tard. */
  const group = (overrides: Partial<{ arrivalTime: Date; plannedArrivalTime: Date }> = {}) => ({
    createdAt: t0,
    plannedArrivalTime: new Date(t0.getTime() + 100 * minute),
    arrivalTime: new Date(t0.getTime() + 100 * minute),
    ...overrides,
  });
  const at = (minutes: number) => new Date(t0.getTime() + minutes * minute);

  it('le retard maximal est de 30 % de la durée prévue', () => {
    expect(GROUP_MAX_DELAY_RATIO).toBe(0.3);
  });

  it("une flotte assez rapide arrive avec le groupe, sans le retarder", () => {
    const result = resolveGroupArrival(group(), at(10), 60 * minute);
    expect(result).toEqual({ ok: true, arrivalTime: at(100), delayed: false });
  });

  it("une flotte arrivant pile à l'heure du groupe ne le retarde pas", () => {
    expect(resolveGroupArrival(group(), at(10), 90 * minute)).toEqual({ ok: true, arrivalTime: at(100), delayed: false });
  });

  it('une flotte plus lente repousse le groupe à sa propre arrivée, dans la limite de +30 %', () => {
    // arrive à t0 + 10 + 110 = 120 minutes : +20 % de la durée prévue (100 minutes)
    expect(resolveGroupArrival(group(), at(10), 110 * minute)).toEqual({ ok: true, arrivalTime: at(120), delayed: true });
  });

  it('accepte exactement +30 % et refuse au-delà', () => {
    expect(resolveGroupArrival(group(), at(0), 130 * minute)).toEqual({ ok: true, arrivalTime: at(130), delayed: true });
    const refused = resolveGroupArrival(group(), at(0), 131 * minute);
    expect(refused).toMatchObject({ ok: false, reason: 'too_slow' });
    expect((refused as { latestArrival: Date }).latestArrival).toEqual(at(130));
  });

  it("le retard se mesure depuis la durée prévue à la création, pas depuis l'arrivée déjà repoussée", () => {
    // le groupe a déjà été repoussé à +25 % (125 minutes) : une autre flotte ne peut aller que jusqu'à 130 minutes
    const pushed = group({ arrivalTime: at(125) });
    expect(resolveGroupArrival(pushed, at(10), 118 * minute)).toEqual({ ok: true, arrivalTime: at(128), delayed: true });
    expect(resolveGroupArrival(pushed, at(10), 121 * minute)).toMatchObject({ ok: false, reason: 'too_slow' });
  });

  it('un groupe déjà arrivé est refusé', () => {
    expect(resolveGroupArrival(group(), at(100), minute)).toMatchObject({ ok: false, reason: 'gone' });
    expect(resolveGroupArrival(group(), at(150), minute)).toMatchObject({ ok: false, reason: 'gone' });
  });

  it('une durée négative ou nulle compte comme immédiate', () => {
    expect(resolveGroupArrival(group(), at(10), -5 * minute)).toEqual({ ok: true, arrivalTime: at(100), delayed: false });
  });
});
