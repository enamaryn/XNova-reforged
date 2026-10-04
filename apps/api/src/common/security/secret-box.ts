import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const PREFIX = 'enc:v1:';
const SALT = 'xnova-secret-box-v1';

/**
 * Clé de chiffrement des secrets stockés en base (mot de passe SMTP).
 * `SECRETS_ENCRYPTION_KEY` est recommandée ; à défaut, `JWT_SECRET` sert de matière première.
 * Changer cette valeur rend les secrets déjà enregistrés illisibles : ils doivent être ressaisis.
 */
function deriveKey(): Buffer {
  const material = process.env.SECRETS_ENCRYPTION_KEY?.trim() || process.env.JWT_SECRET?.trim();
  if (!material) {
    throw new Error('SECRETS_ENCRYPTION_KEY ou JWT_SECRET requis pour chiffrer les secrets');
  }
  return scryptSync(material, SALT, 32);
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', deriveKey(), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${data.toString('base64')}`;
}

/** Retourne null si la valeur est absente, mal formée ou illisible avec la clé courante. */
export function decryptSecret(stored: string | null | undefined): string | null {
  if (!stored || !stored.startsWith(PREFIX)) return null;
  const [iv, tag, data] = stored.slice(PREFIX.length).split(':');
  if (!iv || !tag || !data) return null;
  try {
    const decipher = createDecipheriv('aes-256-gcm', deriveKey(), Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}
