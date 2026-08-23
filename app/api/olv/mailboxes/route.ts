import { z } from "zod";
import { apiPrincipal } from "@/lib/olv/session";
import { transaction, query } from "@/lib/olv/db";
import { email } from "@/lib/olv/validation";
import { randomToken, tokenHash, requireSameOrigin } from "@/lib/olv/security";
import { audit } from "@/lib/olv/audit";
import { sendSystemEmail } from "@/lib/olv/mail";
const schema = z
  .object({
    name: z.string().trim().min(2).max(160),
    localPart: z
      .string()
      .regex(/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}$/i)
      .transform((v) => v.toLowerCase()),
    domainId: z.string().uuid(),
    departmentId: z.string().uuid().nullable().optional(),
    type: z.enum(["INDIVIDUAL", "SHARED"]),
    recoveryEmail: email.optional(),
    memberUserIds: z.array(z.string().uuid()).max(100).default([]),
  })
  .superRefine((v, c) => {
    if (v.type === "INDIVIDUAL" && !v.recoveryEmail)
      c.addIssue({
        code: "custom",
        message: "Recovery email is required.",
        path: ["recoveryEmail"],
      });
  });
export async function GET(request: Request) {
  const p = await apiPrincipal(request);
  const rows = await query(
    "SELECT m.*,a.address,d.name department,(SELECT count(*) FROM mailbox_members mm WHERE mm.mailbox_id=m.id) member_count FROM mailboxes m JOIN mailbox_addresses a ON a.mailbox_id=m.id AND a.is_primary LEFT JOIN departments d ON d.id=m.department_id WHERE m.organization_id=$1 ORDER BY m.created_at DESC",
    [p.organizationId],
  );
  return Response.json({ mailboxes: rows.rows });
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
      {
        error: "Invalid mailbox details.",
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  const data = parsed.data;
  const result = await transaction(async (c) => {
    const domain = (
      await c.query<{ name: string }>(
        "SELECT name FROM domains WHERE id=$1 AND organization_id=$2 AND state='MAIL_READY'",
        [data.domainId, p.organizationId],
      )
    ).rows[0];
    if (!domain)
      throw Object.assign(new Error("Domain is not mail-ready."), {
        status: 409,
      });
    const mailbox = (
      await c.query<{ id: string }>(
        "INSERT INTO mailboxes(organization_id,department_id,name,type) VALUES($1,$2,$3,$4) RETURNING id",
        [p.organizationId, data.departmentId || null, data.name, data.type],
      )
    ).rows[0];
    const address = `${data.localPart}@${domain.name}`;
    await c.query(
      "INSERT INTO mailbox_addresses(organization_id,mailbox_id,domain_id,address) VALUES($1,$2,$3,$4)",
      [p.organizationId, mailbox.id, data.domainId, address],
    );
    let activationUrl: string | undefined;
    if (data.type === "INDIVIDUAL") {
      let user = (
        await c.query<{ id: string }>(
          "SELECT id FROM users WHERE recovery_email=$1",
          [data.recoveryEmail],
        )
      ).rows[0];
      if (!user)
        user = (
          await c.query<{ id: string }>(
            "INSERT INTO users(name,recovery_email) VALUES($1,$2) RETURNING id",
            [data.name, data.recoveryEmail],
          )
        ).rows[0];
      await c.query(
        "INSERT INTO organization_members(organization_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING",
        [p.organizationId, user.id],
      );
      await c.query(
        "INSERT INTO mailbox_members(organization_id,mailbox_id,user_id,role) VALUES($1,$2,$3,'OWNER')",
        [p.organizationId, mailbox.id, user.id],
      );
      const token = randomToken();
      await c.query(
        "INSERT INTO account_activation_tokens(organization_id,user_id,token_hash,expires_at) VALUES($1,$2,$3,now()+interval '60 minutes')",
        [p.organizationId, user.id, tokenHash(token)],
      );
      activationUrl = `${process.env.APP_URL}/activate?token=${token}`;
    }
    for (const userId of data.memberUserIds)
      await c.query(
        "INSERT INTO mailbox_members(organization_id,mailbox_id,user_id) SELECT $1,$2,$3 WHERE EXISTS(SELECT 1 FROM organization_members WHERE organization_id=$1 AND user_id=$3) ON CONFLICT DO NOTHING",
        [p.organizationId, mailbox.id, userId],
      );
    await audit(c, p, "MAILBOX_CREATED", "mailbox", mailbox.id, {
      type: data.type,
    });
    return { id: mailbox.id, address, activationUrl };
  });
  if (data.type === "INDIVIDUAL" && data.recoveryEmail && result.activationUrl)
    await sendSystemEmail(
      data.recoveryEmail,
      `Activate ${result.address}`,
      `Your OLV mailbox is ready. Activate your account using this one-time link:\n\n${result.activationUrl}`,
    );
  return Response.json(
    {
      ...result,
      ...(process.env.NODE_ENV === "production"
        ? { activationUrl: undefined }
        : {}),
    },
    { status: 201 },
  );
}
