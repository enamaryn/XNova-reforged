import { ConfigService } from '@nestjs/config';

/**
 * La confirmation de l'adresse email est obligatoire pour créer un compte et se connecter.
 * Désactivable uniquement par `EMAIL_VERIFICATION_REQUIRED=false` (développement, tests) ; lue à chaque
 * requête.
 */
export function isEmailVerificationRequired(config: ConfigService): boolean {
  return String(config.get('EMAIL_VERIFICATION_REQUIRED') ?? 'true').trim().toLowerCase() !== 'false';
}

export const EMAIL_NOT_VERIFIED = 'EMAIL_NOT_VERIFIED';
