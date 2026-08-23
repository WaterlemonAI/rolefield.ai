import { resolveCname, resolveMx, resolveTxt } from "node:dns/promises";
import { SesMailProvider } from "@/lib/olv/aws";
import { query, transaction } from "@/lib/olv/db";

export async function verifyDomainConnection(domain: { id: string; organizationId: string; name: string; state: string }) {
  await query("UPDATE domains SET state='VERIFYING',last_checked_at=now() WHERE id=$1 AND organization_id=$2", [domain.id, domain.organizationId]);
  const ses = await new SesMailProvider().checkDomainIdentity(domain.name);
  const records = (await query<{ id: string; type: string; host: string; value: string; purpose: string; required: boolean }>(
    "SELECT id,type,host,value,purpose,required FROM domain_dns_records WHERE domain_id=$1 AND organization_id=$2",
    [domain.id, domain.organizationId],
  )).rows;
  const checks = new Map<string, boolean>();
  for (const record of records) {
    let verified = false;
    try {
      if (record.type === "MX") {
        const expected = record.value.replace(/^\d+\s+/, "").replace(/\.$/, "");
        verified = (await resolveMx(record.host)).some((result) => result.exchange.replace(/\.$/, "") === expected);
      } else if (record.type === "TXT") {
        verified = (await resolveTxt(record.host)).map((value) => value.join("")).includes(record.value);
      } else if (record.type === "CNAME") {
        verified = (await resolveCname(record.host)).map((value) => value.replace(/\.$/, "")).includes(record.value.replace(/\.$/, ""));
      }
    } catch { verified = false; }
    checks.set(record.id, verified);
  }
  const requiredDns = records.filter((record) => record.required).every((record) => checks.get(record.id));
  const next = ses.identity && ses.dkim && requiredDns ? "MAIL_READY" : ses.identity && ses.dkim ? "VERIFIED" : "DNS_PENDING";
  await transaction(async (client) => {
    await client.query("UPDATE domains SET state=$3,last_checked_at=now(),failure_reason=NULL WHERE id=$1 AND organization_id=$2", [domain.id, domain.organizationId, next]);
    if (next === "MAIL_READY") await client.query("UPDATE mailboxes SET active=true WHERE organization_id=$1 AND id IN (SELECT mailbox_id FROM mailbox_addresses WHERE domain_id=$2)", [domain.organizationId, domain.id]);
    for (const [id, verified] of checks) await client.query("UPDATE domain_dns_records SET verified=$3 WHERE id=$1 AND organization_id=$2", [id, domain.organizationId, verified]);
    await client.query(
      "INSERT INTO domain_verification_events(organization_id,domain_id,previous_state,next_state,details) VALUES($1,$2,$3,$4,$5)",
      [domain.organizationId, domain.id, domain.state, next, JSON.stringify({ ...ses, requiredDns })],
    );
  });
  return {
    state: next,
    ...ses,
    requiredDns,
    records: records.map((record) => ({ ...record, verified: Boolean(checks.get(record.id)) })),
  };
}
