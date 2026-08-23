import { z } from "zod";
import { apiPrincipal } from "@/lib/olv/session";
import { query, transaction } from "@/lib/olv/db";
import { audit } from "@/lib/olv/audit";
import { requireSameOrigin } from "@/lib/olv/security";
const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("department"),
    name: z.string().trim().min(2).max(100),
  }),
  z.object({
    action: z.literal("addMember"),
    mailboxId: z.string().uuid(),
    userId: z.string().uuid(),
  }),
  z.object({
    action: z.literal("removeMember"),
    mailboxId: z.string().uuid(),
    userId: z.string().uuid(),
  }),
]);
export async function GET(request: Request) {
  const p = await apiPrincipal(request);
  if (p.orgRole !== "ADMIN")
    return Response.json(
      { error: "Administrator access required." },
      { status: 403 },
    );
  const [departments, users, audits] = await Promise.all([
    query(
      "SELECT id,name FROM departments WHERE organization_id=$1 ORDER BY name",
      [p.organizationId],
    ),
    query(
      "SELECT u.id,u.name,u.recovery_email,u.activated_at,om.role FROM organization_members om JOIN users u ON u.id=om.user_id WHERE om.organization_id=$1 ORDER BY u.name",
      [p.organizationId],
    ),
    query(
      "SELECT action,target_type,target_id,created_at FROM audit_logs WHERE organization_id=$1 ORDER BY created_at DESC LIMIT 50",
      [p.organizationId],
    ),
  ]);
  return Response.json({
    departments: departments.rows,
    users: users.rows,
    audits: audits.rows,
  });
}
export async function POST(request: Request) {
  requireSameOrigin(request);
  const p = await apiPrincipal(request);
  if (p.orgRole !== "ADMIN")
    return Response.json(
      { error: "Administrator access required." },
      { status: 403 },
    );
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success)
    return Response.json(
      { error: "Invalid administration request." },
      { status: 400 },
    );
  const data = parsed.data;
  if (data.action === "department") {
    const row = await query<{ id: string }>(
      "INSERT INTO departments(organization_id,name) VALUES($1,$2) ON CONFLICT(organization_id,name) DO UPDATE SET name=EXCLUDED.name RETURNING id",
      [p.organizationId, data.name],
    );
    return Response.json({ id: row.rows[0].id }, { status: 201 });
  }
  await transaction(async (c) => {
    const member = await c.query(
      "SELECT 1 FROM organization_members WHERE organization_id=$1 AND user_id=$2",
      [p.organizationId, data.userId],
    );
    const mailbox = await c.query(
      "SELECT 1 FROM mailboxes WHERE organization_id=$1 AND id=$2 AND type='SHARED'",
      [p.organizationId, data.mailboxId],
    );
    if (!member.rowCount || !mailbox.rowCount)
      throw Object.assign(new Error("User or shared mailbox not found."), {
        status: 404,
      });
    if (data.action === "addMember")
      await c.query(
        "INSERT INTO mailbox_members(organization_id,mailbox_id,user_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
        [p.organizationId, data.mailboxId, data.userId],
      );
    else
      await c.query(
        "DELETE FROM mailbox_members WHERE organization_id=$1 AND mailbox_id=$2 AND user_id=$3",
        [p.organizationId, data.mailboxId, data.userId],
      );
    await audit(
      c,
      p,
      data.action === "addMember"
        ? "MAILBOX_MEMBER_ADDED"
        : "MAILBOX_MEMBER_REMOVED",
      "mailbox",
      data.mailboxId,
      { userId: data.userId },
    );
  });
  return Response.json({ ok: true });
}
