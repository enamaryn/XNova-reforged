import { DEPOT_SUPPLY_PER_LEVEL_PER_HOUR, depotSupply, holdFuelPerHour, holdSeconds } from '@xnova/game-config';
import { distributeShipLosses } from '@xnova/game-engine';

describe('maintien de position : règles pures', () => {
  it('carburant de maintien : un dixième de la consommation par heure, arrondi au-dessus', () => {
    expect(holdFuelPerHour({})).toBe(0);
    expect(holdFuelPerHour({ 202: 10 })).toBe(10); // 10 × 10 / 10
    expect(holdFuelPerHour({ 202: 1 })).toBe(1);
    expect(holdFuelPerHour({ 202: 3, 9999: 5 })).toBe(3);
  });

  it('durée divisée par la vitesse, 10 s au minimum', () => {
    expect(holdSeconds(2, 1)).toBe(7200);
    expect(holdSeconds(1, 50)).toBe(72);
    expect(holdSeconds(1, 1_000_000)).toBe(10);
  });

  it('ravitaillement du dépôt : borné par le carburant payé, le deutérium de l\'hôte et le niveau', () => {
    const base = { prepaid: 500, hostDeuterium: 10_000, depotLevel: 1, hours: 2 };
    expect(depotSupply(base)).toBe(500);
    expect(depotSupply({ ...base, hostDeuterium: 120 })).toBe(120);
    expect(depotSupply({ ...base, depotLevel: 0 })).toBe(0);
    expect(depotSupply({ ...base, prepaid: 1_000_000, hostDeuterium: 1_000_000 })).toBe(DEPOT_SUPPLY_PER_LEVEL_PER_HOUR * 2);
    expect(depotSupply({ ...base, depotLevel: 3, prepaid: 1_000_000, hostDeuterium: 1_000_000 })).toBe(60_000);
  });

  it('répartition des pertes : proportionnelle, plus fort reste, total conservé et jamais au-delà du stock', () => {
    const owners = [
      { key: 'host', ships: { 204: 10 } },
      { key: 'a', ships: { 204: 30 } },
      { key: 'b', ships: { 204: 60, 206: 4 } },
    ];
    const shares = distributeShipLosses({ 204: 10, 206: 3 }, owners);
    // 204 : 10 sur 100 → 1 / 3 / 6 ; 206 : tout chez b
    expect(shares).toEqual({ host: { 204: 1 }, a: { 204: 3 }, b: { 204: 6, 206: 3 } });

    const odd = distributeShipLosses({ 204: 1 }, [
      { key: 'x', ships: { 204: 1 } },
      { key: 'y', ships: { 204: 1 } },
      { key: 'z', ships: { 204: 1 } },
    ]);
    const total = Object.values(odd).reduce((s, o) => s + (o[204] ?? 0), 0);
    expect(total).toBe(1);
    expect(odd.x[204]).toBe(1); // égalité : premier propriétaire

    const capped = distributeShipLosses({ 204: 500 }, owners);
    expect(Object.values(capped).reduce((s, o) => s + (o[204] ?? 0), 0)).toBe(100);
    expect(distributeShipLosses({ 999: 5 }, owners)).toEqual({ host: {}, a: {}, b: {} });
  });
});
