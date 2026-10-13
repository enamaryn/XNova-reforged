import { test, expect } from '@playwright/test';
import { prisma } from '@xnova/database';
import { activeQuests, periodKey, scaledReward, questRewardMultiplier } from '@xnova/game-config';
import { buildCredentials, registerUser } from './helpers';

test.afterAll(async () => {
  await prisma.$disconnect();
});

test('terminer une quête du jour, la réclamer, puis voir ses succès', async ({ page }) => {
  const credentials = buildCredentials('e2e_quests');
  await registerUser(page, credentials);
  const user = await prisma.user.findUniqueOrThrow({ where: { username: credentials.username }, include: { planets: true } });
  const planet = user.planets[0];

  // Parmi les trois quêtes du jour, au moins une est de celles qu'on peut alimenter directement en base
  // (seules « victoires » et « espionnages » ne le sont pas, et deux quêtes ne suffisent jamais à remplir les trois).
  const quest = activeQuests('daily', periodKey('daily', new Date())).find((q) =>
    ['buildings', 'research', 'units', 'fleets', 'expeditions'].includes(q.metric),
  )!;
  expect(quest).toBeTruthy();
  const past = new Date(Date.now() - 1000);
  for (let i = 0; i < (quest.metric === 'units' ? 1 : quest.target); i += 1) {
    if (quest.metric === 'buildings') {
      await prisma.buildQueue.create({ data: { planetId: planet.id, buildingId: 1, level: i + 1, startTime: past, endTime: past, completed: true } });
    } else if (quest.metric === 'research') {
      await prisma.researchQueue.create({ data: { userId: user.id, planetId: planet.id, techId: 106, level: i + 1, startTime: past, endTime: past, completed: true } });
    } else if (quest.metric === 'units') {
      await prisma.shipQueue.create({ data: { planetId: planet.id, shipId: 202, amount: quest.target, startTime: past, endTime: past, completed: true } });
    } else if (quest.metric === 'fleets') {
      await prisma.fleet.create({
        data: {
          userId: user.id, fromGalaxy: 1, fromSystem: 1, fromPosition: 1, toGalaxy: 1, toSystem: 2, toPosition: 1,
          mission: 3, ships: {}, cargo: {}, startTime: past, arrivalTime: past, status: 'completed',
        },
      });
    } else {
      await prisma.expeditionReport.create({ data: { userId: user.id, galaxy: 1, system: 5, outcome: 'nothing', details: {}, ships: {} } });
    }
  }
  const before = await prisma.planet.findUniqueOrThrow({ where: { id: planet.id } });

  await page.goto('/quests');
  const card = page.getByTestId(`quest-${quest.id}`);
  await expect(card).toBeVisible();
  await expect(card).toHaveAttribute('data-state', 'claimable');
  await expect(page.getByTestId('quests-weekly')).toBeVisible();

  await page.getByTestId(`claim-${quest.id}`).click();
  await expect(card).toHaveAttribute('data-state', 'claimed');
  const reward = scaledReward(quest.reward, questRewardMultiplier(1));
  const after = await prisma.planet.findUniqueOrThrow({ where: { id: planet.id } });
  // la planète produit pendant le test : on compare à une unité près
  expect(Math.abs(after.metal - (before.metal + reward.metal))).toBeLessThan(2);
  expect(Math.abs(after.crystal - (before.crystal + reward.crystal))).toBeLessThan(2);
  expect(Math.abs(after.deuterium - (before.deuterium + reward.deuterium))).toBeLessThan(2);
  expect(await prisma.questClaim.count({ where: { userId: user.id, questId: quest.id } })).toBe(1);

  await page.goto('/achievements');
  await expect(page.getByTestId('achievements-summary')).toBeVisible();
  await expect(page.getByTestId('category-build')).toBeVisible();
  await expect(page.getByTestId('achievement-buildings_10')).toHaveAttribute('data-unlocked', 'false');
  await expect(page.getByTestId('achievement-alliance_1')).toHaveAttribute('data-unlocked', 'false');
});
