import { getDb } from "@/db";
import { sendInquiryEmails } from "@/lib/email";
import { guardLeadRequest } from "@/lib/request-guard";

const schemaSql = `CREATE TABLE IF NOT EXISTS website_inquiries (
  id BIGSERIAL PRIMARY KEY,
  inquiry_id TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL CHECK (kind IN ('contact', 'partnership')),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  company TEXT NOT NULL,
  phone TEXT,
  topic TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)`;

function value(body: Record<string, unknown>, field: string, max: number) {
  return typeof body[field] === "string" ? body[field].trim().slice(0, max) : "";
}

export async function POST(request: Request) {
  try {
    const blocked = guardLeadRequest(request, "inquiry");
    if (blocked) return blocked;
    const body = await request.json() as Record<string, unknown>;
    if (value(body, "website", 200)) return Response.json({ ok: true }, { status: 201 });
    const kind = value(body, "kind", 20);
    const inquiry = {
      kind: kind as "contact" | "partnership",
      inquiryId: `rf-${kind === "partnership" ? "partner" : "contact"}-${crypto.randomUUID().slice(0, 8)}`,
      name: value(body, "name", 120), email: value(body, "email", 200).toLowerCase(),
      company: value(body, "company", 160), phone: value(body, "phone", 40),
      topic: value(body, "topic", 160), message: value(body, "message", 3000),
    };
    if (!["contact", "partnership"].includes(kind) || !inquiry.name || !inquiry.company || !inquiry.topic || !inquiry.message || body.consent !== "yes") return Response.json({ error: "Missing required enquiry details" }, { status: 400 });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inquiry.email)) return Response.json({ error: "Invalid email" }, { status: 400 });
    const db = getDb();
    await db.query(schemaSql);
    await db.query({ text: `INSERT INTO website_inquiries (inquiry_id, kind, name, email, company, phone, topic, message) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, values: [inquiry.inquiryId, inquiry.kind, inquiry.name, inquiry.email, inquiry.company, inquiry.phone, inquiry.topic, inquiry.message] });
    let emailSent = false;
    try { emailSent = (await sendInquiryEmails(inquiry)).sent; } catch (error) { console.error("Inquiry saved, but email delivery failed", error); }
    return Response.json({ ok: true, inquiryId: inquiry.inquiryId, emailSent }, { status: 201 });
  } catch (error) {
    console.error("Website inquiry failed", error);
    return Response.json({ error: "Unable to save inquiry" }, { status: 500 });
  }
}
