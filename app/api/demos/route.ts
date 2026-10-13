import { sendLeadEmails } from "@/lib/email";
import { guardLeadRequest } from "@/lib/request-guard";
import { storeDemoBooking } from "@/lib/website-lead-store";

export async function POST(request: Request) {
  try {
    const blocked = guardLeadRequest(request, "demo", 6);
    if (blocked) return blocked;
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
    const lead = {
      type: "demo" as const, leadId: bookingId, name: String(body.name).trim(), email,
      company: String(body.company).trim(), phone: String(body.phone).trim(),
      language: String(body.language), useCase: String(body.useCase),
      notes: String(body.notes || "").trim(), date: String(body.date), time: String(body.time),
    };
    await storeDemoBooking({
      bookingId,
      name: lead.name,
      email,
      company: lead.company,
      phone: lead.phone,
      language: lead.language,
      useCase: lead.useCase,
      attendees: String(body.attendees || "").trim(),
      notes: lead.notes,
      date: String(body.date),
      time: String(body.time),
    });
    let emailSent = false;
    try { emailSent = (await sendLeadEmails(lead)).sent; }
    catch (error) { console.error("Demo saved, but email delivery failed", error); }
    return Response.json({ ok: true, bookingId, emailSent }, { status: 201 });
  } catch (error) {
    console.error("Demo booking failed", error);
    return Response.json({ error: "Unable to confirm booking" }, { status: 500 });
  }
}
