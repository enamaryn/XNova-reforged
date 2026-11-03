/** Support : signalements des joueurs (bugs, questions, suggestions) lus dans la console d'administration. */
export const SUPPORT_KINDS = ["bug", "question", "suggestion", "account"] as const;
export type SupportKind = (typeof SUPPORT_KINDS)[number];

export const SUPPORT_STATUSES = ["new", "seen", "resolved", "ignored"] as const;
export type SupportStatus = (typeof SUPPORT_STATUSES)[number];

export const SUPPORT_LIMITS = {
  subjectMin: 3,
  subjectMax: 120,
  bodyMin: 10,
  bodyMax: 4000,
  /** Signalements en attente (nouveau ou consulté) par joueur : au-delà, il faut attendre un traitement. */
  maxOpenPerUser: 5,
  /** Longueur d'une réponse de l'administrateur. */
  replyMin: 1,
  replyMax: 2000,
  /** Signalements récents affichés au joueur. */
  mineLimit: 20,
} as const;
