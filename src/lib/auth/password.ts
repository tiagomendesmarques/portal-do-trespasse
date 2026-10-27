import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";

const BCRYPT_COST = 12;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

export type PasswordCheck = { ok: boolean; needsRehash: boolean };

/**
 * Verifica uma password contra um hash nosso (bcrypt) ou herdado do WordPress.
 * Segue wp_check_password() do WordPress 6.8+:
 *  - "$wp$2y$…": bcrypt sobre base64(HMAC-SHA384(password, "wp-sha384"))
 *  - "$P$…":     phpass portátil (WordPress antigo)
 *  - ≤ 32 chars: MD5 (contas muito antigas)
 *  - outros:     password_verify() direto (bcrypt simples)
 * Um hash do WordPress que confere devolve needsRehash = true.
 */
export async function verifyPassword(password: string, hash: string): Promise<PasswordCheck> {
  if (!hash || password.length > 4096) return { ok: false, needsRehash: false };

  if (hash.length <= 32) {
    const md5 = createHash("md5").update(password).digest("hex");
    return { ok: safeEqual(md5, hash), needsRehash: true };
  }
  if (hash.startsWith("$wp")) {
    const prehashed = createHmac("sha384", "wp-sha384").update(password).digest("base64");
    return { ok: await bcryptCompare(prehashed, hash.slice(3)), needsRehash: true };
  }
  if (hash.startsWith("$P$") || hash.startsWith("$H$")) {
    return { ok: phpassCheck(password, hash), needsRehash: true };
  }
  const ok = await bcryptCompare(password, hash);
  return { ok, needsRehash: ok && bcrypt.getRounds(normalizeBcrypt(hash)) < BCRYPT_COST };
}

// O PHP gera "$2y$"; é o mesmo algoritmo que "$2b$".
function normalizeBcrypt(hash: string) {
  return hash.startsWith("$2y$") ? "$2b$" + hash.slice(4) : hash;
}

async function bcryptCompare(value: string, hash: string) {
  try {
    return await bcrypt.compare(value, normalizeBcrypt(hash));
  } catch {
    return false;
  }
}

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/* ---------- phpass (PasswordHash::crypt_private, modo portátil) ---------- */

const ITOA64 = "./0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

function encode64(input: Buffer, count: number): string {
  let out = "";
  let i = 0;
  do {
    let value = input[i++];
    out += ITOA64[value & 0x3f];
    if (i < count) value |= input[i] << 8;
    out += ITOA64[(value >> 6) & 0x3f];
    if (i++ >= count) break;
    if (i < count) value |= input[i] << 16;
    out += ITOA64[(value >> 12) & 0x3f];
    if (i++ >= count) break;
    out += ITOA64[(value >> 18) & 0x3f];
  } while (i < count);
  return out;
}

export function phpassCrypt(password: string, setting: string): string {
  const countLog2 = ITOA64.indexOf(setting[3]);
  if (countLog2 < 7 || countLog2 > 30) return "*0";
  const salt = setting.slice(4, 12);
  if (salt.length !== 8) return "*0";
  const pw = Buffer.from(password, "utf8");
  let hash = createHash("md5").update(Buffer.concat([Buffer.from(salt, "binary"), pw])).digest();
  for (let n = 1 << countLog2; n > 0; n--) {
    hash = createHash("md5").update(Buffer.concat([hash, pw])).digest();
  }
  return setting.slice(0, 12) + encode64(hash, 16);
}

function phpassCheck(password: string, hash: string): boolean {
  const computed = phpassCrypt(password, hash);
  return computed[0] !== "*" && safeEqual(computed, hash);
}
