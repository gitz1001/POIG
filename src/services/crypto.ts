/* ============================================================
   Crypto Service — AES-GCM encryption for local exports
   ============================================================ */

const ITERATIONS = 100000;
const KEY_LENGTH = 256;
const SALT_SIZE = 16;
const IV_SIZE = 12;

/**
 * Generate a random salt/iv as a hex string.
 */
export function generateRandomHex(bytes: number): string {
  const array = new Uint8Array(bytes);
  crypto.getRandomValues(array);
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Convert a hex string back to a Uint8Array.
 */
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Hash a PIN using SHA-256 (for verifying during login/import).
 */
export async function hashPin(pin: string, saltHex: string): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(pin),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  
  const salt = hexToBytes(saltHex) as BufferSource;
  const hashBuffer = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: ITERATIONS,
      hash: 'SHA-256'
    },
    keyMaterial,
    256
  );
  
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Derive an AES-GCM key from a PIN and salt using PBKDF2.
 */
async function deriveKey(pin: string, saltHex: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(pin),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  
  const salt = hexToBytes(saltHex) as BufferSource;
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: ITERATIONS,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt a JSON string using AES-GCM and a PIN-derived key.
 * Returns { ciphertext, iv } (both as hex strings).
 */
export async function encryptData(data: string, pin: string, saltHex: string): Promise<{ ciphertext: string; iv: string }> {
  const key = await deriveKey(pin, saltHex);
  const iv = new Uint8Array(IV_SIZE);
  crypto.getRandomValues(iv);
  
  const enc = new TextEncoder();
  const cipherBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    enc.encode(data)
  );
  
  const ciphertextHex = Array.from(new Uint8Array(cipherBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  const ivHex = Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join('');
  
  return { ciphertext: ciphertextHex, iv: ivHex };
}

/**
 * Decrypt a hex ciphertext using AES-GCM and a PIN-derived key.
 * Returns the decrypted JSON string.
 */
export async function decryptData(ciphertextHex: string, ivHex: string, pin: string, saltHex: string): Promise<string> {
  const key = await deriveKey(pin, saltHex);
  const iv = hexToBytes(ivHex);
  const ciphertext = hexToBytes(ciphertextHex);
  
  const plainBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    ciphertext as BufferSource
  );
  
  const dec = new TextDecoder();
  return dec.decode(plainBuffer);
}
