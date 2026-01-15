"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type Locale = "fr" | "en" | "es";

type Dictionary = Record<string, string | Dictionary>;

const translations: Record<Locale, Dictionary> = {
  fr: {
    nav: {
      overview: "Vue",
      buildings: "Bâtiments",
      research: "Recherche",
      galaxy: "Galaxie",
      fleet: "Flotte",
      shipyard: "Chantier spatial",
      defense: "Défense",
      alliance: "Alliance",
      messages: "Messages",
      statistics: "Statistiques",
      options: "Options",
    },
    sidebar: {
      principal: "Principal",
      construction: "Construction",
      fleet: "Flotte & Exploration",
      social: "Social",
      other: "Autre",
      quickAccess: "Accès rapide",
      planetView: "Vue planète",
    },
    fleet: {
      title: "Flotte",
      subtitle: "Préparez vos mouvements et missions.",
      compose: "Composer une flotte",
      availableShips: "Vaisseaux disponibles",
      mission: "Mission",
      destination: "Destination",
      sendSoon: "Envoyer la flotte (bientôt)",
      active: "Flottes en cours",
      none: "Aucune flotte en déplacement.",
      last: "Dernière mission : aucune.",
      missions: {
        transport: "Transport",
        attack: "Attaque",
        spy: "Espionnage",
        colonize: "Colonisation",
      },
    },
    galaxy: {
      title: "Galaxie",
      subtitle: "Naviguez dans l’univers et repérez les systèmes disponibles.",
      scanSoon: "Scanner (bientôt)",
      freeSlot: "Position libre",
      loading: "Chargement du système...",
    },
    common: {
      language: "Langue",
      contact: "Contact",
      you: "Vous",
      loading: "Chargement...",
      error: "Erreur de chargement.",
    },
    techCategory: {
      basic: "Fondations",
      drive: "Propulsions",
      advanced: "Avancé",
      combat: "Combat",
    },
  },
  en: {
    nav: {
      overview: "Overview",
      buildings: "Buildings",
      research: "Research",
      galaxy: "Galaxy",
      fleet: "Fleet",
      shipyard: "Shipyard",
      defense: "Defense",
      alliance: "Alliance",
      messages: "Messages",
      statistics: "Statistics",
      options: "Options",
    },
    sidebar: {
      principal: "Main",
      construction: "Construction",
      fleet: "Fleet & Exploration",
      social: "Social",
      other: "Other",
      quickAccess: "Quick Access",
      planetView: "Planet View",
    },
    fleet: {
      title: "Fleet",
      subtitle: "Prepare your moves and missions.",
      compose: "Compose a fleet",
      availableShips: "Available ships",
      mission: "Mission",
      destination: "Destination",
      sendSoon: "Send fleet (soon)",
      active: "Active fleets",
      none: "No fleets in transit.",
      last: "Last mission: none.",
      missions: {
        transport: "Transport",
        attack: "Attack",
        spy: "Espionage",
        colonize: "Colonization",
      },
    },
    galaxy: {
      title: "Galaxy",
      subtitle: "Navigate the universe and spot available systems.",
      scanSoon: "Scan (soon)",
      freeSlot: "Empty slot",
      loading: "Loading system...",
    },
    common: {
      language: "Language",
      contact: "Contact",
      you: "You",
      loading: "Loading...",
      error: "Loading error.",
    },
    techCategory: {
      basic: "Foundations",
      drive: "Drives",
      advanced: "Advanced",
      combat: "Combat",
    },
  },
  es: {
    nav: {
      overview: "Resumen",
      buildings: "Edificios",
      research: "Investigación",
      galaxy: "Galaxia",
      fleet: "Flota",
      shipyard: "Astillero",
      defense: "Defensa",
      alliance: "Alianza",
      messages: "Mensajes",
      statistics: "Estadísticas",
      options: "Opciones",
    },
    sidebar: {
      principal: "Principal",
      construction: "Construcción",
      fleet: "Flota y Exploración",
      social: "Social",
      other: "Otros",
      quickAccess: "Acceso rápido",
      planetView: "Vista planeta",
    },
    fleet: {
      title: "Flota",
      subtitle: "Prepara tus movimientos y misiones.",
      compose: "Componer una flota",
      availableShips: "Naves disponibles",
      mission: "Misión",
      destination: "Destino",
      sendSoon: "Enviar flota (pronto)",
      active: "Flotas activas",
      none: "No hay flotas en tránsito.",
      last: "Última misión: ninguna.",
      missions: {
        transport: "Transporte",
        attack: "Ataque",
        spy: "Espionaje",
        colonize: "Colonización",
      },
    },
    galaxy: {
      title: "Galaxia",
      subtitle: "Navega el universo y detecta sistemas disponibles.",
      scanSoon: "Escanear (pronto)",
      freeSlot: "Posición libre",
      loading: "Cargando sistema...",
    },
    common: {
      language: "Idioma",
      contact: "Contacto",
      you: "Tú",
      loading: "Cargando...",
      error: "Error de carga.",
    },
    techCategory: {
      basic: "Fundamentos",
      drive: "Propulsión",
      advanced: "Avanzado",
      combat: "Combate",
    },
  },
};

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

function resolveKey(dictionary: Dictionary, key: string): string | undefined {
  const parts = key.split(".");
  let current: Dictionary | string | undefined = dictionary;
  for (const part of parts) {
    if (!current || typeof current === "string") return undefined;
    current = current[part];
  }
  return typeof current === "string" ? current : undefined;
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>("fr");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("xnova-locale") as Locale | null;
    if (stored && ["fr", "en", "es"].includes(stored)) {
      setLocale(stored);
    }
  }, []);

  const handleSetLocale = useCallback((next: Locale) => {
    setLocale(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("xnova-locale", next);
    }
  }, []);

  const t = useCallback(
    (key: string) => {
      const dictionary = translations[locale];
      return resolveKey(dictionary, key) ?? key;
    },
    [locale],
  );

  const value = useMemo(
    () => ({
      locale,
      setLocale: handleSetLocale,
      t,
    }),
    [locale, handleSetLocale, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n doit être utilisé dans un I18nProvider");
  }
  return context;
}
