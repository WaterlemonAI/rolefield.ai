import { apiPrincipal } from "@/lib/olv/session";
import { query, transaction } from "@/lib/olv/db";
import { SesMailProvider } from "@/lib/olv/aws";
import { audit } from "@/lib/olv/audit";
import { resolveCname, resolveMx, resolveTxt } from "node:dns/promises";
import { requireSameOrigin } from "@/lib/olv/security";
import { normalizeDomain } from "@/lib/olv/validation";
export async function GET(request: Request) {
  const p = await apiPrincipal(request);
  const domains = await query(
    "SELECT d.*,(SELECT json_agg(r ORDER BY r.required DESC,r.type) FROM domain_dns_records r WHERE r.domain_id=d.id AND r.organization_id=d.organization_id) records FROM domains d WHERE d.organization_id=$1 ORDER BY d.created_at",
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
  await query(
    "UPDATE domains SET state='VERIFYING',last_checked_at=now() WHERE id=$1 AND organization_id=$2",
    [domain.id, p.organizationId],
  );
  try {
    const ses = await new SesMailProvider().checkDomainIdentity(domain.name);
    const records = (
      await query<{
        id: string;
        type: string;
        host: string;
        value: string;
        purpose: string;
        required: boolean;
      }>(
        "SELECT id,type,host,value,purpose,required FROM domain_dns_records WHERE domain_id=$1 AND organization_id=$2",
        [domain.id, p.organizationId],
      )
    ).rows;
    const checks = new Map<string, boolean>();
    for (const record of records) {
      let verified = false;
      try {
        if (record.type === "MX") {
          const expected = record.value
            .replace(/^\d+\s+/, "")
            .replace(/\.$/, "");
          verified = (await resolveMx(record.host)).some(
            (x) => x.exchange.replace(/\.$/, "") === expected,
          );
        } else if (record.type === "TXT") {
          const values = (await resolveTxt(record.host)).map((x) => x.join(""));
          verified = values.includes(record.value);
        } else if (record.type === "CNAME") {
          verified = (await resolveCname(record.host))
            .map((x) => x.replace(/\.$/, ""))
            .includes(record.value.replace(/\.$/, ""));
        }
      } catch {
        verified = false;
      }
      checks.set(record.id, verified);
    }
    const requiredDns = records
      .filter((r) => r.required)
      .every((r) => checks.get(r.id));
    const next =
      ses.identity && ses.dkim && requiredDns
        ? "MAIL_READY"
        : ses.identity && ses.dkim
          ? "VERIFIED"
          : "DNS_PENDING";
    await transaction(async (c) => {
      await c.query(
        "UPDATE domains SET state=$3,last_checked_at=now(),failure_reason=NULL WHERE id=$1 AND organization_id=$2",
        [domain.id, p.organizationId, next],
      );
      for (const [id, verified] of checks)
        await c.query(
          "UPDATE domain_dns_records SET verified=$3 WHERE id=$1 AND organization_id=$2",
          [id, p.organizationId, verified],
        );
      const details = { ...ses, requiredDns };
      await c.query(
        "INSERT INTO domain_verification_events(organization_id,domain_id,previous_state,next_state,details) VALUES($1,$2,$3,$4,$5)",
        [
          p.organizationId,
          domain.id,
          domain.state,
          next,
          JSON.stringify(details),
        ],
      );
      await audit(
        c,
        p,
        next === "MAIL_READY"
          ? "DOMAIN_VERIFIED"
          : "DOMAIN_VERIFICATION_ATTEMPTED",
        "domain",
        domain.id,
        details,
      );
    });
    return Response.json({ state: next, ...ses, requiredDns });
  } catch (error) {
    await query(
      "UPDATE domains SET state='FAILED',failure_reason=$3,last_checked_at=now() WHERE id=$1 AND organization_id=$2",
      [domain.id, p.organizationId, (error as Error).message.slice(0, 300)],
    );
    return Response.json(
      { error: "SES or DNS verification check failed." },
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
