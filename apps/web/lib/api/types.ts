export interface ApiErrorPayload {
  message?: string | string[];
  error?: string;
  statusCode?: number;
  /** Code applicatif, ex. EMAIL_NOT_VERIFIED. */
  code?: string;
}

export interface AuthUserDto {
  id: string;
  username: string;
  email: string;
  points: number;
  rank: number;
  role: string;
  createdAt: string;
  /** Date de confirmation de l'adresse email ; absent ou null tant qu'elle n'est pas confirmée. */
  emailVerifiedAt?: string | null;
}

/** Réponse d'inscription lorsque la confirmation de l'adresse est obligatoire : aucune session. */
export interface RegistrationPendingDto {
  user: AuthUserDto;
  verificationRequired: true;
  message: string;
}

export interface AuthTokensDto {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponseDto {
  user: AuthUserDto;
  tokens: AuthTokensDto;
}
