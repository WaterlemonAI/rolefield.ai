import { getDb } from "@/db";

const schemaSql = `CREATE TABLE IF NOT EXISTS demo_bookings (
  id BIGSERIAL PRIMARY KEY,
  booking_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  company TEXT NOT NULL,
  phone TEXT NOT NULL,
  language TEXT NOT NULL,
  use_case TEXT NOT NULL,
  attendees TEXT,
  notes TEXT,
  demo_date TEXT NOT NULL,
  demo_time TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'Asia/Dubai',
  status TEXT NOT NULL DEFAULT 'confirmed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)`;

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const required = ["name", "email", "company", "phone", "language", "useCase", "date", "time"];
    if (required.some((field) => typeof body[field] !== "string" || !(body[field] as string).trim())) {
      return Response.json({ error: "Missing required booking details" }, { status: 400 });
    }
    const email = String(body.email).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ error: "Invalid email" }, { status: 400 });
    }
    const bookingId = `rf-${crypto.randomUUID().slice(0, 8)}`;
    const db = getDb();
    await db.query(schemaSql);
    await db.query("CREATE INDEX IF NOT EXISTS idx_demo_bookings_slot ON demo_bookings(demo_date, demo_time)");
    await db.query({ text: `INSERT INTO demo_bookings
      (booking_id, name, email, company, phone, language, use_case, attendees, notes, demo_date, demo_time, timezone, status, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'Asia/Dubai', 'confirmed', $12)`, values: [
        bookingId, String(body.name).trim(), email, String(body.company).trim(), String(body.phone).trim(),
        String(body.language), String(body.useCase), String(body.attendees || "").trim(), String(body.notes || "").trim(),
        String(body.date), String(body.time), new Date().toISOString()
      ] });
    return Response.json({ ok: true, bookingId }, { status: 201 });
  } catch (error) {
    console.error("Demo booking failed", error);
    return Response.json({ error: "Unable to confirm booking" }, { status: 500 });
  }
}
