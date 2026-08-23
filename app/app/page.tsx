import Link from "next/link";
import { requirePrincipal } from "@/lib/olv/session";
import { LogoutButton } from "./logout-button";

export const metadata = { title: "RoleField App", robots: { index: false, follow: false } };
const modules = [
  { name: "Mailbox", eyebrow: "EMAIL OPERATIONS", description: "Configure domains, groups, users and organizational mailboxes.", href: "/app/admin", icon: "✉", active: true },
  { name: "Voice", eyebrow: "VOICE OPERATIONS", description: "Manage AI voice agents, calls and conversation workflows.", icon: "◉" },
  { name: "Social", eyebrow: "SOCIAL OPERATIONS", description: "Coordinate social conversations, publishing and response queues.", icon: "#" },
  { name: "Documents", eyebrow: "KNOWLEDGE OPERATIONS", description: "Organize documents, approved knowledge and agent references.", icon: "▤" },
];
export default async function OLVApp() {
  const principal = await requirePrincipal();
  return <main className="olv-hub"><header><Link href="/" className="olv-wordmark">RoleField <i>APP</i></Link><nav><Link className="active" href="/app/admin">Mailbox</Link><span>Voice</span><span>Social</span><span>Documents</span></nav><LogoutButton/></header><section><p className="eyebrow"><i/> PRIVATE OWNER WORKSPACE</p><h1>Choose your operating surface.</h1><p>Welcome, {principal.name}. RoleField brings every business conversation and its supporting knowledge into one controlled workspace.</p><div className="olv-module-grid">{modules.map((module)=><article key={module.name} className={module.active?"active":"coming"}><span>{module.icon}</span><small>{module.eyebrow}</small><h2>{module.name}</h2><p>{module.description}</p>{module.href?<Link href={module.href}>Open {module.name} <b>→</b></Link>:<div>Coming next</div>}</article>)}</div></section></main>;
}
