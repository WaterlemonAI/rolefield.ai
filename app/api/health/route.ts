import { getDb } from "@/db";

export async function GET() {
  try {
    await getDb().query("SELECT 1");
    return Response.json({ status: "ok", database: "connected" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ status: "unavailable", database: "disconnected" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
