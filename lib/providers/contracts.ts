export type ProviderName =
  | "livekit"
  | "transcribe"
  | "gemini"
  | "googleCalendar"
  | "objectStorage"
  | "valkey"
  | "sqs"
  | "eventBridge";

export type NotConfigured = Readonly<{
  configured: false;
  provider: ProviderName;
  missing: readonly string[];
}>;

export type Configured<T> = Readonly<{ configured: true; value: Readonly<T> }>;
export type ProviderConfig<T> = Configured<T> | NotConfigured;

export class ProviderNotConfiguredError extends Error {
  readonly code = "PROVIDER_NOT_CONFIGURED";
  constructor(
    readonly provider: ProviderName,
    readonly missing: readonly string[],
  ) {
    super(`${provider} is not configured; missing: ${missing.join(", ")}`);
    this.name = "ProviderNotConfiguredError";
  }
}

export function requireConfigured<T>(config: ProviderConfig<T>): Readonly<T> {
  if (!config.configured) {
    throw new ProviderNotConfiguredError(config.provider, config.missing);
  }
  return config.value;
}

export type ProviderAvailability = Readonly<{
  provider: ProviderName;
  available: boolean;
  missing: readonly string[];
}>;

export function availability<T>(config: ProviderConfig<T>, provider: ProviderName): ProviderAvailability {
  return config.configured
    ? { provider, available: true, missing: [] }
    : { provider, available: false, missing: config.missing };
}
