import { test, expect } from '@playwright/test';
import { prisma } from '@xnova/database';
import { buildCredentials, registerUser } from './helpers';

// La planète du joueur produit pendant le test : on compare à une unité près
const near = (value: number, expected: number) => Math.abs(value - expected) < 2;

test.afterAll(async () => {
  await prisma.$disconnect();
});

test('publier une offre, acheter celle d’un autre joueur, la retirer', async ({ page }) => {
  const credentials = buildCredentials('e2e_market');
  await registerUser(page, credentials);
  const user = await prisma.user.findUniqueOrThrow({ where: { username: credentials.username }, include: { planets: true } });
  const planetId = user.planets[0].id;
  // sous la capacité de stockage de départ, pour que rien ne soit rogné
  await prisma.planet.update({ where: { id: planetId }, data: { metal: 100_000, crystal: 100_000, deuterium: 50_000 } });

  // Un autre joueur a déjà publié une offre de cristal contre du métal
  const seller = await prisma.user.create({
    data: { username: `${credentials.username}_v`.slice(0, 20), email: `mkt_${Date.now()}@example.test`, password: 'x' },
  });
  const sellerPlanet = await prisma.planet.create({
    data: { userId: seller.id, name: 'Vendeur', galaxy: 8, system: 100 + Math.floor(Math.random() * 380), position: 1 + Math.floor(Math.random() * 15), fieldsMax: 163, metal: 0, crystal: 0 },
  });
  const offer = await prisma.marketOffer.create({
    data: {
      sellerId: seller.id, planetId: sellerPlanet.id, giveResource: 'crystal', wantResource: 'metal',
      amount: 1000, remaining: 1000, minAmount: 10, rate: 1.5, expiresAt: new Date(Date.now() + 3_600_000),
    },
  });

  try {
    await page.goto('/market');
    await expect(page.getByTestId(`offer-${offer.id}`)).toBeVisible();

    // Achat de 100 cristal à 1,5 métal l'unité = 150 métal
    await page.getByTestId(`quantity-${offer.id}`).fill('100');
    await page.getByTestId(`buy-${offer.id}`).click();
    await expect(page.getByTestId('market-bought')).toBeVisible();
    const after = await prisma.planet.findUniqueOrThrow({ where: { id: planetId } });
    expect(near(after.crystal, 100_100)).toBe(true);
    expect(near(after.metal, 100_000 - 150)).toBe(true);
    const sold = await prisma.planet.findUniqueOrThrow({ where: { id: sellerPlanet.id } });
    expect(sold.metal).toBe(150 - 7); // taxe de 5 % (7,5 arrondi à 7) détruite

    // Publication d'une offre : le taux est pré-rempli à la parité
    await page.getByTestId('create-give').selectOption('deuterium');
    await page.getByTestId('create-want').selectOption('metal');
    await expect(page.getByTestId('create-rate')).toHaveValue('3');
    await page.getByTestId('create-amount').fill('1000');
    await page.getByTestId('create-submit').click();
    await expect(page.getByTestId('market-mine').locator('li')).toHaveCount(1);
    const own = await prisma.marketOffer.findFirstOrThrow({ where: { sellerId: user.id } });
    expect(near((await prisma.planet.findUniqueOrThrow({ where: { id: planetId } })).deuterium, 49_000)).toBe(true);

    // Retrait : le séquestre revient
    await page.getByTestId(`cancel-${own.id}`).first().click();
    await expect(page.getByTestId('market-mine')).toHaveCount(0);
    expect(near((await prisma.planet.findUniqueOrThrow({ where: { id: planetId } })).deuterium, 50_000)).toBe(true);

    // Un taux hors limites est refusé avec un message
    await page.getByTestId('create-rate').fill('50');
    await page.getByTestId('create-amount').fill('10');
    await page.getByTestId('create-submit').click();
    await expect(page.getByTestId('market-error')).toBeVisible();
  } finally {
    await prisma.marketTrade.deleteMany({ where: { sellerId: seller.id } });
    await prisma.marketOffer.deleteMany({ where: { sellerId: seller.id } });
    await prisma.user.deleteMany({ where: { id: seller.id } });
  }
});
