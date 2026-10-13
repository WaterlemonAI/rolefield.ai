const required = [
  "DATABASE_URL", "REDIS_URL", "APP_URL", "API_URL", "OLV_SESSION_SECRET",
  "PASSWORD_PEPPER", "ENCRYPTION_KEY", "AWS_REGION", "SES_REGION",
  "SES_CONFIGURATION_SET", "INVITATION_FROM_EMAIL", "S3_REGION", "S3_BUCKET",
  "INBOUND_SQS_QUEUE_URL", "INBOUND_WEBHOOK_SECRET", "SES_EVENT_WEBHOOK_SECRET",
];

const providerGroups = {
  livekit: ["LIVEKIT_URL", "LIVEKIT_API_KEY", "LIVEKIT_API_SECRET"],
  transcribe: ["TRANSCRIBE_REGION"],
  gemini: ["GEMINI_API_KEY", "GEMINI_FAST_MODEL", "GEMINI_STANDARD_MODEL", "GEMINI_COMPLEX_MODEL", "GEMINI_EMBEDDING_MODEL", "GEMINI_EMBEDDING_DIMENSION"],
  googleCalendar: ["GOOGLE_CALENDAR_CLIENT_ID", "GOOGLE_CALENDAR_CLIENT_SECRET", "GOOGLE_CALENDAR_REDIRECT_URI", "GOOGLE_CALENDAR_WEBHOOK_URL", "GOOGLE_CALENDAR_WEBHOOK_TOKEN"],
  objectStorage: ["MEETING_S3_REGION", "MEETING_S3_BUCKET", "MEETING_S3_KMS_KEY_ID", "MEETING_CLOUDFRONT_DOMAIN", "MEETING_CLOUDFRONT_KEY_PAIR_ID", "MEETING_CLOUDFRONT_PRIVATE_KEY"],
  valkey: ["VALKEY_URL"],
  sqs: ["MEETING_SQS_REGION", "SQS_DOCUMENT_PROCESSING_URL", "SQS_SCREENSHOT_INTELLIGENCE_URL", "SQS_MEETING_POSTPROCESSING_URL", "SQS_NOTIFICATION_DELIVERY_URL", "SQS_CALENDAR_SYNC_URL", "SQS_KNOWLEDGE_PROCESSING_URL", "SQS_TRAINING_PROCESSING_URL"],
  eventBridge: ["EVENTBRIDGE_REGION", "EVENTBRIDGE_BUS_NAME", "EVENTBRIDGE_SOURCE"],
};

const value = (key) => (process.env[key] || "").trim();
const missing = required.filter((key) => !value(key));
const weak = ["OLV_SESSION_SECRET", "PASSWORD_PEPPER", "ENCRYPTION_KEY", "INBOUND_WEBHOOK_SECRET", "SES_EVENT_WEBHOOK_SECRET"]
  .filter((key) => value(key).length < 32 || /replace-with|example|changeme/i.test(value(key)));
const partial = Object.entries(providerGroups).flatMap(([name, keys]) => {
  const present = keys.filter((key) => value(key));
  return present.length > 0 && present.length < keys.length
    ? [`${name} (missing ${keys.filter((key) => !value(key)).join(", ")})`]
    : [];
});

const invalidUrls = [];
for (const key of ["APP_URL", "API_URL"]) {
  try {
    const url = new URL(value(key));
    if (process.env.NODE_ENV === "production" && url.protocol !== "https:") invalidUrls.push(key);
  } catch { invalidUrls.push(key); }
}
try {
  const db = new URL(value("DATABASE_URL"));
  if (!["postgres:", "postgresql:"].includes(db.protocol)) invalidUrls.push("DATABASE_URL");
} catch { invalidUrls.push("DATABASE_URL"); }
try {
  const redis = new URL(value("REDIS_URL"));
  if (!["redis:", "rediss:"].includes(redis.protocol)) invalidUrls.push("REDIS_URL");
} catch { invalidUrls.push("REDIS_URL"); }

if (missing.length || weak.length || partial.length || invalidUrls.length) {
  console.error(`Invalid production configuration. Missing: ${missing.join(", ") || "none"}. Weak/placeholders: ${weak.join(", ") || "none"}. Partial provider groups: ${partial.join("; ") || "none"}. Invalid URLs: ${invalidUrls.join(", ") || "none"}.`);
  process.exit(1);
}
console.log("RoleField production environment is valid.");
