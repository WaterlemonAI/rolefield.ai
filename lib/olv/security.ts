import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import argon2 from "argon2";

export function randomToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}
export function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
function encryptionKey() {
  const value = process.env.ENCRYPTION_KEY;
  if (!value || value.length < 32) throw new Error("ENCRYPTION_KEY is required.");
  return createHash("sha256").update(value).digest();
}
export function encryptSecret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
}
export function decryptSecret(value: string) {
  const [version, iv, tag, encrypted] = value.split(".");
  if (version !== "v1" || !iv || !tag || !encrypted) throw new Error("Invalid encrypted secret.");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, "base64url")), decipher.final()]).toString("utf8");
}
export async function hashPassword(password: string) {
  if (password.length < 12 || password.length > 200)
    throw new Error("Password must be between 12 and 200 characters.");
  return argon2.hash(`${password}${process.env.PASSWORD_PEPPER || ""}`, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 1,
  });
}
export async function verifyPassword(hash: string, password: string) {
  try {
    return await argon2.verify(
      hash,
      `${password}${process.env.PASSWORD_PEPPER || ""}`,
    );
  } catch {
    return false;
  }
}
export function safeMetadata(request: Request) {
  return {
    ipHash: tokenHash(
      request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown",
    ),
    userAgent: (request.headers.get("user-agent") || "").slice(0, 300),
  };
}
export function requireSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const forwardedHost = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const forwardedProto = request.headers.get("x-forwarded-proto") || new URL(request.url).protocol.replace(":", "");
  const allowed = new Set([new URL(request.url).origin]);
  if (forwardedHost) allowed.add(`${forwardedProto}://${forwardedHost}`);
  if (process.env.APP_URL) allowed.add(new URL(process.env.APP_URL).origin);
  if (!origin || !allowed.has(origin))
    throw Object.assign(new Error("Invalid request origin."), { status: 403 });
}
