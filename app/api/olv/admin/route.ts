import { z } from "zod";
import { apiPrincipal, type AppModule } from "@/lib/olv/session";
import { query, transaction } from "@/lib/olv/db";
import { audit } from "@/lib/olv/audit";
import { requireSameOrigin } from "@/lib/olv/security";
import { deliverInvitation, issueInvitation } from "@/lib/olv/invitations";

const moduleSchema = z.enum(["MAILBOX", "VOICE", "SOCIAL", "DOCUMENTS"]);
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("department"), name: z.string().trim().min(2).max(100) }),
  z.object({ action: z.literal("addMember"), mailboxId: z.string().uuid(), userId: z.string().uuid() }),
  z.object({ action: z.literal("removeMember"), mailboxId: z.string().uuid(), userId: z.string().uuid() }),
  z.object({ action: z.literal("updateModules"), userId: z.string().uuid(), modules: z.array(moduleSchema).max(4) }),
  z.object({ action: z.literal("resendInvitation"), userId: z.string().uuid() }),
  z.object({ action: z.literal("suspendUser"), userId: z.string().uuid(), reason: z.string().trim().max(300).optional() }),
  z.object({ action: z.literal("reactivateUser"), userId: z.string().uuid() }),
  z.object({ action: z.literal("revokeSessions"), userId: z.string().uuid() }),
]);

export async function GET(request: Request) {
  const p = await apiPrincipal(request);
  if (p.orgRole !== "ADMIN") return Response.json({ error: "Administrator access required." }, { status: 403 });
  const [departments, users, audits] = await Promise.all([
    query("SELECT id,name FROM departments WHERE organization_id=$1 ORDER BY name", [p.organizationId]),
    query(`SELECT u.id,u.name,u.recovery_email,u.activated_at,u.status,u.last_login_at,u.suspended_at,u.suspension_reason,om.role,
      COALESCE(array_agg(e.module::text) FILTER(WHERE e.enabled),'{}') modules,
      (SELECT a.address FROM mailbox_members mm JOIN mailbox_addresses a ON a.mailbox_id=mm.mailbox_id AND a.is_primary WHERE mm.organization_id=om.organization_id AND mm.user_id=u.id AND mm.role='OWNER' ORDER BY a.created_at LIMIT 1) mailbox_address
      FROM organization_members om JOIN users u ON u.id=om.user_id
      LEFT JOIN user_module_entitlements e ON e.organization_id=om.organization_id AND e.user_id=u.id
      WHERE om.organization_id=$1 GROUP BY u.id,om.organization_id,om.role ORDER BY u.name`, [p.organizationId]),
    query("SELECT action,target_type,target_id,created_at FROM audit_logs WHERE organization_id=$1 ORDER BY created_at DESC LIMIT 50", [p.organizationId]),
  ]);
  return Response.json({ departments: departments.rows, users: users.rows, audits: audits.rows });
}

export async function POST(request: Request) {
  try { requireSameOrigin(request); } catch { return Response.json({ error: "Invalid request origin." }, { status: 403 }); }
  const p = await apiPrincipal(request);
  if (p.orgRole !== "ADMIN") return Response.json({ error: "Administrator access required." }, { status: 403 });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Invalid administration request." }, { status: 400 });
  const data = parsed.data;
  try {
    if (data.action === "department") {
      const row = await query<{ id: string }>("INSERT INTO departments(organization_id,name) VALUES($1,$2) ON CONFLICT(organization_id,name) DO UPDATE SET name=EXCLUDED.name RETURNING id", [p.organizationId, data.name]);
      return Response.json({ id: row.rows[0].id }, { status: 201 });
    }
    if (data.action === "addMember" || data.action === "removeMember") {
      await transaction(async (c) => {
        const member = await c.query("SELECT 1 FROM organization_members WHERE organization_id=$1 AND user_id=$2", [p.organizationId, data.userId]);
        const mailbox = await c.query("SELECT 1 FROM mailboxes WHERE organization_id=$1 AND id=$2 AND type='SHARED'", [p.organizationId, data.mailboxId]);
        if (!member.rowCount || !mailbox.rowCount) throw Object.assign(new Error("User or shared mailbox not found."), { status: 404 });
        if (data.action === "addMember") await c.query("INSERT INTO mailbox_members(organization_id,mailbox_id,user_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING", [p.organizationId, data.mailboxId, data.userId]);
        else await c.query("DELETE FROM mailbox_members WHERE organization_id=$1 AND mailbox_id=$2 AND user_id=$3", [p.organizationId, data.mailboxId, data.userId]);
        await audit(c, p, data.action === "addMember" ? "MAILBOX_MEMBER_ADDED" : "MAILBOX_MEMBER_REMOVED", "mailbox", data.mailboxId, { userId: data.userId });
      });
      return Response.json({ ok: true });
    }

    const employee = (await query<{ id: string; name: string; recovery_email: string; role: string; activated_at: string | null }>("SELECT u.id,u.name,u.recovery_email,u.activated_at,om.role FROM users u JOIN organization_members om ON om.user_id=u.id WHERE u.id=$1 AND om.organization_id=$2", [data.userId, p.organizationId])).rows[0];
    if (!employee) return Response.json({ error: "Employee not found." }, { status: 404 });
    if (employee.role === "ADMIN") return Response.json({ error: "The administrator account cannot be changed here." }, { status: 409 });

    if (data.action === "resendInvitation") {
      if (employee.activated_at) return Response.json({ error: "This employee has already activated their account." }, { status: 409 });
      const invitation = await transaction(async (c) => {
        const issued = await issueInvitation(c, p.organizationId, employee.id);
        await audit(c, p, "INVITATION_RESENT", "user", employee.id);
        return issued;
      });
      const delivery = await deliverInvitation({ ...invitation, email: employee.recovery_email, name: employee.name });
      return Response.json({ ok: true, ...delivery });
    }

    await transaction(async (c) => {
      if (data.action === "updateModules") {
        await c.query("UPDATE user_module_entitlements SET enabled=false,updated_at=now(),assigned_by=$3 WHERE organization_id=$1 AND user_id=$2", [p.organizationId, employee.id, p.userId]);
        for (const appModule of data.modules as AppModule[]) await c.query("INSERT INTO user_module_entitlements(organization_id,user_id,module,enabled,assigned_by) VALUES($1,$2,$3,true,$4) ON CONFLICT(organization_id,user_id,module) DO UPDATE SET enabled=true,assigned_by=EXCLUDED.assigned_by,updated_at=now()", [p.organizationId, employee.id, appModule, p.userId]);
        await audit(c, p, "EMPLOYEE_MODULES_UPDATED", "user", employee.id, { modules: data.modules });
      } else if (data.action === "suspendUser") {
        await c.query("UPDATE users SET status='SUSPENDED',suspended_at=now(),suspension_reason=$2 WHERE id=$1", [employee.id, data.reason || null]);
        await c.query("UPDATE sessions SET revoked_at=now() WHERE organization_id=$1 AND user_id=$2 AND revoked_at IS NULL", [p.organizationId, employee.id]);
        await audit(c, p, "EMPLOYEE_SUSPENDED", "user", employee.id, { reason: data.reason || null });
      } else if (data.action === "reactivateUser") {
        await c.query("UPDATE users SET status=CASE WHEN activated_at IS NULL THEN 'INVITED'::user_status ELSE 'ACTIVE'::user_status END,suspended_at=NULL,suspension_reason=NULL WHERE id=$1", [employee.id]);
        await audit(c, p, "EMPLOYEE_REACTIVATED", "user", employee.id);
      } else {
        await c.query("UPDATE sessions SET revoked_at=now() WHERE organization_id=$1 AND user_id=$2 AND revoked_at IS NULL", [p.organizationId, employee.id]);
        await audit(c, p, "EMPLOYEE_SESSIONS_REVOKED", "user", employee.id);
      }
    });
    return Response.json({ ok: true });
  } catch (error) {
    const issue = error as { status?: number; message?: string };
    console.error("OLV administration action failed", { name: (error as Error).name });
    return Response.json({ error: issue.status ? issue.message : "Unable to complete that administration action." }, { status: issue.status || 500 });
  }
}
