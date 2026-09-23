import crypto from "node:crypto";
import { getUserByOpenId, upsertLocalAdmin } from "./db";

const SCRYPT_PREFIX = "scrypt";

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(password, salt, 64);
  return `${SCRYPT_PREFIX}$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

export function verifyPassword(password: string, encoded: string | null | undefined): boolean {
  if (!encoded) return false;
  const [prefix, saltText, keyText] = encoded.split("$");
  if (prefix !== SCRYPT_PREFIX || !saltText || !keyText) return false;
  try {
    const salt = Buffer.from(saltText, "base64url");
    const expected = Buffer.from(keyText, "base64url");
    const actual = crypto.scryptSync(password, salt, expected.length);
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export async function ensureLocalAdmin() {
  const username = process.env.LOCAL_ADMIN_USERNAME?.trim();
  const password = process.env.LOCAL_ADMIN_PASSWORD;
  if (!username || !password) {
    console.warn("[LocalAuth] LOCAL_ADMIN_USERNAME/PASSWORD not configured");
    return;
  }
  const existing = await getUserByOpenId(username);
  if (existing?.passwordHash && existing.role === "admin") return;
  await upsertLocalAdmin(username, hashPassword(password));
  console.log(`[LocalAuth] Local admin ready: ${username}`);
}

export async function authenticateLocalUser(username: string, password: string) {
  const user = await getUserByOpenId(username.trim());
  if (!user || user.loginMethod !== "local" || user.role !== "admin") return null;
  return verifyPassword(password, user.passwordHash) ? user : null;
}
