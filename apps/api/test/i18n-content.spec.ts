import {
  BUILDINGS,
  DEFENSES,
  LOCALIZED_LOCALES,
  SHIPS,
  SUPPORTED_LOCALES,
  TECHNOLOGIES,
  itemTextsFor,
  localizeItem,
} from '@xnova/game-config';
import { MAIL_KINDS, renderMail } from '../src/mail/mail-templates';
import { getBuildingUpgradeEffects } from '../src/buildings/building-upgrade-effects';
import { itemName, itemNameById, withLocale } from '../src/common/request-locale';

const ALL_ITEMS = [
  ...Object.values(BUILDINGS),
  ...Object.values(TECHNOLOGIES),
  ...Object.values(SHIPS),
  ...Object.values(DEFENSES),
];

describe('textes du jeu multilingues', () => {
  it.each(LOCALIZED_LOCALES)('%s : chaque bâtiment, technologie, vaisseau et défense est traduit', (locale) => {
    const texts = itemTextsFor(locale);
    for (const item of ALL_ITEMS) {
      const entry = texts[item.id];
      expect(entry).toBeDefined();
      expect(entry[0].trim().length).toBeGreaterThan(1);
      expect(entry[1].trim().length).toBeGreaterThan(5);
    }
    // Aucune entrée orpheline
    const known = new Set(ALL_ITEMS.map((item) => item.id));
    for (const id of Object.keys(texts).map(Number)) expect(known.has(id)).toBe(true);
  });

  it('le français reste la source et un identifiant inconnu retombe sur le repli', () => {
    const building = BUILDINGS[1];
    expect(localizeItem(building.id, 'fr', building).name).toBe('Mine de Métal');
    expect(localizeItem(building.id, 'en', building).name).toBe('Metal Mine');
    expect(localizeItem(999999, 'de', { name: 'repli' }).name).toBe('repli');
    expect(localizeItem(building.id, 'xx', building).name).toBe(building.name);
  });

  it('la langue de la requête localise les noms servis par l’API', () => {
    expect(itemName(BUILDINGS[1])).toBe('Mine de Métal');
    expect(withLocale('es', () => itemName(BUILDINGS[1]))).toBe('Mina de metal');
    expect(withLocale('it', () => itemNameById(212, 'Satellite Solaire'))).toBe('Satellite solare');
    expect(withLocale('fr', () => itemNameById(212, 'Satellite Solaire'))).toBe('Satellite Solaire');
  });
});

describe('emails multilingues', () => {
  const params = { username: 'Alice', link: 'https://exemple.test/verify-email?token=abc', newEmail: 'nouvelle@exemple.test' };

  it.each([...SUPPORTED_LOCALES])('%s : chaque modèle produit un objet et un texte non vides', (locale) => {
    for (const kind of MAIL_KINDS) {
      const mail = renderMail(kind, locale, params);
      expect(mail.subject).toContain('XNova Reforged');
      expect(mail.text.length).toBeGreaterThan(10);
    }
  });

  it.each([...SUPPORTED_LOCALES])('%s : les modèles à lien contiennent le lien et le pseudo', (locale) => {
    for (const kind of ['verifyEmail', 'resetPassword', 'changeEmailConfirm', 'adminEmailChanged'] as const) {
      const mail = renderMail(kind, locale, params);
      expect(mail.text).toContain(params.link);
      expect(mail.text).toContain('Alice');
    }
    expect(renderMail('changeEmailAlert', locale, params).text).toContain(params.newEmail);
    expect(renderMail('emailChanged', locale, params).text).toContain(params.newEmail);
  });

  it('les langues diffèrent bien entre elles', () => {
    const subjects = new Set(SUPPORTED_LOCALES.map((locale) => renderMail('verifyEmail', locale, params).subject));
    expect(subjects.size).toBe(SUPPORTED_LOCALES.length);
  });

  it('une langue inconnue retombe sur le français', () => {
    expect(renderMail('smtpTest', 'xx' as never).subject).toBe(renderMail('smtpTest', 'fr').subject);
  });
});

describe('libellés d’effets d’amélioration', () => {
  const planet: any = {
    metalMine: 3, crystalMine: 2, deuteriumMine: 1, solarPlant: 4, fusionPlant: 0, metalStorage: 0, crystalStorage: 0,
    deuteriumStorage: 0, roboticsFactory: 0, naniteFactory: 0, shipyard: 0, researchLab: 0, fieldsUsed: 5, fieldsMax: 163,
    metal: 0, crystal: 0, deuterium: 0, solarSatellites: 0, energyTechnology: 0,
  };
  const config = { baseIncome: { metal: 20, crystal: 10, deuterium: 0 }, resourceMultiplier: 1, gameSpeed: 1, storageBase: 1_000_000, storageFactor: 1.5, storageOverflow: 1.1 };
  const labels = (locale: 'fr' | 'en' | 'de') =>
    withLocale(locale, () => getBuildingUpgradeEffects(1, 3, planet, config as never, {}, {}).effects.map((effect) => effect.label));

  it('traduit les libellés selon la langue de la requête', () => {
    expect(labels('fr')).toContain('Rendement des mines');
    expect(labels('en')).toContain('Mine efficiency');
    expect(labels('de')).toContain('Effizienz der Minen');
  });
});
