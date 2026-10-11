import type { SupportedLocale } from '@xnova/game-config';

/**
 * Emails transactionnels, rédigés dans les cinq langues du jeu. La langue est celle du destinataire
 * (`User.locale`), à défaut celle de la requête ou la langue du serveur. Les liens (`/verify-email?token=…`)
 * restent identiques dans toutes les langues.
 */
export type MailKind =
  | 'verifyEmail'
  | 'resetPassword'
  | 'changeEmailConfirm'
  | 'changeEmailAlert'
  | 'emailChanged'
  | 'adminEmailChanged'
  | 'smtpTest'
  | 'setupSmtpTest';

export interface MailParams {
  username?: string;
  link?: string;
  newEmail?: string;
}

interface Template {
  subject: string;
  text: (p: Required<MailParams>) => string;
}

const BRAND = 'XNova Reforged';

const TEMPLATES: Record<SupportedLocale, Record<MailKind, Template>> = {
  fr: {
    verifyEmail: {
      subject: `${BRAND} - confirmez votre adresse email`,
      text: (p) =>
        `Bonjour ${p.username},\n\nConfirmez votre adresse email avec ce lien (valable 24 heures) :\n${p.link}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez ce message.`,
    },
    resetPassword: {
      subject: `${BRAND} - réinitialisation du mot de passe`,
      text: (p) =>
        `Bonjour ${p.username},\n\nPour choisir un nouveau mot de passe, utilisez ce lien (valable 1 heure) :\n${p.link}\n\nSi vous n'avez rien demandé, ignorez ce message : votre mot de passe reste inchangé.`,
    },
    changeEmailConfirm: {
      subject: `${BRAND} - confirmez votre nouvelle adresse email`,
      text: (p) =>
        `Bonjour ${p.username},\n\nConfirmez cette adresse comme nouvelle adresse de votre compte (lien valable 24 heures) :\n${p.link}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez ce message.`,
    },
    changeEmailAlert: {
      subject: `${BRAND} - demande de changement d'adresse email`,
      text: (p) =>
        `Bonjour ${p.username},\n\nUne demande de changement de votre adresse email vers ${p.newEmail} a été faite. Elle ne prendra effet qu'après confirmation depuis la nouvelle adresse.\nSi ce n'est pas vous, changez votre mot de passe sans attendre.`,
    },
    emailChanged: {
      subject: `${BRAND} - votre adresse email a été modifiée`,
      text: (p) => `Bonjour ${p.username},\n\nL'adresse email de votre compte est désormais ${p.newEmail}.`,
    },
    adminEmailChanged: {
      subject: `${BRAND} - confirmez votre nouvelle adresse email`,
      text: (p) =>
        `Bonjour ${p.username},\n\nVotre adresse email a été modifiée par un administrateur. Confirmez cette adresse pour pouvoir vous connecter (lien valable 24 heures) :\n${p.link}`,
    },
    smtpTest: {
      subject: `${BRAND} - test de la configuration SMTP`,
      text: () => 'Si vous lisez ce message, la configuration SMTP fonctionne.',
    },
    setupSmtpTest: {
      subject: `${BRAND} - test de la configuration SMTP (installation)`,
      text: () =>
        "Si vous lisez ce message, l'envoi d'emails du serveur fonctionne. Vous pouvez continuer l'installation.",
    },
  },
  en: {
    verifyEmail: {
      subject: `${BRAND} - confirm your email address`,
      text: (p) =>
        `Hello ${p.username},\n\nConfirm your email address with this link (valid for 24 hours):\n${p.link}\n\nIf you did not make this request, please ignore this message.`,
    },
    resetPassword: {
      subject: `${BRAND} - password reset`,
      text: (p) =>
        `Hello ${p.username},\n\nTo choose a new password, use this link (valid for 1 hour):\n${p.link}\n\nIf you did not ask for this, ignore this message: your password stays unchanged.`,
    },
    changeEmailConfirm: {
      subject: `${BRAND} - confirm your new email address`,
      text: (p) =>
        `Hello ${p.username},\n\nConfirm this address as the new email address of your account (link valid for 24 hours):\n${p.link}\n\nIf you did not make this request, please ignore this message.`,
    },
    changeEmailAlert: {
      subject: `${BRAND} - email address change requested`,
      text: (p) =>
        `Hello ${p.username},\n\nA request to change your email address to ${p.newEmail} was made. It only takes effect once confirmed from the new address.\nIf this was not you, change your password right away.`,
    },
    emailChanged: {
      subject: `${BRAND} - your email address was changed`,
      text: (p) => `Hello ${p.username},\n\nThe email address of your account is now ${p.newEmail}.`,
    },
    adminEmailChanged: {
      subject: `${BRAND} - confirm your new email address`,
      text: (p) =>
        `Hello ${p.username},\n\nYour email address was changed by an administrator. Confirm this address to be able to log in (link valid for 24 hours):\n${p.link}`,
    },
    smtpTest: {
      subject: `${BRAND} - SMTP configuration test`,
      text: () => 'If you are reading this message, the SMTP configuration works.',
    },
    setupSmtpTest: {
      subject: `${BRAND} - SMTP configuration test (installation)`,
      text: () => 'If you are reading this message, the server can send emails. You can continue the installation.',
    },
  },
  es: {
    verifyEmail: {
      subject: `${BRAND} - confirme su dirección de correo`,
      text: (p) =>
        `Hola ${p.username}:\n\nConfirme su dirección de correo con este enlace (válido durante 24 horas):\n${p.link}\n\nSi usted no ha hecho esta solicitud, ignore este mensaje.`,
    },
    resetPassword: {
      subject: `${BRAND} - restablecimiento de la contraseña`,
      text: (p) =>
        `Hola ${p.username}:\n\nPara elegir una nueva contraseña, use este enlace (válido durante 1 hora):\n${p.link}\n\nSi no ha pedido nada, ignore este mensaje: su contraseña no cambia.`,
    },
    changeEmailConfirm: {
      subject: `${BRAND} - confirme su nueva dirección de correo`,
      text: (p) =>
        `Hola ${p.username}:\n\nConfirme esta dirección como la nueva dirección de su cuenta (enlace válido durante 24 horas):\n${p.link}\n\nSi usted no ha hecho esta solicitud, ignore este mensaje.`,
    },
    changeEmailAlert: {
      subject: `${BRAND} - solicitud de cambio de dirección de correo`,
      text: (p) =>
        `Hola ${p.username}:\n\nSe ha solicitado cambiar su dirección de correo a ${p.newEmail}. Solo surtirá efecto tras confirmarla desde la nueva dirección.\nSi no ha sido usted, cambie su contraseña sin demora.`,
    },
    emailChanged: {
      subject: `${BRAND} - su dirección de correo ha sido modificada`,
      text: (p) => `Hola ${p.username}:\n\nLa dirección de correo de su cuenta es ahora ${p.newEmail}.`,
    },
    adminEmailChanged: {
      subject: `${BRAND} - confirme su nueva dirección de correo`,
      text: (p) =>
        `Hola ${p.username}:\n\nUn administrador ha modificado su dirección de correo. Confírmela para poder iniciar sesión (enlace válido durante 24 horas):\n${p.link}`,
    },
    smtpTest: {
      subject: `${BRAND} - prueba de la configuración SMTP`,
      text: () => 'Si lee este mensaje, la configuración SMTP funciona.',
    },
    setupSmtpTest: {
      subject: `${BRAND} - prueba de la configuración SMTP (instalación)`,
      text: () => 'Si lee este mensaje, el servidor puede enviar correos. Puede continuar con la instalación.',
    },
  },
  de: {
    verifyEmail: {
      subject: `${BRAND} - E-Mail-Adresse bestätigen`,
      text: (p) =>
        `Hallo ${p.username},\n\nBestätigen Sie Ihre E-Mail-Adresse mit diesem Link (24 Stunden gültig):\n${p.link}\n\nWenn Sie diese Anfrage nicht gestellt haben, ignorieren Sie diese Nachricht.`,
    },
    resetPassword: {
      subject: `${BRAND} - Passwort zurücksetzen`,
      text: (p) =>
        `Hallo ${p.username},\n\nUm ein neues Passwort zu wählen, nutzen Sie diesen Link (1 Stunde gültig):\n${p.link}\n\nWenn Sie nichts angefordert haben, ignorieren Sie diese Nachricht: Ihr Passwort bleibt unverändert.`,
    },
    changeEmailConfirm: {
      subject: `${BRAND} - neue E-Mail-Adresse bestätigen`,
      text: (p) =>
        `Hallo ${p.username},\n\nBestätigen Sie diese Adresse als neue E-Mail-Adresse Ihres Kontos (Link 24 Stunden gültig):\n${p.link}\n\nWenn Sie diese Anfrage nicht gestellt haben, ignorieren Sie diese Nachricht.`,
    },
    changeEmailAlert: {
      subject: `${BRAND} - Änderung der E-Mail-Adresse beantragt`,
      text: (p) =>
        `Hallo ${p.username},\n\nEs wurde beantragt, Ihre E-Mail-Adresse auf ${p.newEmail} zu ändern. Die Änderung gilt erst nach Bestätigung von der neuen Adresse aus.\nWenn Sie das nicht waren, ändern Sie sofort Ihr Passwort.`,
    },
    emailChanged: {
      subject: `${BRAND} - Ihre E-Mail-Adresse wurde geändert`,
      text: (p) => `Hallo ${p.username},\n\nDie E-Mail-Adresse Ihres Kontos lautet jetzt ${p.newEmail}.`,
    },
    adminEmailChanged: {
      subject: `${BRAND} - neue E-Mail-Adresse bestätigen`,
      text: (p) =>
        `Hallo ${p.username},\n\nIhre E-Mail-Adresse wurde von einem Administrator geändert. Bestätigen Sie diese Adresse, um sich anmelden zu können (Link 24 Stunden gültig):\n${p.link}`,
    },
    smtpTest: {
      subject: `${BRAND} - Test der SMTP-Konfiguration`,
      text: () => 'Wenn Sie diese Nachricht lesen, funktioniert die SMTP-Konfiguration.',
    },
    setupSmtpTest: {
      subject: `${BRAND} - Test der SMTP-Konfiguration (Installation)`,
      text: () =>
        'Wenn Sie diese Nachricht lesen, kann der Server E-Mails senden. Sie können die Installation fortsetzen.',
    },
  },
  it: {
    verifyEmail: {
      subject: `${BRAND} - conferma il tuo indirizzo email`,
      text: (p) =>
        `Ciao ${p.username},\n\nConferma il tuo indirizzo email con questo link (valido per 24 ore):\n${p.link}\n\nSe non hai fatto tu questa richiesta, ignora questo messaggio.`,
    },
    resetPassword: {
      subject: `${BRAND} - reimpostazione della password`,
      text: (p) =>
        `Ciao ${p.username},\n\nPer scegliere una nuova password, usa questo link (valido per 1 ora):\n${p.link}\n\nSe non hai richiesto nulla, ignora questo messaggio: la tua password resta invariata.`,
    },
    changeEmailConfirm: {
      subject: `${BRAND} - conferma il tuo nuovo indirizzo email`,
      text: (p) =>
        `Ciao ${p.username},\n\nConferma questo indirizzo come nuovo indirizzo del tuo account (link valido per 24 ore):\n${p.link}\n\nSe non hai fatto tu questa richiesta, ignora questo messaggio.`,
    },
    changeEmailAlert: {
      subject: `${BRAND} - richiesta di cambio dell'indirizzo email`,
      text: (p) =>
        `Ciao ${p.username},\n\nÈ stata fatta una richiesta per cambiare il tuo indirizzo email in ${p.newEmail}. Avrà effetto solo dopo la conferma dal nuovo indirizzo.\nSe non sei stato tu, cambia subito la password.`,
    },
    emailChanged: {
      subject: `${BRAND} - il tuo indirizzo email è stato modificato`,
      text: (p) => `Ciao ${p.username},\n\nL'indirizzo email del tuo account è ora ${p.newEmail}.`,
    },
    adminEmailChanged: {
      subject: `${BRAND} - conferma il tuo nuovo indirizzo email`,
      text: (p) =>
        `Ciao ${p.username},\n\nIl tuo indirizzo email è stato modificato da un amministratore. Confermalo per poter accedere (link valido per 24 ore):\n${p.link}`,
    },
    smtpTest: {
      subject: `${BRAND} - test della configurazione SMTP`,
      text: () => 'Se leggi questo messaggio, la configurazione SMTP funziona.',
    },
    setupSmtpTest: {
      subject: `${BRAND} - test della configurazione SMTP (installazione)`,
      text: () => "Se leggi questo messaggio, il server può inviare email. Puoi continuare l'installazione.",
    },
  },
};

export function renderMail(
  kind: MailKind,
  locale: SupportedLocale,
  params: MailParams = {},
): { subject: string; text: string } {
  const template = TEMPLATES[locale]?.[kind] ?? TEMPLATES.fr[kind];
  return {
    subject: template.subject,
    text: template.text({ username: '', link: '', newEmail: '', ...params }),
  };
}

export const MAIL_KINDS: readonly MailKind[] = Object.keys(TEMPLATES.fr) as MailKind[];
