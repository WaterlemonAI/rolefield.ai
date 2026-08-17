import { getDb } from "@/db";
import { sendLeadEmails } from "@/lib/email";
import { guardLeadRequest } from "@/lib/request-guard";

const schemaSql = `CREATE TABLE IF NOT EXISTS callback_requests (
  id BIGSERIAL PRIMARY KEY,
  request_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  company TEXT NOT NULL,
  phone TEXT NOT NULL,
  language TEXT NOT NULL,
  use_case TEXT NOT NULL,
  callback_window TEXT NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)`;

export async function POST(request: Request) {
  try {
    const blocked = guardLeadRequest(request, "callback", 6);
    if (blocked) return blocked;
    const body = await request.json() as Record<string, unknown>;
    const required = ["name", "email", "company", "phone", "language", "useCase", "callbackWindow"];
    if (required.some((field) => typeof body[field] !== "string" || !(body[field] as string).trim())) {
      return Response.json({ error: "Missing required callback details" }, { status: 400 });
    }
    const email = String(body.email).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ error: "Invalid email" }, { status: 400 });
    }

    const requestId = `rf-call-${crypto.randomUUID().slice(0, 8)}`;
    const lead = {
      type: "callback" as const,
      leadId: requestId,
      name: String(body.name).trim(),
      email,
      company: String(body.company).trim(),
      phone: String(body.phone).trim(),
      language: String(body.language),
      useCase: String(body.useCase),
      callbackWindow: String(body.callbackWindow),
      notes: String(body.notes || "").trim(),
    };
    const db = getDb();
    await db.query(schemaSql);
    await db.query({
      text: `INSERT INTO callback_requests
        (request_id, name, email, company, phone, language, use_case, callback_window, notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      values: [requestId, lead.name, lead.email, lead.company, lead.phone, lead.language, lead.useCase, lead.callbackWindow, lead.notes],
    });

    let emailSent = false;
    try { emailSent = (await sendLeadEmails(lead)).sent; }
    catch (error) { console.error("Callback saved, but email delivery failed", error); }
    return Response.json({ ok: true, requestId, emailSent }, { status: 201 });
  } catch (error) {
    console.error("Callback request failed", error);
    return Response.json({ error: "Unable to save callback request" }, { status: 500 });
  }
}
