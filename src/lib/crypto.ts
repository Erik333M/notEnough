import * as Crypto from 'expo-crypto';

/**
 * Local-only credential hashing.
 *
 * NOTE: this app stores accounts on-device (no server). SHA-256 + per-user salt
 * with iteration stretching is appropriate for a local profile lock, but it is
 * NOT a substitute for bcrypt/argon2 on a real backend. If a server is added,
 * move verification server-side and keep only the session token on device.
 */

/**
 * Kept modest on purpose: every round is an async native digest call, and the
 * login screen must stay responsive on low-end Android. Raise this only if
 * hashing moves off the JS event loop.
 */
const ITERATIONS = 200;

export function makeSalt(): string {
  return Array.from(Crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function makeId(): string {
  return Crypto.randomUUID();
}

export async function hashPassword(password: string, salt: string): Promise<string> {
  let digest = `${salt}:${password}`;
  for (let i = 0; i < ITERATIONS; i += 1) {
    digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, digest);
  }
  return digest;
}

/** Constant-time-ish compare so timing does not leak the hash prefix. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
