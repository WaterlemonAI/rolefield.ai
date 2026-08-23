import { resolveNs } from "node:dns/promises";
import { normalizeDomain } from "@/lib/olv/validation";
import { domainAge, identifyDnsProvider, providerInstructions } from "@/lib/olv/domain-intelligence";
import { guardLeadRequest } from "@/lib/request-guard";

export const runtime = "nodejs";

type RdapBootstrap = { services?: [string[], string[]][] };
type RdapDomain = { events?: { eventAction?: string; eventDate?: string }[]; entities?: { roles?: string[]; vcardArray?: [string, unknown[][]] }[] };

async function registration(domain: string) {
  const tld = domain.split(".").at(-1) || "";
  const bootstrap = await fetch("https://data.iana.org/rdap/dns.json", { signal: AbortSignal.timeout(5_000), next: { revalidate: 86_400 } }).then((r) => r.ok ? r.json() as Promise<RdapBootstrap> : null).catch(() => null);
  const service = bootstrap?.services?.find(([tlds]) => tlds.includes(tld))?.[1]?.[0];
  if (!service) return null;
  const rdap = await fetch(`${service.replace(/\/$/, "")}/domain/${encodeURIComponent(domain)}`, { signal: AbortSignal.timeout(6_000), cache: "no-store" }).then((r) => r.ok ? r.json() as Promise<RdapDomain> : null).catch(() => null);
  if (!rdap) return null;
  const registeredAt = rdap.events?.find((event) => ["registration", "registered"].includes(event.eventAction || ""))?.eventDate;
  const registrar = rdap.entities?.find((entity) => entity.roles?.includes("registrar"));
  const registrarName = registrar?.vcardArray?.[1]?.find((row) => row[0] === "fn")?.[3];
  return { age: domainAge(registeredAt), registrar: typeof registrarName === "string" ? registrarName : null };
}

export async function GET(request: Request) {
  const limited = guardLeadRequest(request, "olv-domain-intelligence", 30);
  if (limited) return limited;
  let domain: string;
  try { domain = normalizeDomain(new URL(request.url).searchParams.get("domain") || ""); }
  catch (error) { return Response.json({ error: (error as Error).message }, { status: 400 }); }
  const [nameservers, registrationData] = await Promise.all([
    resolveNs(domain).then((values) => values.map((value) => value.replace(/\.$/, "").toLowerCase()).sort()).catch(() => [] as string[]),
    registration(domain),
  ]);
  const provider = identifyDnsProvider(nameservers);
  return Response.json({ domain, nameservers, provider, instructions: providerInstructions(provider), ...registrationData });
}
