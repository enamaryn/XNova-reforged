import { expect, test } from "@playwright/test";

test("la page publique reprend le nouveau visuel sans débordement", async ({
  page,
}) => {
  await page.goto("/fr");

  await expect(
    page.getByRole("heading", { name: "Une galaxie entière à conquérir." }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Accès commandant", exact: true }).first(),
  ).toHaveAttribute("href", "/login");
  await expect(
    page.getByRole("link", { name: /Voir l’univers/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Découvrez l'univers" }),
  ).toBeVisible();

  for (const title of ["Planètes", "Défense spatiale", "Flottes"]) {
    await expect(page.getByText(title, { exact: true })).toBeVisible();
  }

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);

  await page.screenshot({
    path: test.info().outputPath("public-home.png"),
    fullPage: true,
  });
});

test("le lien de découverte descend aux cartes", async ({ page }) => {
  await page.goto("/fr");
  await page.getByRole("link", { name: /Voir l’univers/ }).click();
  await expect(page).toHaveURL(/#univers$/);
  await expect(
    page.getByRole("region", { name: "Découvrez l'univers" }),
  ).toBeInViewport();
});
