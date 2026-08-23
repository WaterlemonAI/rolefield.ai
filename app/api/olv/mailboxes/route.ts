import { z } from "zod";
import { apiPrincipal } from "@/lib/olv/session";
import { transaction, query } from "@/lib/olv/db";
import { requireSameOrigin } from "@/lib/olv/security";
import { audit } from "@/lib/olv/audit";

const schema = z.object({
  name: z.string().trim().min(2).max(160),
  localPart: z.string().regex(/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}$/i).transform((value) => value.toLowerCase()),
  domainId: z.string().uuid(),
  departmentId: z.string().uuid().nullable().optional(),
  type: z.enum(["INDIVIDUAL", "SHARED"]),
});

export async function GET(request: Request) {
  const principal = await apiPrincipal(request);
  const rows = await query("SELECT m.*,a.address,d.name department,(SELECT count(*) FROM mailbox_members mm WHERE mm.mailbox_id=m.id) member_count FROM mailboxes m JOIN mailbox_addresses a ON a.mailbox_id=m.id AND a.is_primary LEFT JOIN departments d ON d.id=m.department_id WHERE m.organization_id=$1 ORDER BY m.created_at DESC", [principal.organizationId]);
  return Response.json({ mailboxes: rows.rows });
}

export async function POST(request: Request) {
  try { requireSameOrigin(request); } catch { return Response.json({ error: "Invalid request origin." }, { status: 403 }); }
  const principal = await apiPrincipal(request);
  if (principal.orgRole !== "ADMIN") return Response.json({ error: "Administrator access required." }, { status: 403 });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Complete every required mailbox field.", details: parsed.error.flatten().fieldErrors }, { status: 400 });
  const data = parsed.data;
  try {
    const result = await transaction(async (client) => {
      const domain = (await client.query<{ name: string; state: string }>("SELECT name,state FROM domains WHERE id=$1 AND organization_id=$2", [data.domainId, principal.organizationId])).rows[0];
      if (!domain) throw Object.assign(new Error("Choose a configured domain."), { status: 404 });
      const active = domain.state === "MAIL_READY";
      const mailbox = (await client.query<{ id: string }>("INSERT INTO mailboxes(organization_id,department_id,name,type,active) VALUES($1,$2,$3,$4,$5) RETURNING id", [principal.organizationId, data.departmentId || null, data.name, data.type, active])).rows[0];
      const address = `${data.localPart}@${domain.name}`;
      await client.query("INSERT INTO mailbox_addresses(organization_id,mailbox_id,domain_id,address) VALUES($1,$2,$3,$4)", [principal.organizationId, mailbox.id, data.domainId, address]);
      await client.query("INSERT INTO mailbox_members(organization_id,mailbox_id,user_id,role) VALUES($1,$2,$3,'OWNER')", [principal.organizationId, mailbox.id, principal.userId]);
      await audit(client, principal, "MAILBOX_CREATED", "mailbox", mailbox.id, { type: data.type, active });
      return { id: mailbox.id, address, active };
    });
    return Response.json(result, { status: 201 });
  } catch (error) {
    const issue = error as { message?: string; status?: number; code?: string };
    if (issue.code === "23505") return Response.json({ error: "That mailbox address already exists." }, { status: 409 });
    console.error("OLV mailbox creation failed", { name: (error as Error).name });
    return Response.json({ error: issue.status ? issue.message : "Unable to create mailbox." }, { status: issue.status || 500 });
  }
}
