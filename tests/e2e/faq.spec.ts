import { test, expect } from "@playwright/test";
import { buildCredentials, registerUser } from "./helpers";

const TITLES: Record<string, RegExp> = {
  fr: /FAQ du jeu/,
  en: /Game FAQ/,
  es: /FAQ del juego/,
  de: /Spiel-FAQ/,
  it: /FAQ del gioco/,
};

test("la FAQ est publique : accessible sans connexion, dans les cinq langues", async ({ page }) => {
  for (const [locale, title] of Object.entries(TITLES)) {
    await page.goto(`/${locale}/faq`);
    await expect(page).toHaveURL(new RegExp(`/${locale}/faq$`));
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    const doc = page.getByTestId("faq-document");
    // Sections et tableaux rendus (vaisseaux, défenses, messages d'erreur)
    await expect(doc.locator("h2")).toHaveCount(11);
    expect(await doc.locator("table").count()).toBe(5);
  }
});

test("le sommaire mène à la bonne section et les satellites solaires sont expliqués", async ({ page }) => {
  await page.goto("/fr/faq");
  await page.getByTestId("faq-document").getByRole("link", { name: "3. Énergie et satellites solaires" }).click();
  await expect(page).toHaveURL(/#3-énergie-et-satellites-solaires$|#3-%C3%A9nergie-et-satellites-solaires$/);
  const section = page.getByRole("heading", { level: 2, name: "3. Énergie et satellites solaires" });
  await expect(section).toBeInViewport();
  const text = await page.getByTestId("faq-document").innerText();
  expect(text).toContain("directement en orbite de la planète");
  expect(text).toContain("50 d'énergie");
});

test("le lien vers une autre langue de la FAQ reste sur le site", async ({ page }) => {
  await page.goto("/fr/faq");
  await page.getByTestId("faq-document").getByRole("link", { name: "English" }).click();
  await expect(page).toHaveURL(/\/en\/faq$/);
  await expect(page.getByRole("heading", { level: 1, name: TITLES.en })).toBeVisible();
});

test("l'accueil et l'en-tête public proposent la FAQ", async ({ page }) => {
  await page.goto("/fr");
  await page.getByRole("link", { name: "FAQ" }).first().click();
  await expect(page).toHaveURL(/\/fr\/faq$/);
  await expect(page.getByRole("link", { name: "FAQ" }).first()).toBeVisible();
});

test("joueur connecté : la FAQ est dans le menu de gauche et s'ouvre dans le cadre du jeu", async ({ page }) => {
  await registerUser(page, buildCredentials("e2e_faq"));
  const sidebar = page.locator("aside, nav").filter({ has: page.getByRole("link", { name: /Statistiques/ }) }).first();
  await sidebar.getByRole("link", { name: /FAQ/ }).click();
  await expect(page).toHaveURL(/\/fr\/help$/);
  await expect(page.getByRole("heading", { level: 1, name: TITLES.fr })).toBeVisible();
  // Le cadre du jeu (menu de gauche) est conservé
  await expect(page.getByRole("link", { name: /Statistiques/ }).first()).toBeVisible();
  // Les liens de langue restent dans le jeu
  await page.getByTestId("faq-document").getByRole("link", { name: "Deutsch" }).click();
  await expect(page).toHaveURL(/\/de\/help$/);
});

test("la FAQ du jeu exige d'être connecté (la version publique reste ouverte)", async ({ page }) => {
  await page.goto("/fr/help");
  await expect(page).toHaveURL(/\/fr\/login/);
  await page.goto("/fr/faq");
  await expect(page).toHaveURL(/\/fr\/faq$/);
});
