export type DnsProvider = {
  id: string;
  name: string;
  mark: string;
  color: string;
  consoleUrl?: string;
  matchedSuffix?: string;
};

const PROVIDERS = [
  { id: "cloudflare", name: "Cloudflare", mark: "CF", color: "#f6821f", suffixes: ["cloudflare.com"], consoleUrl: "https://dash.cloudflare.com" },
  { id: "route53", name: "Amazon Route 53", mark: "AWS", color: "#ff9900", suffixes: ["awsdns-"], consoleUrl: "https://console.aws.amazon.com/route53" },
  { id: "godaddy", name: "GoDaddy", mark: "GO", color: "#00a4a6", suffixes: ["domaincontrol.com"], consoleUrl: "https://dcc.godaddy.com/manage/dns" },
  { id: "namecheap", name: "Namecheap", mark: "N", color: "#de3723", suffixes: ["registrar-servers.com"], consoleUrl: "https://ap.www.namecheap.com/domains/domaincontrolpanel" },
  { id: "spaceship", name: "Spaceship", mark: "S", color: "#6948ff", suffixes: ["spaceship.net"], consoleUrl: "https://www.spaceship.com/application/domain-list-application" },
  { id: "squarespace", name: "Squarespace Domains", mark: "SQ", color: "#111111", suffixes: ["googledomains.com", "squarespacedns.com"], consoleUrl: "https://account.squarespace.com/domains" },
  { id: "hostinger", name: "Hostinger", mark: "H", color: "#673de6", suffixes: ["dns-parking.com"], consoleUrl: "https://hpanel.hostinger.com" },
  { id: "ionos", name: "IONOS", mark: "1&1", color: "#003d8f", suffixes: ["ui-dns.", "ionos.com"], consoleUrl: "https://my.ionos.com/domains" },
  { id: "digitalocean", name: "DigitalOcean", mark: "DO", color: "#0069ff", suffixes: ["digitalocean.com"], consoleUrl: "https://cloud.digitalocean.com/networking/domains" },
  { id: "vercel", name: "Vercel DNS", mark: "▲", color: "#000000", suffixes: ["vercel-dns.com"], consoleUrl: "https://vercel.com/dashboard" },
  { id: "bluehost", name: "Bluehost", mark: "BH", color: "#3575d3", suffixes: ["bluehost.com"], consoleUrl: "https://my.bluehost.com/hosting/app" },
  { id: "porkbun", name: "Porkbun", mark: "PB", color: "#ef6c7b", suffixes: ["porkbun.com"], consoleUrl: "https://porkbun.com/account/domainsSpeedy" },
] as const;

export function identifyDnsProvider(nameservers: string[]): DnsProvider {
  const normalized = nameservers.map((name) => name.toLowerCase().replace(/\.$/, ""));
  for (const provider of PROVIDERS) {
    const suffix = provider.suffixes.find((candidate) => normalized.some((name) => name.includes(candidate)));
    if (suffix) return { id: provider.id, name: provider.name, mark: provider.mark, color: provider.color, consoleUrl: provider.consoleUrl, matchedSuffix: suffix };
  }
  const host = normalized[0] || "";
  const label = host.split(".").slice(-2).join(".") || "your DNS host";
  return { id: "other", name: label, mark: "DNS", color: "#147d75" };
}

export function domainAge(registeredAt?: string | null, now = new Date()) {
  if (!registeredAt) return null;
  const created = new Date(registeredAt);
  if (Number.isNaN(created.valueOf()) || created > now) return null;
  const months = Math.max(0, Math.floor((now.valueOf() - created.valueOf()) / 2_629_746_000));
  return { registeredAt: created.toISOString(), months, years: Math.floor(months / 12), remainingMonths: months % 12 };
}

export function providerInstructions(provider: DnsProvider) {
  const open = provider.id === "other" ? `Sign in to the service that manages the nameservers shown below.` : `Open ${provider.name} and go to its DNS records or DNS management screen.`;
  const save = provider.id === "route53" ? "Create each record in the hosted zone. For the MX record, enter priority 10 and the mail-server value separately." : provider.id === "cloudflare" ? "Add each record under DNS → Records. Keep every mail-related record DNS only; do not proxy CNAME records." : provider.id === "godaddy" ? "Choose Add New Record for each row. GoDaddy may automatically shorten the host to the part before your domain." : provider.id === "namecheap" ? "Open Advanced DNS → Host Records and add each row. Use @ when the host is the root domain." : provider.id === "spaceship" ? "Open Domain Portfolio → Manage → DNS, then add each record. Use @ for root-domain MX and TXT records." : provider.id === "squarespace" ? "Open Domains → DNS Settings → Custom records. Use @ for root-domain MX and TXT records." : `Add the records exactly as listed. Your provider may use @ for the root domain and may append the domain automatically.`;
  return [open, save, "Save the changes, allow DNS time to propagate, then return to OLV and run verification."];
}
