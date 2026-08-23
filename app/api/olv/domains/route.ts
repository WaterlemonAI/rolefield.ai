import { apiPrincipal } from "@/lib/olv/session";
import { query, transaction } from "@/lib/olv/db";
import { SesMailProvider } from "@/lib/olv/aws";
import { audit } from "@/lib/olv/audit";
import { requireSameOrigin } from "@/lib/olv/security";
import { normalizeDomain } from "@/lib/olv/validation";
import { calculateDomainHealth, verifyDomainConnection } from "@/lib/olv/domain-verification";
export async function GET(request: Request) {
  const p = await apiPrincipal(request);
  if (p.orgRole !== "ADMIN") return Response.json({ error: "Administrator access required." }, { status: 403 });
  const domains = await query(
    "SELECT d.*,(SELECT json_agg(r ORDER BY r.required DESC,r.type) FROM domain_dns_records r WHERE r.domain_id=d.id AND r.organization_id=d.organization_id) records,(SELECT e.details FROM domain_verification_events e WHERE e.domain_id=d.id AND e.organization_id=d.organization_id ORDER BY e.created_at DESC LIMIT 1) verification FROM domains d WHERE d.organization_id=$1 ORDER BY d.created_at",
    [p.organizationId],
  );
  return Response.json({ domains: domains.rows });
}
export async function POST(request: Request) {
  requireSameOrigin(request);
  const p = await apiPrincipal(request);
  if (p.orgRole !== "ADMIN")
    return Response.json(
      { error: "Administrator access required." },
      { status: 403 },
    );
  const body = (await request.json()) as { action?: "add" | "verify"; domainId?: string; domain?: string };
  if (body.action === "add") {
    let name: string;
    try { name = normalizeDomain(body.domain || ""); }
    catch (error) { return Response.json({ error: (error as Error).message }, { status: 400 }); }
    try {
      const records = await new SesMailProvider().createDomainIdentity(name);
      const created = await transaction(async (c) => {
        const domain = (await c.query<{id:string}>("INSERT INTO domains(organization_id,name,state) VALUES($1,$2,'DNS_PENDING') RETURNING id", [p.organizationId, name])).rows[0];
        for (const record of records) await c.query("INSERT INTO domain_dns_records(organization_id,domain_id,type,host,value,purpose,required) VALUES($1,$2,$3,$4,$5,$6,$7)", [p.organizationId, domain.id, record.type, record.host, record.value, record.purpose, record.required]);
        await audit(c, p, "DOMAIN_CREATED", "domain", domain.id, { domain: name });
        return domain;
      });
      return Response.json({ domainId: created.id, name, records }, { status: 201 });
    } catch (error) {
      if ((error as {code?:string}).code === "23505") return Response.json({ error: "This domain is already connected to an OLV workspace." }, { status: 409 });
      console.error("OLV domain connection failed", { name: (error as Error).name });
      return Response.json({ error: "Unable to connect this domain with AWS SES." }, { status: 502 });
    }
  }
  const { domainId } = body;
  const domain = (
    await query<{ id: string; name: string; state: string }>(
      "SELECT id,name,state FROM domains WHERE id=$1 AND organization_id=$2",
      [domainId, p.organizationId],
    )
  ).rows[0];
  if (!domain)
    return Response.json({ error: "Domain not found." }, { status: 404 });
  try {
    const result = await verifyDomainConnection({ id: domain.id, organizationId: p.organizationId, name: domain.name, state: domain.state });
    await transaction((c) => audit(c, p, result.health === "GREEN" ? "DOMAIN_VERIFIED" : "DOMAIN_VERIFICATION_ATTEMPTED", "domain", domain.id, result));
    return Response.json(result);
  } catch (error) {
    await query(
      "UPDATE domains SET state='FAILED',failure_reason=$3,last_checked_at=now() WHERE id=$1 AND organization_id=$2",
      [domain.id, p.organizationId, (error as Error).message.slice(0, 300)],
    );
    return Response.json(
      { error: "SES or DNS verification check failed.", health: calculateDomainHealth({ identity: false, dkim: false, requiredRecords: [], unreachable: true }) },
      { status: 502 },
    );
  }
}

export async function DELETE(request: Request) {
  requireSameOrigin(request);
  const p = await apiPrincipal(request);
  if (p.orgRole !== "ADMIN") return Response.json({ error: "Administrator access required." }, { status: 403 });
  const { domainId } = (await request.json()) as { domainId?: string };
  const domain = (await query<{id:string;name:string}>("SELECT id,name FROM domains WHERE id=$1 AND organization_id=$2", [domainId, p.organizationId])).rows[0];
  if (!domain) return Response.json({ error: "Domain not found." }, { status: 404 });
  const dependencies = await query<{count:string}>("SELECT count(*)::text count FROM mailbox_addresses WHERE domain_id=$1 AND organization_id=$2", [domain.id, p.organizationId]);
  const mailboxCount = Number(dependencies.rows[0]?.count || 0);
  if (mailboxCount > 0) return Response.json({ error: `Remove or move ${mailboxCount} mailbox address${mailboxCount === 1 ? "" : "es"} using this domain first.` }, { status: 409 });
  try { await new SesMailProvider().deleteDomainIdentity(domain.name); }
  catch (error) { console.error("OLV SES identity removal failed", { name: (error as Error).name }); return Response.json({ error: "AWS SES could not remove this identity. The workspace domain was left unchanged." }, { status: 502 }); }
  await transaction(async (c) => {
    await audit(c, p, "DOMAIN_REMOVED", "domain", domain.id, { domain: domain.name });
    await c.query("DELETE FROM domains WHERE id=$1 AND organization_id=$2", [domain.id, p.organizationId]);
  });
  return Response.json({ ok: true });
}
