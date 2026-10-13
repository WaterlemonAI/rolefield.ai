import { sendSubscriberNotification } from "@/lib/email";
import { guardLeadRequest } from "@/lib/request-guard";
import { storeSubscriber } from "@/lib/website-lead-store";

export async function POST(request: Request) {
  try {
    const blocked = guardLeadRequest(request, "subscriber", 5);
    if (blocked) return blocked;

    const body = await request.json() as Record<string, unknown>;
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase().slice(0, 200) : "";
    const source = typeof body.source === "string" ? body.source.trim().slice(0, 80) : "website";

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ error: "Enter a valid work email" }, { status: 400 });
    }

    const result = await storeSubscriber({ email, source: source || "website" });

    try {
      await sendSubscriberNotification({ email, source: source || "website" });
    } catch (error) {
      console.error("Subscriber saved, but notification delivery failed", error);
    }

    return Response.json({ ok: true, subscribedAt: result.storedAt }, { status: 201 });
  } catch (error) {
    console.error("Email subscription failed", error);
    return Response.json({ error: "Unable to save your email right now" }, { status: 500 });
  }
}
