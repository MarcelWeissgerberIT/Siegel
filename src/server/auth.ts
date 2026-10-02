import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { DEMO, instance } from "./instance";

export const SESSION_COOKIE = "siegel_session";
const SESSION_DAYS = 30;

function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

function checkHash(password: string, stored: string) {
  const [, salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

export function envPassword() {
  return process.env.SIEGEL_PASSWORD || (DEMO ? "demo" : "");
}

export function needsSetup() {
  return !envPassword() && !instance().repo.kvGet("password");
}

export function verifyPassword(password: string) {
  const env = envPassword();
  if (env) {
    const a = Buffer.from(password);
    const b = Buffer.from(env);
    return a.length === b.length && timingSafeEqual(a, b);
  }
  const stored = instance().repo.kvGet("password");
  return !!stored && checkHash(password, stored);
}

export function setPassword(password: string) {
  instance().repo.kvSet("password", hashPassword(password));
}

export async function createSession(secure: boolean) {
  const token = randomBytes(32).toString("hex");
  const now = Date.now();
  instance().repo.db.prepare("INSERT INTO sessions (token, created_at, expires_at) VALUES (?, ?, ?)").run(token, now, now + SESSION_DAYS * 864e5);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure, // only over HTTPS, so plain-HTTP LAN installs can still sign in
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  });
}

export async function isAuthed() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return false;
  const row = instance().repo.db.prepare("SELECT expires_at FROM sessions WHERE token = ?").get(token) as { expires_at: number } | undefined;
  return !!row && row.expires_at > Date.now();
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) instance().repo.db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
  jar.delete(SESSION_COOKIE);
}

// Tiny in-memory brute-force guard: 8 attempts per IP per 10 minutes.
const attempts = new Map<string, { n: number; reset: number }>();
export function rateLimited(ip: string) {
  const now = Date.now();
  const a = attempts.get(ip);
  if (!a || a.reset < now) {
    attempts.set(ip, { n: 1, reset: now + 10 * 60e3 });
    return false;
  }
  a.n++;
  return a.n > 8;
}
