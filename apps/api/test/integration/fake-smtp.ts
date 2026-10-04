import { createServer, Server, Socket } from 'net';

export interface ReceivedMail {
  from: string;
  to: string[];
  data: string;
  /** Corps décodé (quoted-printable) pour y chercher des liens. */
  body: string;
}

const decodeQuotedPrintable = (input: string) =>
  input
    .replace(/=\r?\n/g, '')
    .replace(/=([0-9A-F]{2})/gi, (_m, hex) => String.fromCharCode(parseInt(hex, 16)));

/** Faux serveur SMTP minimal (sans TLS) qui enregistre les messages reçus. */
export class FakeSmtp {
  port = 0;
  readonly mails: ReceivedMail[] = [];
  private server!: Server;

  async start() {
    this.server = createServer((socket: Socket) => {
      let from = '';
      let to: string[] = [];
      let data = '';
      let inData = false;
      let buffer = '';
      socket.write('220 fake.smtp ESMTP\r\n');
      socket.on('data', (chunk) => {
        buffer += chunk.toString('utf8');
        let index: number;
        while ((index = buffer.indexOf('\r\n')) >= 0) {
          const line = buffer.slice(0, index);
          buffer = buffer.slice(index + 2);
          if (inData) {
            if (line === '.') {
              inData = false;
              this.mails.push({ from, to, data, body: decodeQuotedPrintable(data) });
              data = '';
              to = [];
              socket.write('250 OK queued\r\n');
            } else {
              data += `${line}\n`;
            }
            continue;
          }
          const upper = line.toUpperCase();
          if (upper.startsWith('EHLO')) socket.write('250-fake.smtp\r\n250 AUTH PLAIN LOGIN\r\n');
          else if (upper.startsWith('AUTH')) socket.write('235 OK\r\n');
          else if (upper.startsWith('MAIL FROM')) {
            from = line.replace(/^MAIL FROM:\s*<?/i, '').replace(/>.*$/, '');
            socket.write('250 OK\r\n');
          } else if (upper.startsWith('RCPT TO')) {
            to.push(line.replace(/^RCPT TO:\s*<?/i, '').replace(/>.*$/, ''));
            socket.write('250 OK\r\n');
          } else if (upper === 'DATA') {
            inData = true;
            socket.write('354 go\r\n');
          } else if (upper === 'QUIT') {
            socket.write('221 bye\r\n');
            socket.end();
          } else socket.write('250 OK\r\n');
        }
      });
      socket.on('error', () => undefined);
    });
    await new Promise<void>((resolve) => this.server.listen(0, '127.0.0.1', resolve));
    this.port = (this.server.address() as { port: number }).port;
  }

  async stop() {
    await new Promise((resolve) => this.server?.close(resolve));
  }

  clear() {
    this.mails.length = 0;
  }

  /** Attend un message adressé à `recipient` (les envois d'email se font hors de la réponse HTTP). */
  async waitFor(recipient: string, timeoutMs = 5000): Promise<ReceivedMail> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const found = [...this.mails].reverse().find((mail) => mail.to.includes(recipient));
      if (found) return found;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error(`Aucun email reçu pour ${recipient}`);
  }

  /** Vérifie qu'aucun message n'arrive pour `recipient` pendant `waitMs`. */
  async expectNone(recipient: string, waitMs = 400) {
    await new Promise((resolve) => setTimeout(resolve, waitMs));
    return !this.mails.some((mail) => mail.to.includes(recipient));
  }
}

export const extractToken = (mail: ReceivedMail): string => {
  const match = mail.body.match(/token=([A-Za-z0-9_-]+)/);
  if (!match) throw new Error('Aucun jeton dans le message');
  return match[1];
};
