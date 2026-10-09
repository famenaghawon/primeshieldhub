// auth-helpers.js
// Shared authentication utilities for Worker and migration scripts

export function base64url(str) {
  return btoa(str)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function base64urlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return atob(str);
}

export function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  cookieHeader.split(';').forEach(cookie => {
    const [name, ...rest] = cookie.trim().split('=');
    if (name) cookies[name] = rest.join('=');
  });
  return cookies;
}

export function safeCompare(a, b) {
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export async function hashPassword(password, salt = null) {
  const encoder = new TextEncoder();
  if (!salt) {
    salt = crypto.getRandomValues(new Uint8Array(16));
  } else if (typeof salt === 'string') {
    salt = new Uint8Array(salt.split(',').map(Number));
  }
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256"
    },
    keyMaterial,
    256
  );
  const hashArray = Array.from(new Uint8Array(derivedBits));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  return { hash: hashHex, salt: Array.from(salt).join(',') };
}

export async function verifyPassword(input, storedHash, storedSalt) {
  const { hash } = await hashPassword(input, storedSalt.split(',').map(Number));
  return safeCompare(hash, storedHash);
}

export async function signRaw(data, secret) {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(data));
  return base64url(String.fromCharCode(...new Uint8Array(signature)));
}

export async function generateJWT(payload, secret) {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64url(JSON.stringify(payload));
  const signature = await signRaw(`${header}.${body}`, secret);
  return `${header}.${body}.${signature}`;
}

export async function verifyJWT(token, secret) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [headerB64, bodyB64, signature] = parts;
    const expectedSig = await signRaw(`${headerB64}.${bodyB64}`, secret);
    if (!safeCompare(signature, expectedSig)) return null;
    const payload = JSON.parse(base64urlDecode(bodyB64));
    if (payload.exp && payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function generateSecureOTP() {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return String((array[0] % 900000) + 100000).padStart(6, '0');
}

