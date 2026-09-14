import { createHash, createHmac } from "node:crypto";

/** BC.Game login password: HMAC-SHA256(MD5(plain), timestamp). */
export function encryptPassword(plain: string, timestamp = String(Date.now())) {
  const md5 = createHash("md5").update(plain, "utf8").digest("hex");
  const password = createHmac("sha256", timestamp).update(md5, "utf8").digest("hex");
  return { timestamp, password };
}

export function identifierKind(raw: string): "email" | "phone" | "username" {
  const value = raw.trim();
  if (value.includes("@")) return "email";
  if (/^\+?\d[\d\s-]{6,}$/.test(value)) return "phone";
  return "username";
}
