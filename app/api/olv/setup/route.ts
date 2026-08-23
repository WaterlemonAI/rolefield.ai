import { z } from "zod";
import { transaction } from "@/lib/olv/db";
import { normalizeDomain, email } from "@/lib/olv/validation";
import { randomToken, tokenHash } from "@/lib/olv/security";
import { SesMailProvider } from "@/lib/olv/aws";
import { sendSystemEmail } from "@/lib/olv/mail";
import { guardLeadRequest } from "@/lib/request-guard";
const input = z.object({
  organizationName: z.string().trim().min(2).max(160),
  domain: z.string(),
  administratorName: z.string().trim().min(2).max(160),
  administratorEmail: email,
});
export async function POST(request: Request) {
  const limited = guardLeadRequest(request, "olv-setup", 5);
  if (limited) return limited;
  let parsed;
  try {
    parsed = input.parse(await request.json());
  } catch {
    return Response.json(
      { error: "Invalid organization details." },
      { status: 400 },
    );
  }
  let domain;
  try {
    domain = normalizeDomain(parsed.domain);
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400 });
  }
  try {
    const records = await new SesMailProvider().createDomainIdentity(domain);
    const token = randomToken();
    const result = await transaction(async (c) => {
      const existing = (
        await c.query<{ organization_id: string; user_id: string; domain_id: string }>(
          `SELECT d.organization_id,u.id user_id,d.id domain_id
           FROM domains d
           JOIN organization_members om ON om.organization_id=d.organization_id AND om.role='ADMIN'
           JOIN users u ON u.id=om.user_id
           WHERE d.name=$1 AND u.recovery_email=$2 AND u.activated_at IS NULL
           LIMIT 1`,
          [domain, parsed.administratorEmail],
        )
      ).rows[0];
      if (existing) {
        await c.query(
          "INSERT INTO account_activation_tokens(organization_id,user_id,token_hash,expires_at) VALUES($1,$2,$3,now()+interval '60 minutes')",
          [existing.organization_id, existing.user_id, tokenHash(token)],
        );
        return { organizationId: existing.organization_id, userId: existing.user_id, domainId: existing.domain_id, resumed: true };
      }
      const org = (
        await c.query<{ id: string }>(
          "INSERT INTO organizations(name) VALUES($1) RETURNING id",
          [parsed.organizationName],
        )
      ).rows[0];
      const user = (
        await c.query<{ id: string }>(
          "INSERT INTO users(name,recovery_email) VALUES($1,$2) RETURNING id",
          [parsed.administratorName, parsed.administratorEmail],
        )
      ).rows[0];
      await c.query(
        "INSERT INTO organization_members(organization_id,user_id,role) VALUES($1,$2,'ADMIN')",
        [org.id, user.id],
      );
      const d = (
        await c.query<{ id: string }>(
          "INSERT INTO domains(organization_id,name,state) VALUES($1,$2,'DNS_PENDING') RETURNING id",
          [org.id, domain],
        )
      ).rows[0];
      await c.query(
        "INSERT INTO audit_logs(organization_id,actor_user_id,action,target_type,target_id) VALUES($1,$2,'DOMAIN_CREATED','domain',$3)",
        [org.id, user.id, d.id],
      );
      for (const r of records)
        await c.query(
          "INSERT INTO domain_dns_records(organization_id,domain_id,type,host,value,purpose,required) VALUES($1,$2,$3,$4,$5,$6,$7)",
          [org.id, d.id, r.type, r.host, r.value, r.purpose, r.required],
        );
      await c.query(
        "INSERT INTO account_activation_tokens(organization_id,user_id,token_hash,expires_at) VALUES($1,$2,$3,now()+interval '60 minutes')",
        [org.id, user.id, tokenHash(token)],
      );
      await c.query(
        "INSERT INTO domain_verification_events(organization_id,domain_id,previous_state,next_state) VALUES($1,$2,'PENDING','DNS_PENDING')",
        [org.id, d.id],
      );
      return { organizationId: org.id, userId: user.id, domainId: d.id };
    });
    const activationUrl = `${process.env.APP_URL}/activate?token=${token}`;
    let activationEmailSent = true;
    let warning: string | undefined;
    try {
      await sendSystemEmail(
        parsed.administratorEmail,
        "Activate your OLV account",
        `Welcome to OLV. Activate your account using this one-time link (expires in 60 minutes):\n\n${activationUrl}`,
      );
    } catch (error) {
      activationEmailSent = false;
      warning = process.env.NODE_ENV === "development"
        ? "Workspace created. SES could not deliver the activation email while the AWS account or sender identity is awaiting verification; use the local activation link below."
        : "Workspace created, but the activation email could not be delivered. Contact support to resend it.";
      console.warn("OLV activation delivery deferred", { name: (error as Error).name });
    }
    return Response.json(
      {
        ...result,
        records,
        setupToken: token,
        activationUrl,
        activationEmailSent,
        ...(warning ? { warning } : {}),
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("OLV setup failed", { name: (error as Error).name });
    return Response.json(
      { error: "Unable to create organization or send activation." },
      { status: 502 },
    );
  }
}
