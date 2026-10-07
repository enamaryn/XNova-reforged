import { networkInterfaces } from 'node:os';
import { isIP } from 'node:net';

export function bootstrapListenHost(value = process.env.XNOVA_BOOTSTRAP_HOST ?? '0.0.0.0') {
  if (!['0.0.0.0', '127.0.0.1'].includes(value)) {
    throw new Error('XNOVA_BOOTSTRAP_HOST doit être 0.0.0.0 (réseau) ou 127.0.0.1 (tunnel/proxy local).');
  }
  return value;
}

export function bootstrapUrls(host, interfaces = networkInterfaces()) {
  const addresses = new Set(['127.0.0.1']);
  if (host === '0.0.0.0') {
    for (const entries of Object.values(interfaces)) {
      for (const entry of entries || []) {
        if (!entry.internal && isIP(entry.address) === 4) addresses.add(entry.address);
      }
    }
  }
  return [...addresses].map(address => `http://${address}:3000`);
}
