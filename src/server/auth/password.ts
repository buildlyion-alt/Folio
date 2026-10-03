import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto'

/*
 * Password hashing with scrypt (memory-hard, built into Node — no native addon).
 * Parameters follow OWASP's scrypt guidance (N=2^14, r=8, p=5) and are stored in the
 * hash string itself, so they can be raised later without invalidating old hashes.
 *
 * Format: scrypt$<N>$<r>$<p>$<salt b64>$<key b64>
 */

const KEY_LENGTH = 64
const DEFAULTS = { N: 16_384, r: 8, p: 5 }

function derive(password: string, salt: Buffer, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password.normalize('NFKC'), salt, KEY_LENGTH, { ...options, maxmem: 64 * 1024 * 1024 }, (error, key) =>
      error ? reject(error) : resolve(key)
    )
  })
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const key = await derive(password, salt, DEFAULTS)
  return ['scrypt', DEFAULTS.N, DEFAULTS.r, DEFAULTS.p, salt.toString('base64'), key.toString('base64')].join('$')
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, n, r, p, saltB64, keyB64] = stored.split('$')
  if (scheme !== 'scrypt' || !saltB64 || !keyB64) return false
  const expected = Buffer.from(keyB64, 'base64')
  const actual = await derive(password, Buffer.from(saltB64, 'base64'), {
    N: Number(n),
    r: Number(r),
    p: Number(p)
  })
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

/**
 * A hash of a random password, verified against when an email isn't registered so that
 * "unknown email" and "wrong password" take the same time (no account enumeration by timing).
 */
let decoyHash: Promise<string> | null = null
export function getDecoyHash(): Promise<string> {
  decoyHash ??= hashPassword(randomBytes(16).toString('hex'))
  return decoyHash
}
