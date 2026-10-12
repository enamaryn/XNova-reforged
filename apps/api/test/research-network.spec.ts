import { linkedLabLevel } from '@xnova/game-config';

describe('réseau de recherche intergalactique : laboratoire effectif', () => {
  it('sans réseau : le laboratoire local seul', () => {
    expect(linkedLabLevel(4, [8, 5], 0)).toEqual({ effective: 4, linked: 0 });
  });

  it('niveau n : le local plus les n meilleurs des autres planètes', () => {
    expect(linkedLabLevel(4, [3, 8, 5], 1)).toEqual({ effective: 12, linked: 1 });
    expect(linkedLabLevel(4, [3, 8, 5], 2)).toEqual({ effective: 17, linked: 2 });
    expect(linkedLabLevel(4, [3, 8, 5], 3)).toEqual({ effective: 20, linked: 3 });
  });

  it('un réseau plus grand que le nombre de planètes équipées ne relie que celles-ci', () => {
    expect(linkedLabLevel(4, [3], 5)).toEqual({ effective: 7, linked: 1 });
    expect(linkedLabLevel(4, [], 5)).toEqual({ effective: 4, linked: 0 });
  });

  it('ignore les planètes sans laboratoire et les valeurs invalides', () => {
    expect(linkedLabLevel(2, [0, -3, Number.NaN, 6], 3)).toEqual({ effective: 8, linked: 1 });
    expect(linkedLabLevel(-1, [], -2)).toEqual({ effective: 0, linked: 0 });
  });
});
