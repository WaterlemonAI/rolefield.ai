import { z } from "zod";
import { apiPrincipal, type AppModule } from "@/lib/olv/session";
import { transaction, query } from "@/lib/olv/db";
import { requireSameOrigin } from "@/lib/olv/security";
import { audit } from "@/lib/olv/audit";
import { deliverInvitation, issueInvitation } from "@/lib/olv/invitations";
import { email } from "@/lib/olv/validation";

const modules = z.enum(["MAILBOX", "VOICE", "SOCIAL", "DOCUMENTS"]);
const schema = z.object({
  name: z.string().trim().min(2).max(160),
  localPart: z.string().regex(/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}$/i).transform((value) => value.toLowerCase()),
  domainId: z.string().uuid(),
  departmentId: z.string().uuid().nullable().optional(),
  type: z.enum(["INDIVIDUAL", "SHARED"]),
  recoveryEmail: email.optional(),
  modules: z.array(modules).max(4).default([]),
}).superRefine((value, ctx) => {
  if (value.type === "INDIVIDUAL" && !value.recoveryEmail) ctx.addIssue({ code: "custom", path: ["recoveryEmail"], message: "A recovery email is required." });
  if (value.type === "INDIVIDUAL" && value.modules.length === 0) ctx.addIssue({ code: "custom", path: ["modules"], message: "Enable at least one module." });
});

export async function GET(request: Request) {
  const principal = await apiPrincipal(request);
  if (principal.orgRole !== "ADMIN") return Response.json({ error: "Administrator access required." }, { status: 403 });
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
      if (data.departmentId) {
        const department = await client.query("SELECT 1 FROM departments WHERE id=$1 AND organization_id=$2", [data.departmentId, principal.organizationId]);
        if (!department.rowCount) throw Object.assign(new Error("Choose a department in this workspace."), { status: 404 });
      }
      const domain = (await client.query<{ name: string; state: string }>("SELECT name,state FROM domains WHERE id=$1 AND organization_id=$2", [data.domainId, principal.organizationId])).rows[0];
      if (!domain) throw Object.assign(new Error("Choose a configured domain."), { status: 404 });
      const active = domain.state === "MAIL_READY";
      const mailbox = (await client.query<{ id: string }>("INSERT INTO mailboxes(organization_id,department_id,name,type,active) VALUES($1,$2,$3,$4,$5) RETURNING id", [principal.organizationId, data.departmentId || null, data.name, data.type, active])).rows[0];
      const address = `${data.localPart}@${domain.name}`;
      await client.query("INSERT INTO mailbox_addresses(organization_id,mailbox_id,domain_id,address) VALUES($1,$2,$3,$4)", [principal.organizationId, mailbox.id, data.domainId, address]);

      if (data.type === "SHARED") {
        await client.query("INSERT INTO mailbox_members(organization_id,mailbox_id,user_id,role) VALUES($1,$2,$3,'OWNER')", [principal.organizationId, mailbox.id, principal.userId]);
        await audit(client, principal, "MAILBOX_CREATED", "mailbox", mailbox.id, { type: data.type, active });
        return { id: mailbox.id, address, active, employee: null };
      }

      const recoveryEmail = data.recoveryEmail!;
      let user = (await client.query<{ id: string; activated_at: string | null; status: string }>("SELECT id,activated_at,status FROM users WHERE recovery_email=$1", [recoveryEmail])).rows[0];
      if (user) {
        const memberships = await client.query<{ organization_id: string }>("SELECT organization_id FROM organization_members WHERE user_id=$1", [user.id]);
        if (memberships.rows.some((membership) => membership.organization_id !== principal.organizationId)) throw Object.assign(new Error("That recovery email belongs to another workspace."), { status: 409 });
      } else {
        user = (await client.query<{ id: string; activated_at: string | null; status: string }>("INSERT INTO users(name,recovery_email,status) VALUES($1,$2,'INVITED') RETURNING id,activated_at,status", [data.name, recoveryEmail])).rows[0];
      }
      await client.query("INSERT INTO organization_members(organization_id,user_id,role) VALUES($1,$2,'MEMBER') ON CONFLICT(organization_id,user_id) DO UPDATE SET role='MEMBER'", [principal.organizationId, user.id]);
      await client.query("INSERT INTO mailbox_members(organization_id,mailbox_id,user_id,role) VALUES($1,$2,$3,'OWNER')", [principal.organizationId, mailbox.id, user.id]);
      await client.query("UPDATE user_module_entitlements SET enabled=false,updated_at=now(),assigned_by=$3 WHERE organization_id=$1 AND user_id=$2", [principal.organizationId, user.id, principal.userId]);
      for (const appModule of data.modules as AppModule[]) await client.query("INSERT INTO user_module_entitlements(organization_id,user_id,module,enabled,assigned_by) VALUES($1,$2,$3,true,$4) ON CONFLICT(organization_id,user_id,module) DO UPDATE SET enabled=true,assigned_by=EXCLUDED.assigned_by,updated_at=now()", [principal.organizationId, user.id, appModule, principal.userId]);
      const invitation = user.activated_at ? null : await issueInvitation(client, principal.organizationId, user.id);
      await audit(client, principal, "MAILBOX_CREATED", "mailbox", mailbox.id, { type: data.type, active, employeeUserId: user.id });
      await audit(client, principal, invitation ? "EMPLOYEE_INVITED" : "EMPLOYEE_MAILBOX_ADDED", "user", user.id, { mailboxId: mailbox.id, modules: data.modules });
      return { id: mailbox.id, address, active, employee: { id: user.id, email: recoveryEmail, name: data.name, invitation } };
    });
    if (!result.employee?.invitation) return Response.json({ ...result, employee: result.employee ? { id: result.employee.id, email: result.employee.email } : null }, { status: 201 });
    const delivery = await deliverInvitation({ id: result.employee.invitation.id, token: result.employee.invitation.token, email: result.employee.email, name: result.employee.name });
    return Response.json({ id: result.id, address: result.address, active: result.active, employee: { id: result.employee.id, email: result.employee.email }, ...delivery }, { status: 201 });
  } catch (error) {
    const issue = error as { message?: string; status?: number; code?: string };
    if (issue.code === "23505") return Response.json({ error: "That mailbox address or recovery email already exists." }, { status: 409 });
    console.error("OLV mailbox creation failed", { name: (error as Error).name });
    return Response.json({ error: issue.status ? issue.message : "Unable to create mailbox." }, { status: issue.status || 500 });
  }
}
