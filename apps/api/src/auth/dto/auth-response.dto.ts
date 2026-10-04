export class AuthResponseDto {
  user: {
    id: string;
    username: string;
    email: string;
    points: number;
    rank: number;
    role: string;
    createdAt: Date;
  };

  tokens: {
    accessToken: string;
    refreshToken: string;
  };
}

/** Inscription lorsque la confirmation de l'adresse est obligatoire : aucune session n'est ouverte. */
export class RegistrationPendingDto {
  user: AuthResponseDto['user'];
  verificationRequired: true;
  message: string;
}
