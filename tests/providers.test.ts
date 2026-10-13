import test from "node:test";
import assert from "node:assert/strict";
import { GEMINI_EMBEDDING_DIMENSION, ProviderNotConfiguredError, ProviderRegistry, TRANSCRIBE_LANGUAGES, loadProviderConfig } from "../lib/providers/index";

test("unconfigured providers expose honest availability and throw NotConfigured", () => {
  const registry = new ProviderRegistry(loadProviderConfig({}));
  assert.equal(registry.availability().every((item) => !item.available), true);
  assert.throws(() => registry.liveKit(), (error) => error instanceof ProviderNotConfiguredError && error.provider === "livekit");
});

test("partially configured providers fail closed", () => {
  assert.throws(() => loadProviderConfig({ LIVEKIT_URL: "wss://example.livekit.cloud" }), /LIVEKIT_API_KEY, LIVEKIT_API_SECRET/);
  assert.throws(() => loadProviderConfig({ VALKEY_URL: "redis://localhost:6379" }), /must use rediss/);
});

test("frozen Gemini hierarchy and embedding dimension cannot drift", () => {
  const base = {
    GEMINI_API_KEY: "secret", GEMINI_FAST_MODEL: "gemini-3.5-flash-lite", GEMINI_STANDARD_MODEL: "gemini-3.7-flash",
    GEMINI_COMPLEX_MODEL: "gemini-3.7-flash", GEMINI_EMBEDDING_MODEL: "gemini-embedding-2", GEMINI_EMBEDDING_DIMENSION: "1536",
  };
  const registry = new ProviderRegistry(loadProviderConfig(base));
  assert.equal(registry.gemini().embeddingDimension, GEMINI_EMBEDDING_DIMENSION);
  assert.throws(() => loadProviderConfig({ ...base, GEMINI_EMBEDDING_DIMENSION: "3072" }), /must be 1536/);
  assert.throws(() => loadProviderConfig({ ...base, GEMINI_STANDARD_MODEL: "preview-model" }), /gemini-3.7-flash/);
});

test("Transcribe contract freezes supported launch languages and PCM format", () => {
  const registry = new ProviderRegistry(loadProviderConfig({ TRANSCRIBE_REGION: "ap-south-1" }));
  assert.deepEqual(registry.transcribe().languages, TRANSCRIBE_LANGUAGES);
  assert.deepEqual({ encoding: registry.transcribe().encoding, channels: registry.transcribe().channels, bits: registry.transcribe().bitsPerSample }, { encoding: "pcm", channels: 1, bits: 16 });
});

test("calendar and delivery endpoints require TLS", () => {
  assert.throws(() => loadProviderConfig({
    GOOGLE_CALENDAR_CLIENT_ID: "id", GOOGLE_CALENDAR_CLIENT_SECRET: "secret", GOOGLE_CALENDAR_REDIRECT_URI: "http://localhost/callback",
    GOOGLE_CALENDAR_WEBHOOK_URL: "https://example.com/hook", GOOGLE_CALENDAR_WEBHOOK_TOKEN: "x".repeat(32),
  }), /must use https/);
});
