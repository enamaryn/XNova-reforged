# Guide i18n - XNova Reforged

> Guide d'utilisation du système multi-langue avec next-intl
> Date : 20 janvier 2026

---

## 📚 Vue d'ensemble

Le projet utilise **next-intl** pour gérer l'internationalisation (i18n) avec Next.js 15 App Router. Le système supporte **cinq langues : français (fr, langue par défaut), anglais (en), espagnol (es), allemand (de) et italien (it)**.

### Architecture

```
apps/web/
├── i18n/
│   ├── config.ts          # Configuration des locales
│   ├── request.ts         # Configuration next-intl
│   └── messages/
│       ├── fr.json …      # Pages publiques et authentification (next-intl), 5 langues
│   └── game/
│       └── fr.json …      # Interface de jeu (provider `useI18n`), 5 langues
├── middleware.ts          # Middleware de détection de langue
└── app/
    ├── layout.tsx         # Root layout
    └── [locale]/          # Routes localisées
        ├── layout.tsx     # Layout avec provider i18n
        ├── (auth)/        # Pages d'authentification
        ├── (game)/        # Pages de jeu
        └── (admin)/       # Pages d'administration
```

---

## 🚀 Utilisation

### 1. Dans les Server Components

```tsx
import { useTranslations } from 'next-intl';

export default function MyPage() {
  const t = useTranslations('namespace');

  return (
    <div>
      <h1>{t('title')}</h1>
      <p>{t('description')}</p>
    </div>
  );
}
```

### 2. Dans les Client Components

```tsx
'use client';

import { useTranslations } from 'next-intl';

export function MyComponent() {
  const t = useTranslations('namespace');

  return <button>{t('submit')}</button>;
}
```

### 3. Avec des paramètres

```tsx
// Dans fr.json : "welcome": "Bienvenue, {name} !"
// Dans en.json : "welcome": "Welcome, {name}!"

const t = useTranslations('common');
<p>{t('welcome', { name: 'Claude' })}</p>
// Résultat : "Bienvenue, Claude !"
```

---

## 📝 Structure des traductions

### Fichiers de traduction

Les traductions sont organisées par **namespace** dans les fichiers JSON :

```json
{
  "auth": {
    "login": {
      "title": "Se connecter",
      "submit": "Connexion",
      "error": {
        "invalidCredentials": "Email ou mot de passe incorrect"
      }
    }
  },
  "common": {
    "loading": "Chargement...",
    "save": "Enregistrer",
    "cancel": "Annuler"
  }
}
```

### Namespaces recommandés

- `auth` - Authentification (login, register, forgot-password)
- `common` - Éléments communs (boutons, messages d'erreur)
- `resources` - Noms des ressources (metal, crystal, deuterium)
- `buildings` - Noms et descriptions des bâtiments
- `research` - Noms et descriptions des technologies
- `fleet` - Gestion de flotte
- `messages` - Messagerie
- `alliance` - Système d'alliances
- `errors` - Messages d'erreur

---

## 🔧 Configuration

### Ajouter une nouvelle langue

1. **Ajouter la locale dans la configuration**

```typescript
// i18n/config.ts
export const locales = ['fr', 'en', 'es'] as const; // Ajouter 'es'

export const localeNames: Record<Locale, string> = {
  fr: 'Français',
  en: 'English',
  es: 'Español', // Ajouter le nom
};
```

2. **Créer le fichier de traduction**

```bash
cp i18n/messages/fr.json i18n/messages/es.json
# Traduire le contenu...
```

3. **C'est tout !** Le middleware et le système de routing gèrent automatiquement la nouvelle langue.

---

## 🌐 Sélecteur de langue

Le composant `LanguageSwitcher` est disponible pour changer de langue :

```tsx
import { LanguageSwitcher } from '@/components/language-switcher';

export function Header() {
  return (
    <header>
      <nav>{/* ... */}</nav>
      <LanguageSwitcher />
    </header>
  );
}
```

### Fonctionnement

- Affiche la langue actuelle avec une icône globe
- Menu déroulant au survol avec toutes les langues disponibles
- Persist la préférence dans un cookie `NEXT_LOCALE`
- Redirige vers l'URL avec le bon préfixe de locale

---

## 🛣️ Routing avec locales

### Structure des URLs

Toutes les routes sont préfixées par la locale :

```
/fr/login          → Page de connexion en français
/en/login          → Page de connexion en anglais
/fr/overview       → Vue d'ensemble en français
/en/buildings      → Bâtiments en anglais
```

### Middleware

Le middleware `/home/didrod/Documents/projet GITHUB/XNova-reforged/apps/web/middleware.ts` gère :

1. **Détection de langue** - Cookie > Accept-Language > défaut (fr)
2. **Redirection** - `/login` → `/fr/login` automatiquement
3. **Authentification** - Protège les routes de jeu
4. **Header x-locale** - Transmet la locale aux pages

### Liens internes

Utilisez toujours des chemins relatifs sans le préfixe de locale :

```tsx
import Link from 'next/link';

// ✅ BON
<Link href="/overview">Vue d'ensemble</Link>

// ❌ MAUVAIS
<Link href="/fr/overview">Vue d'ensemble</Link>
```

Le middleware ajoutera automatiquement le bon préfixe.

---

## 📖 Exemples pratiques

### Exemple 1 : Page avec formulaire

```tsx
// app/[locale]/(auth)/login/page.tsx
import { useTranslations } from 'next-intl';
import { LoginForm } from '@/components/auth/LoginForm';

export default function LoginPage() {
  const t = useTranslations('auth.login');

  return (
    <div>
      <h1>{t('title')}</h1>
      <p>{t('subtitle')}</p>
      <LoginForm />
    </div>
  );
}
```

### Exemple 2 : Composant client avec traductions

```tsx
// components/auth/LoginForm.tsx
'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

export function LoginForm() {
  const t = useTranslations('auth.login');

  return (
    <form>
      <label>{t('emailLabel')}</label>
      <input placeholder={t('emailPlaceholder')} />

      <label>{t('passwordLabel')}</label>
      <input type="password" placeholder={t('passwordPlaceholder')} />

      <Button type="submit">{t('submit')}</Button>
    </form>
  );
}
```

### Exemple 3 : Messages d'erreur dynamiques

```tsx
const t = useTranslations('errors');

try {
  await api.call();
} catch (error) {
  if (error instanceof ApiError) {
    toast.error(t(error.code)); // Traduit automatiquement le code d'erreur
  } else {
    toast.error(t('unknownError'));
  }
}
```

---

## 🐛 Dépannage

### Problème : "useTranslations must be called in a component"

**Solution** : Assurez-vous que le composant est bien dans le dossier `app/[locale]/` et wrappé par le layout qui fournit `NextIntlClientProvider`.

### Problème : Clé de traduction manquante

**Solution** : next-intl retourne la clé elle-même si la traduction n'existe pas. Vérifiez :

1. Le namespace est correct (`'auth.login'` pas `'auth/login'`)
2. La clé existe dans TOUS les fichiers de langue
3. Pas de faute de frappe dans le chemin

### Problème : La langue ne change pas

**Solution** :
1. Vérifiez que le cookie `NEXT_LOCALE` est bien défini
2. Effacez le cache du navigateur
3. Vérifiez que le middleware s'exécute correctement

---

## ✅ Bonnes pratiques

### 1. Organisation des traductions

✅ **Grouper par fonctionnalité**
```json
{
  "auth": { ... },
  "fleet": { ... },
  "buildings": { ... }
}
```

❌ **Éviter les traductions plates**
```json
{
  "loginTitle": "...",
  "loginButton": "...",
  "buildingsTitle": "..."
}
```

### 2. Nommage des clés

✅ **Utiliser des noms descriptifs**
```json
{
  "auth": {
    "login": {
      "submit": "Se connecter",
      "forgotPassword": "Mot de passe oublié ?"
    }
  }
}
```

❌ **Éviter les abréviations**
```json
{
  "auth": {
    "lgn": {
      "btn": "...",
      "frgt": "..."
    }
  }
}
```

### 3. Cohérence entre les langues

✅ **Même structure dans tous les fichiers**
```json
// fr.json
{ "auth": { "login": { "title": "..." } } }

// en.json
{ "auth": { "login": { "title": "..." } } }
```

### 4. Validation

Avant chaque commit, vérifiez :
- [ ] Toutes les clés existent dans FR et EN
- [ ] Pas de clés orphelines (présentes dans une langue seulement)
- [ ] Les paramètres `{name}` sont identiques dans toutes les langues
- [ ] Le build passe sans erreur TypeScript

---

## 🔗 Ressources

- [Documentation next-intl](https://next-intl-docs.vercel.app/)
- [Next.js 15 i18n](https://nextjs.org/docs/app/building-your-application/routing/internationalization)
- [Fichiers de configuration i18n](/home/didrod/Documents/projet GITHUB/XNova-reforged/apps/web/i18n/)

---

**📌 Document maintenu par l'équipe de développement XNova Reforged**


---

## Mise à jour du 10 octobre 2026 : un seul état de langue

- La langue vient **toujours de l'URL** (`/[locale]/…`). `useI18n()` (interface de jeu) lit la locale de next-intl ; `setLocale()` écrit le cookie `NEXT_LOCALE` et navigue vers le même chemin dans l'autre langue (même logique que `LanguageSwitcher`, partagée dans `lib/i18n/locale.ts`). L'ancien état `localStorage` (`xnova-locale`, fr/en/es seulement) est supprimé.
- Deux jeux de messages : `apps/web/i18n/messages/*.json` (`useTranslations`, pages publiques et authentification) et `apps/web/i18n/game/*.json` (`useI18n().t('clé')`, interface de jeu). Les deux existent dans les **cinq** langues.
- `t('clé', { param: valeur })` remplace les marqueurs `{param}`. Repli si une clé manque : langue courante, puis anglais, puis français, puis la clé elle-même.
- **Ajouter un texte :** créer la clé dans les cinq fichiers du jeu, puis `npm run test:i18n` (mêmes clés, mêmes marqueurs, aucune valeur vide). La CI exécute ce test.
- **Migré le 10 octobre 2026 (lot 1) :** vue d'ensemble, chantier, défense, bâtiments, recherche, flotte (résidus), énergie/ressources, commandant.
- **Dette connue (lot 2) :** rapports de combat et d'espionnage, page publique, paramètres du compte, pages mot de passe/vérification, erreurs globales. L'assistant d'installation et la console d'administration (opérateurs) restent en français. Les noms/descriptions du jeu et les messages d'erreur de l'API sont servis en français par le serveur. Les emails sont envoyés en français uniquement.
