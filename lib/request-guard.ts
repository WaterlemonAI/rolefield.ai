const globalGuard = globalThis as unknown as { rolefieldRequests?: Map<string, number[]> };
globalGuard.rolefieldRequests ??= new Map();

export function guardLeadRequest(request: Request, bucket: string, limit = 8) {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 32_000) {
    return Response.json({ error: "Request is too large" }, { status: 413 });
  }

  const client = request.headers.get("x-forwarded-for")?.split(",")[0].trim()
    || request.headers.get("cf-connecting-ip")
    || "unknown";
  const key = `${bucket}:${client}`;
  const now = Date.now();
  const recent = (globalGuard.rolefieldRequests?.get(key) || []).filter((time) => now - time < 10 * 60 * 1000);
  if (recent.length >= limit) {
    return Response.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": "600" } },
    );
  }
  globalGuard.rolefieldRequests?.set(key, [...recent, now]);
  return null;
}
