"use client";
import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";

type Intelligence = {
  domain: string;
  nameservers: string[];
  provider: { id: string; name: string; mark: string; color: string; consoleUrl?: string };
  instructions: string[];
  registrar?: string | null;
  age?: { registeredAt: string; months: number; years: number; remainingMonths: number } | null;
  error?: string;
};

type SetupState = {
  records?: { type: string; host: string; value: string; purpose: string; required: boolean }[];
  activationUrl?: string;
  setupToken?: string;
  error?: string;
  warning?: string;
  activationEmailSent?: boolean;
  verification?: { state: string; requiredDns: boolean; identity: boolean; dkim: boolean; records: (DnsRecord & { verified: boolean })[] };
};

type DnsRecord = NonNullable<SetupState["records"]>[number];

function providerRecord(record: DnsRecord, domain: string, providerId?: string) {
  const relativeHosts = ["godaddy", "namecheap", "spaceship", "squarespace", "cloudflare", "hostinger", "porkbun", "bluehost"];
  let host = record.host;
  if (relativeHosts.includes(providerId || "")) {
    host = record.host === domain ? "@" : record.host.endsWith(`.${domain}`) ? record.host.slice(0, -(domain.length + 1)) : record.host;
  }
  const mx = record.type === "MX" ? record.value.match(/^(\d+)\s+(.+)$/) : null;
  return { host, value: mx?.[2] || record.value, priority: mx?.[1] || null };
}

function CopyIcon() {
  return <svg viewBox="0 0 20 20" aria-hidden="true"><rect x="6" y="6" width="10" height="10" rx="1.5"/><path d="M4 13H3.5A1.5 1.5 0 0 1 2 11.5v-8A1.5 1.5 0 0 1 3.5 2h8A1.5 1.5 0 0 1 13 3.5V4"/></svg>;
}

function ageLabel(age: Intelligence["age"]) {
  if (!age) return "Registration date unavailable";
  if (age.years) return `${age.years} year${age.years === 1 ? "" : "s"}${age.remainingMonths ? `, ${age.remainingMonths} mo` : ""} old`;
  return `${age.months} month${age.months === 1 ? "" : "s"} old`;
}

export function OrganizationSetup() {
  const [state, setState] = useState<SetupState>({});
  const [domain, setDomain] = useState("");
  const [intel, setIntel] = useState<Intelligence | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [copied, setCopied] = useState("");
  const [verifying, setVerifying] = useState(false);

  async function copy(value: string, key: string) {
    await navigator.clipboard.writeText(value);
    setCopied(key);
    window.setTimeout(() => setCopied((current) => current === key ? "" : current), 1600);
  }

  useEffect(() => {
    if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(domain.trim())) {
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setDetecting(true);
      try {
        const response = await fetch(`/api/olv/domain-intelligence?domain=${encodeURIComponent(domain.trim())}`, { signal: controller.signal });
        setIntel(await response.json());
      } catch (error) {
        if ((error as Error).name !== "AbortError") setIntel({ domain, nameservers: [], provider: { id: "other", name: "DNS provider", mark: "DNS", color: "#147d75" }, instructions: [], error: "We could not inspect this domain. You can still continue manually." });
      } finally { if (!controller.signal.aborted) setDetecting(false); }
    }, 650);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [domain]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState({});
    const response = await fetch("/api/olv/setup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(new FormData(e.currentTarget))) });
    setState(await response.json());
  }

  async function verifyConnection() {
    if (!state.setupToken) return;
    setVerifying(true);
    const response = await fetch("/api/olv/setup/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: state.setupToken }) });
    const result = await response.json();
    setState((current) => response.ok ? { ...current, verification: result, error: undefined } : { ...current, error: result.error || "Verification failed." });
    setVerifying(false);
  }

  const provider = intel?.provider;
  const recordGroups = state.records ? [
    { id: "dkim", title: "DKIM authentication", description: "Three CNAME records that let receiving servers verify OLV messages are genuinely from your domain.", records: state.records.filter((record) => record.purpose === "SES DKIM") },
    { id: "routing", title: "Inbound mail routing", description: "The MX record that directs incoming organizational email to Amazon SES.", records: state.records.filter((record) => record.type === "MX") },
    { id: "spf", title: "SPF authorization", description: "A TXT record authorizing Amazon SES to send mail for your domain.", records: state.records.filter((record) => record.purpose === "SPF") },
    { id: "dmarc", title: "DMARC protection", description: "A recommended TXT policy for reporting and handling failed authentication checks.", records: state.records.filter((record) => record.purpose === "DMARC") },
    { id: "other", title: "Other DNS records", description: "Additional records required by your mail configuration.", records: state.records.filter((record) => !["SES DKIM", "SPF", "DMARC", "Inbound mail"].includes(record.purpose)) },
  ].filter((group) => group.records.length > 0) : [];
  return (
    <main className="olv-auth-page olv-domain-setup">
      <section>
        <Link href="/" className="olv-wordmark">RoleField <i>OLV</i></Link>
        {!state.records ? (
          <form onSubmit={submit}>
            <p className="eyebrow"><i /> PLUG IN YOUR DOMAIN</p>
            <h1>Bring your domain. We’ll map the route.</h1>
            <p>Enter the domain you want to use for organizational email. OLV identifies the live DNS host and prepares instructions for that provider.</p>
            <label className="olv-domain-field">
              Domain
              <span><input name="domain" required placeholder="company.com" value={domain} onChange={(event) => { setDomain(event.target.value.toLowerCase().trim()); setIntel(null); }} /><i className={detecting ? "scanning" : provider ? "found" : ""}>{detecting ? "Scanning…" : provider ? "Identified" : "Auto-detect"}</i></span>
            </label>
            {provider && !intel?.error && (
              <aside className="olv-provider-card" aria-live="polite">
                <span className="olv-provider-logo" style={{ background: provider.color }}>{provider.mark}</span>
                <div><small>DNS PROVIDER IDENTIFIED</small><b>{provider.name}</b><p>{intel.nameservers.length ? intel.nameservers.join(" · ") : "No public nameservers returned"}</p></div>
                <div className="olv-domain-age"><small>DOMAIN AGE</small><b>{ageLabel(intel.age)}</b>{intel.registrar && <span>Registered through {intel.registrar}</span>}</div>
              </aside>
            )}
            {intel?.error && <p className="olv-detect-note">{intel.error}</p>}
            <div className="olv-setup-details">
              <label>Organization name<input name="organizationName" required /></label>
              <label>Administrator name<input name="administratorName" required /></label>
              <label>Administrator external email<input name="administratorEmail" required type="email" /></label>
            </div>
            {state.error && <p role="alert" className="olv-form-error">{state.error}</p>}
            <button className="button dark">Create workspace <span>→</span></button>
          </form>
        ) : (
          <div className="olv-dns-result olv-guided-dns">
            <p className="eyebrow"><i /> CUSTOM DNS GUIDE</p>
            <header>
              <div><h1>Connect {domain}.</h1><p>These instructions are tailored to the nameservers currently authoritative for your domain.</p></div>
              {provider && <span className="olv-provider-logo large" style={{ background: provider.color }}>{provider.mark}</span>}
            </header>
            {provider && (
              <section className="olv-provider-guide">
                <div><small>IDENTIFIED PROVIDER</small><h2>{provider.name}</h2><p>{ageLabel(intel?.age)}</p>{provider.consoleUrl && <a href={provider.consoleUrl} target="_blank" rel="noreferrer">Open {provider.name} ↗</a>}</div>
                <ol>{intel?.instructions.map((instruction, index) => <li key={instruction}><span>{String(index + 1).padStart(2, "0")}</span><p>{instruction}</p></li>)}</ol>
              </section>
            )}
            <section className="olv-record-section">
              <header>
                <div><small>ADD THESE RECORDS</small><h2>Copy each field into {provider?.name || "your DNS provider"}.</h2><p>Create one new DNS record for every card below. Leave TTL on its default setting.</p></div>
                <button type="button" onClick={() => copy(state.records!.map((record) => { const ready = providerRecord(record, domain, provider?.id); return [record.type, ready.host, ready.value, ready.priority || ""].join("\t"); }).join("\n"), "all")}><CopyIcon /> {copied === "all" ? "Copied all" : "Copy all records"}</button>
              </header>
              <nav className="olv-record-summary" aria-label="DNS record groups">
                {recordGroups.map((group) => <a key={group.id} href={`#dns-${group.id}`}><b>{group.records.length}</b><span>{group.title}</span><small>{[...new Set(group.records.map((record) => record.type))].join(" · ")}</small></a>)}
              </nav>
              <div className="olv-record-groups">
                {recordGroups.map((group) => <section className="olv-record-group" id={`dns-${group.id}`} key={group.id}>
                  <header><div><small>{group.records.map((record) => record.type).filter((value, index, all) => all.indexOf(value) === index).join(" + ")}</small><h3>{group.title}</h3><p>{group.description}</p></div><b>{group.records.length} record{group.records.length === 1 ? "" : "s"}</b></header>
                  <div className="olv-record-list">
                {group.records.map((record) => {
                  const index = state.records!.indexOf(record);
                  const ready = providerRecord(record, domain, provider?.id);
                  const fields = [{ label: "Name / Host", value: ready.host, key: "host" }, { label: "Value / Points to", value: ready.value, key: "value" }, ...(ready.priority ? [{ label: "Priority", value: ready.priority, key: "priority" }] : [])];
                  return (
                    <article key={`${record.type}${record.host}${record.value}`}>
                      <header><span>{String(index + 1).padStart(2, "0")}</span><div><b>{record.type} record</b><small>{record.purpose} · {record.required ? "Required" : "Recommended"}</small></div></header>
                      <p>In {provider?.name || "your DNS provider"}, choose <strong>{record.type}</strong> as the record type, then copy the fields below.</p>
                      <div className="olv-record-fields">
                        {fields.map((field) => { const key = `${index}-${field.key}`; return <div className="olv-record-field" key={field.key}><span>{field.label}</span><div><code>{field.value}</code><button type="button" aria-label={`Copy ${field.label} for ${record.type} record ${index + 1}`} onClick={() => copy(field.value, key)}><CopyIcon /><i>{copied === key ? "Copied" : "Copy"}</i></button></div></div>; })}
                        <div className="olv-record-field"><span>TTL</span><div className="olv-no-copy"><code>Default</code><small>Leave unchanged</small></div></div>
                      </div>
                    </article>
                  );
                })}
                  </div>
                </section>)}
              </div>
            </section>
            <p className="olv-dns-footnote">DNS changes can take time to propagate. OLV will only activate mail after every required record and SES identity check passes.</p>
            <section className="olv-setup-next">
              <small>NEXT STEPS</small>
              <h2>Finished adding the records?</h2>
              <p>Run a live check now. If DNS is still propagating, you can activate your administrator account and check again from Admin.</p>
              <div>
                <button type="button" className="button dark" disabled={verifying} onClick={verifyConnection}>{verifying ? "Checking live DNS…" : "Verify connection now"}</button>
                {state.activationUrl && <a className="button" href={state.activationUrl}>Continue: create password →</a>}
              </div>
              {state.verification && <p role="status" className={state.verification.state === "MAIL_READY" ? "olv-verify-good" : "olv-verify-wait"}><strong>{state.verification.state === "MAIL_READY" ? "Connected and mail-ready." : "DNS is still propagating."}</strong> {state.verification.records.filter((record) => record.verified).length} of {state.verification.records.length} records are visible; SES identity {state.verification.identity ? "verified" : "pending"} and DKIM {state.verification.dkim ? "verified" : "pending"}.</p>}
              {state.error && <p role="alert" className="olv-form-error">{state.error}</p>}
            </section>
            {state.warning && <p role="status" className="olv-setup-warning">{state.warning}</p>}
          </div>
        )}
      </section>
    </main>
  );
}
