import { availability, requireConfigured, type ProviderAvailability } from "./contracts";
import { GEMINI_EMBEDDING_DIMENSION, TRANSCRIBE_LANGUAGES, loadProviderConfig, type ProvidersConfig } from "./config";

export { ProviderNotConfiguredError } from "./contracts";
export { GEMINI_EMBEDDING_DIMENSION, TRANSCRIBE_LANGUAGES, loadProviderConfig } from "./config";
export type { ProviderAvailability, ProviderConfig, ProviderName } from "./contracts";

/** Server-side provider boundary. It validates configuration but performs no fake I/O. */
export class ProviderRegistry {
  constructor(readonly config: ProvidersConfig = loadProviderConfig()) {}

  availability(): readonly ProviderAvailability[] {
    return [
      availability(this.config.livekit, "livekit"), availability(this.config.transcribe, "transcribe"),
      availability(this.config.gemini, "gemini"), availability(this.config.googleCalendar, "googleCalendar"),
      availability(this.config.objectStorage, "objectStorage"), availability(this.config.valkey, "valkey"),
      availability(this.config.sqs, "sqs"), availability(this.config.eventBridge, "eventBridge"),
    ];
  }

  liveKit() { return requireConfigured(this.config.livekit); }
  transcribe() {
    return { ...requireConfigured(this.config.transcribe), languages: TRANSCRIBE_LANGUAGES, encoding: "pcm" as const, channels: 1 as const, bitsPerSample: 16 as const };
  }
  gemini() {
    return { ...requireConfigured(this.config.gemini), embeddingDimension: GEMINI_EMBEDDING_DIMENSION };
  }
  googleCalendar() { return { ...requireConfigured(this.config.googleCalendar), apiVersion: "v3" as const }; }
  objectStorage() { return requireConfigured(this.config.objectStorage); }
  valkey() { return requireConfigured(this.config.valkey); }
  sqs() { return requireConfigured(this.config.sqs); }
  eventBridge() { return requireConfigured(this.config.eventBridge); }
}
