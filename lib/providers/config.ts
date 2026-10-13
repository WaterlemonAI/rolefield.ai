import { z } from "zod";
import type { Configured, NotConfigured, ProviderConfig, ProviderName } from "./contracts";

const nonEmpty = z.string().trim().min(1);
const httpsUrl = z.string().url().refine((value) => value.startsWith("https://"), "must use https");

function optionalGroup<T extends Record<string, z.ZodTypeAny>>(
  provider: ProviderName,
  env: Readonly<Record<string, string | undefined>>,
  shape: T,
): ProviderConfig<z.infer<z.ZodObject<T>>> {
  const keys = Object.keys(shape);
  const present = keys.filter((key) => Boolean(env[key]?.trim()));
  if (present.length === 0) return { configured: false, provider, missing: keys } satisfies NotConfigured;
  const missing = keys.filter((key) => !env[key]?.trim());
  if (missing.length) throw new Error(`Invalid ${provider} configuration; missing: ${missing.join(", ")}`);
  const parsed = z.object(shape).safeParse(env);
  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
    throw new Error(`Invalid ${provider} configuration; ${details}`);
  }
  return { configured: true, value: parsed.data } as Configured<z.infer<z.ZodObject<T>>>;
}

export const GEMINI_EMBEDDING_DIMENSION = 1536 as const;
export const TRANSCRIBE_LANGUAGES = ["en-IN", "hi-IN", "ar-AE", "en-US"] as const;

export function loadProviderConfig(env: Readonly<Record<string, string | undefined>> = process.env) {
  return {
    livekit: optionalGroup("livekit", env, {
      LIVEKIT_URL: z.string().url().refine((v) => v.startsWith("wss://") || v.startsWith("https://"), "must use wss or https"),
      LIVEKIT_API_KEY: nonEmpty,
      LIVEKIT_API_SECRET: nonEmpty.min(16),
    }),
    transcribe: optionalGroup("transcribe", env, {
      TRANSCRIBE_REGION: nonEmpty,
    }),
    gemini: optionalGroup("gemini", env, {
      GEMINI_API_KEY: nonEmpty,
      GEMINI_FAST_MODEL: z.literal("gemini-3.5-flash-lite"),
      GEMINI_STANDARD_MODEL: z.literal("gemini-3.7-flash"),
      GEMINI_COMPLEX_MODEL: z.literal("gemini-3.7-flash"),
      GEMINI_EMBEDDING_MODEL: z.literal("gemini-embedding-2"),
      GEMINI_EMBEDDING_DIMENSION: z.coerce.number().int().refine((v) => v === GEMINI_EMBEDDING_DIMENSION, "must be 1536"),
    }),
    googleCalendar: optionalGroup("googleCalendar", env, {
      GOOGLE_CALENDAR_CLIENT_ID: nonEmpty,
      GOOGLE_CALENDAR_CLIENT_SECRET: nonEmpty,
      GOOGLE_CALENDAR_REDIRECT_URI: httpsUrl,
      GOOGLE_CALENDAR_WEBHOOK_URL: httpsUrl,
      GOOGLE_CALENDAR_WEBHOOK_TOKEN: nonEmpty.min(32),
    }),
    objectStorage: optionalGroup("objectStorage", env, {
      MEETING_S3_REGION: nonEmpty,
      MEETING_S3_BUCKET: nonEmpty,
      MEETING_S3_KMS_KEY_ID: nonEmpty,
      MEETING_CLOUDFRONT_DOMAIN: nonEmpty,
      MEETING_CLOUDFRONT_KEY_PAIR_ID: nonEmpty,
      MEETING_CLOUDFRONT_PRIVATE_KEY: nonEmpty,
    }),
    valkey: optionalGroup("valkey", env, {
      VALKEY_URL: z.string().url().refine((v) => v.startsWith("rediss://"), "must use rediss"),
    }),
    sqs: optionalGroup("sqs", env, {
      MEETING_SQS_REGION: nonEmpty,
      SQS_DOCUMENT_PROCESSING_URL: httpsUrl,
      SQS_SCREENSHOT_INTELLIGENCE_URL: httpsUrl,
      SQS_MEETING_POSTPROCESSING_URL: httpsUrl,
      SQS_NOTIFICATION_DELIVERY_URL: httpsUrl,
      SQS_CALENDAR_SYNC_URL: httpsUrl,
      SQS_KNOWLEDGE_PROCESSING_URL: httpsUrl,
      SQS_TRAINING_PROCESSING_URL: httpsUrl,
    }),
    eventBridge: optionalGroup("eventBridge", env, {
      EVENTBRIDGE_REGION: nonEmpty,
      EVENTBRIDGE_BUS_NAME: nonEmpty,
      EVENTBRIDGE_SOURCE: nonEmpty,
    }),
  } as const;
}

export type ProvidersConfig = ReturnType<typeof loadProviderConfig>;
