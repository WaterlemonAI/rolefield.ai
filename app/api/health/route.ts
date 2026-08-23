import { getDb } from "@/db";
import IORedis from "ioredis";

export async function GET() {
  try {
    await getDb().query("SELECT 1");
    if (!process.env.REDIS_URL) throw new Error("REDIS_URL is missing.");
    const redis = new IORedis(process.env.REDIS_URL, { lazyConnect: true, connectTimeout: 2000, maxRetriesPerRequest: 0 });
    try { await redis.connect(); await redis.ping(); } finally { redis.disconnect(); }
    return Response.json({ status: "ok", database: "connected", queue: "connected" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ status: "unavailable", dependency: "disconnected" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
