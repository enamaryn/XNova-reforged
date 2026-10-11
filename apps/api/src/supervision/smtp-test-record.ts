export const SMTP_LAST_TEST_KEY = 'monitoring.smtp.lastTest';

interface ConfigDb {
  gameConfig: {
    upsert(args: {
      where: { key: string };
      create: { key: string; value: string };
      update: { value: string };
    }): Promise<unknown>;
  };
}

/** Conserve localement le résultat du dernier test SMTP (date + succès, jamais le message ni les identifiants). */
export async function recordSmtpTest(db: unknown, ok: boolean): Promise<void> {
  const value = JSON.stringify({ at: new Date().toISOString(), ok });
  try {
    await (db as ConfigDb).gameConfig.upsert({
      where: { key: SMTP_LAST_TEST_KEY },
      create: { key: SMTP_LAST_TEST_KEY, value },
      update: { value },
    });
  } catch {
    // La supervision ne doit jamais faire échouer le test d'envoi
  }
}
