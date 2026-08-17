import { getDb } from "@/db";
import { sendAgentRequestEmails } from "@/lib/email";
import { guardLeadRequest } from "@/lib/request-guard";

const schemaSql = `CREATE TABLE IF NOT EXISTS custom_agent_requests (
  id BIGSERIAL PRIMARY KEY,
  request_id TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  gender TEXT NOT NULL,
  language TEXT NOT NULL,
  use_case TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'requested',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)`;

const allowedGenders = ["Female", "Male", "No preference"];
const allowedLanguages = ["Arabic", "English", "Russian", "Hindi", "Urdu", "Malayalam", "Tagalog", "French", "German", "Italian", "Spanish"];
const allowedUseCases = ["Customer service", "Lead qualification", "Appointment booking", "Collections", "Guest concierge", "Property enquiries", "Banking assistance", "Order and delivery", "Custom workflow"];

export async function POST(request: Request) {
  try {
    const blocked = guardLeadRequest(request, "agent", 6);
    if (blocked) return blocked;
    const body = await request.json() as Record<string, unknown>;
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase().slice(0, 200) : "";
    const gender = String(body.gender || "");
    const language = String(body.language || "");
    const useCase = String(body.useCase || "");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return Response.json({ error: "Invalid email" }, { status: 400 });
    if (!allowedGenders.includes(gender) || !allowedLanguages.includes(language) || !allowedUseCases.includes(useCase)) return Response.json({ error: "Invalid agent configuration" }, { status: 400 });
    const requestId = `rf-agent-${crypto.randomUUID().slice(0, 8)}`;
    const db = getDb();
    await db.query(schemaSql);
    await db.query({ text: "INSERT INTO custom_agent_requests (request_id, email, gender, language, use_case) VALUES ($1,$2,$3,$4,$5)", values: [requestId, email, gender, language, useCase] });
    let emailSent = false;
    try { emailSent = (await sendAgentRequestEmails({ requestId, email, gender, language, useCase })).sent; } catch (error) { console.error("Agent request saved, but email delivery failed", error); }
    return Response.json({ ok: true, requestId, emailSent }, { status: 201 });
  } catch (error) {
    console.error("Custom agent request failed", error);
    return Response.json({ error: "Unable to save agent request" }, { status: 500 });
  }
}
