import { z } from "zod";
import { query, transaction } from "@/lib/olv/db";
import { audit } from "@/lib/olv/audit";
import { apiRequireModule } from "@/lib/olv/session";
import { requireSameOrigin } from "@/lib/olv/security";

const eventFields = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).default(""),
  location: z.string().trim().max(300).default(""),
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }),
  allDay: z.boolean().default(false),
});
const mutationSchema = z.discriminatedUnion("action", [
  eventFields.extend({ action: z.literal("create") }),
  eventFields.extend({ action: z.literal("update"), id: z.string().uuid() }),
  z.object({ action: z.literal("delete"), id: z.string().uuid() }),
]);

type EventRow = { id:string; title:string; description:string|null; location:string|null; starts_at:string; ends_at:string; all_day:boolean };
const serialize = (row: EventRow) => ({ id:row.id, title:row.title, description:row.description || "", location:row.location || "", startsAt:row.starts_at, endsAt:row.ends_at, allDay:row.all_day });

export async function GET(request: Request) {
  try {
    const principal = await apiRequireModule(request, "CALENDAR");
    const url = new URL(request.url);
    const start = z.string().datetime({ offset: true }).safeParse(url.searchParams.get("start"));
    const end = z.string().datetime({ offset: true }).safeParse(url.searchParams.get("end"));
    if (!start.success || !end.success || new Date(end.data) <= new Date(start.data)) return Response.json({ error:"Choose a valid calendar range." }, { status:400 });
    if (new Date(end.data).getTime() - new Date(start.data).getTime() > 370 * 86400000) return Response.json({ error:"Calendar range is too large." }, { status:400 });
    const result = await query<EventRow>(`SELECT id,title,description,location,starts_at,ends_at,all_day FROM calendar_events WHERE organization_id=$1 AND owner_user_id=$2 AND starts_at<$4 AND ends_at>$3 ORDER BY starts_at,id`, [principal.organizationId, principal.userId, start.data, end.data]);
    return Response.json({ events:result.rows.map(serialize) });
  } catch (error) {
    const issue = error as { status?:number; message?:string };
    return Response.json({ error:issue.status ? issue.message : "Unable to load the calendar." }, { status:issue.status || 500 });
  }
}

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const principal = await apiRequireModule(request, "CALENDAR");
    const parsed = mutationSchema.safeParse(await request.json());
    if (!parsed.success) return Response.json({ error:parsed.error.issues[0]?.message || "Invalid calendar event." }, { status:400 });
    const data = parsed.data;
    if (data.action !== "delete" && new Date(data.endsAt) <= new Date(data.startsAt)) return Response.json({ error:"End time must be after start time." }, { status:400 });
    if (data.action === "delete") {
      const removed = await transaction(async (client) => {
        const result = await client.query<{id:string}>("DELETE FROM calendar_events WHERE id=$1 AND organization_id=$2 AND owner_user_id=$3 RETURNING id", [data.id, principal.organizationId, principal.userId]);
        if (result.rowCount) await audit(client, principal, "CALENDAR_EVENT_DELETED", "calendar_event", data.id);
        return result;
      });
      if (!removed.rowCount) return Response.json({ error:"Event not found." }, { status:404 });
      return Response.json({ ok:true });
    }
    const values = [data.title, data.description || null, data.location || null, data.startsAt, data.endsAt, data.allDay];
    const result = await transaction(async (client) => {
      const saved = data.action === "create"
        ? await client.query<EventRow>(`INSERT INTO calendar_events(organization_id,owner_user_id,title,description,location,starts_at,ends_at,all_day) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,title,description,location,starts_at,ends_at,all_day`, [principal.organizationId, principal.userId, ...values])
        : await client.query<EventRow>(`UPDATE calendar_events SET title=$4,description=$5,location=$6,starts_at=$7,ends_at=$8,all_day=$9,updated_at=now() WHERE id=$1 AND organization_id=$2 AND owner_user_id=$3 RETURNING id,title,description,location,starts_at,ends_at,all_day`, [data.id, principal.organizationId, principal.userId, ...values]);
      if (saved.rowCount) await audit(client, principal, data.action === "create" ? "CALENDAR_EVENT_CREATED" : "CALENDAR_EVENT_UPDATED", "calendar_event", saved.rows[0].id);
      return saved;
    });
    if (!result.rowCount) return Response.json({ error:"Event not found." }, { status:404 });
    return Response.json({ event:serialize(result.rows[0]) }, { status:data.action === "create" ? 201 : 200 });
  } catch (error) {
    const issue = error as { status?:number; message?:string };
    console.error("Calendar mutation failed", { name:(error as Error).name });
    return Response.json({ error:issue.status ? issue.message : "Unable to save the calendar event." }, { status:issue.status || 500 });
  }
}
