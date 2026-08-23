import { z } from "zod";

export function normalizeDomain(input: string) {
  const value = input.trim().toLowerCase().replace(/\.$/, "");
  if (value.includes("://") || value.includes("/") || value.includes("@") || value.length > 253) throw new Error("Enter a domain name, not a URL or email address.");
  if (!/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(value)) throw new Error("Enter a valid domain name.");
  return value;
}
export const email = z.string().trim().toLowerCase().email().max(320);
export const participantList = z.array(z.object({ email, name: z.string().trim().max(160).optional() })).max(100);
export function sanitizeFilename(value: string) { return [...value].map(character=>{const code=character.charCodeAt(0);return character==="/"||character==="\\"||code<32||code===127?"_":character;}).join("").replace(/^\.+/,"").slice(0,180) || "attachment"; }
export function normalizeSubject(value: string) { return value.replace(/^\s*((re|fw|fwd)\s*:\s*)+/gi,"").trim().toLowerCase(); }
