import { MAX_GROUP_FLEETS } from '@xnova/game-config';
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

    it("chaque flotte combat avec ses propres technologies : la flotte renforcée détruit nettement plus", () => {
      // Deux flottes identiques en nombre ; seule l'une est renforcée de 10 % : à la fin, plus d'unités
      // ennemies tombent que si les deux étaient sans bonus.
      const total = (tech: typeof noTech & { weaponBonus?: number; shieldBonus?: number; armorBonus?: number }) => {
        let lost = 0;
        for (let i = 0; i < 200; i += 1) {
          const r = run([
            { key: 'a', ships: { 206: 3 }, tech },
            { key: 'b', ships: { 206: 3 }, tech: noTech },
          ]);
          lost += Object.values(r.defenderLosses).reduce((s, n) => s + Number(n), 0);
        }
        return lost;
      };
      const boosted = total({ ...noTech, weaponBonus: 0.1, shieldBonus: 0.1, armorBonus: 0.1 });
      const plain = total(noTech);
      expect(boosted).toBeGreaterThan(plain);
    });
  });
});
