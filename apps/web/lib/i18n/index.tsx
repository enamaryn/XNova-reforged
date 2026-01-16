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
      movement: "Mouvements",
      shipyard: "Chantier spatial",
      defense: "Défense",
      alliance: "Alliance",
      messages: "Messages",
      statistics: "Statistiques",
      reports: "Rapports",
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
        deploy: "Déploiement",
      },
      summary: "Résumé de mission",
      distance: "Distance",
      duration: "Durée estimée",
      fuel: "Consommation",
      capacity: "Capacité cargo",
      cargoSelected: "Cargaison",
    },
    movement: {
      kicker: "Centre de trafic",
      title: "Mouvements",
      subtitle: "Suivez vos flottes et leurs retours.",
      active: "Flottes actives",
      tracking: "Trafic spatial",
      refresh: "Mise à jour toutes les 10s",
      empty: "Aucune flotte en mouvement.",
      arrivalIn: "Arrivée dans",
      backIn: "Retour dans",
      recall: "Rappeler",
      recalling: "Rappel...",
      fleetSize: "Vaisseaux",
      status: {
        traveling: "En route",
        returning: "Retour",
        arrived: "Arrivé",
        completed: "Terminé",
      },
    },
    galaxy: {
      title: "Galaxie",
      subtitle: "Naviguez dans l’univers et repérez les systèmes disponibles.",
      scanSoon: "Scanner (bientôt)",
      freeSlot: "Position libre",
      loading: "Chargement du système...",
      activity: "Activité",
      activeNow: "Actif",
      moon: "Lune",
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
      movement: "Movements",
      shipyard: "Shipyard",
      defense: "Defense",
      alliance: "Alliance",
      messages: "Messages",
      statistics: "Statistics",
      reports: "Reports",
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
        deploy: "Deploy",
      },
      summary: "Mission summary",
      distance: "Distance",
      duration: "Estimated duration",
      fuel: "Consumption",
      capacity: "Cargo capacity",
      cargoSelected: "Cargo",
    },
    movement: {
      kicker: "Traffic control",
      title: "Movements",
      subtitle: "Track your fleets and returns.",
      active: "Active fleets",
      tracking: "Space traffic",
      refresh: "Refresh every 10s",
      empty: "No fleets in motion.",
      arrivalIn: "Arrival in",
      backIn: "Back in",
      recall: "Recall",
      recalling: "Recalling...",
      fleetSize: "Ships",
      status: {
        traveling: "En route",
        returning: "Returning",
        arrived: "Arrived",
        completed: "Completed",
      },
    },
    galaxy: {
      title: "Galaxy",
      subtitle: "Navigate the universe and spot available systems.",
      scanSoon: "Scan (soon)",
      freeSlot: "Empty slot",
      loading: "Loading system...",
      activity: "Activity",
      activeNow: "Online",
      moon: "Moon",
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
      movement: "Movimientos",
      shipyard: "Astillero",
      defense: "Defensa",
      alliance: "Alianza",
      messages: "Mensajes",
      statistics: "Estadísticas",
      reports: "Reportes",
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
        deploy: "Despliegue",
      },
      summary: "Resumen de misión",
      distance: "Distancia",
      duration: "Duración estimada",
      fuel: "Consumo",
      capacity: "Capacidad de carga",
      cargoSelected: "Carga",
    },
    movement: {
      kicker: "Control de tráfico",
      title: "Movimientos",
      subtitle: "Sigue tus flotas y sus retornos.",
      active: "Flotas activas",
      tracking: "Tráfico espacial",
      refresh: "Actualización cada 10s",
      empty: "No hay flotas en movimiento.",
      arrivalIn: "Llega en",
      backIn: "Regresa en",
      recall: "Retirar",
      recalling: "Retirando...",
      fleetSize: "Naves",
      status: {
        traveling: "En ruta",
        returning: "Regresando",
        arrived: "Llegó",
        completed: "Completado",
      },
    },
    galaxy: {
      title: "Galaxia",
      subtitle: "Navega el universo y detecta sistemas disponibles.",
      scanSoon: "Escanear (pronto)",
      freeSlot: "Posición libre",
      loading: "Cargando sistema...",
      activity: "Actividad",
      activeNow: "Activo",
      moon: "Luna",
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
