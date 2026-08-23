import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().url(), REDIS_URL: z.string().url(), OLV_SESSION_SECRET: z.string().min(32),
  PASSWORD_PEPPER: z.string().min(16), ENCRYPTION_KEY: z.string().min(32), APP_URL: z.string().url(), API_URL: z.string().url(),
  AWS_REGION: z.string().min(3), SES_REGION: z.string().min(3), SES_CONFIGURATION_SET: z.string().min(1),
  S3_BUCKET: z.string().min(3), S3_REGION: z.string().min(3),
  ACTIVATION_TOKEN_TTL_MINUTES: z.coerce.number().int().positive().default(60), RESET_TOKEN_TTL_MINUTES: z.coerce.number().int().positive().default(30),
  SESSION_TTL_HOURS: z.coerce.number().int().positive().max(720).default(12), MAX_ATTACHMENT_BYTES: z.coerce.number().int().positive().default(25_000_000), MAX_MESSAGE_BYTES: z.coerce.number().int().positive().default(40_000_000),
});
export type OlvConfig = z.infer<typeof schema>;
export function getOlvConfig(): OlvConfig {
  const result = schema.safeParse(process.env);
  if (!result.success) throw new Error(`Invalid OLV configuration: ${result.error.issues.map(i=>i.path.join(".")).join(", ")}`);
  return result.data;
}
