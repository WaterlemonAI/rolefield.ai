import Link from "next/link";
import { requirePrincipal } from "@/lib/olv/session";
import { LogoutButton } from "./logout-button";

export const metadata = { title: "RoleField App", robots: { index: false, follow: false } };
const modules = [
  { module:"MAILBOX", name: "Mailbox", eyebrow: "EMAIL OPERATIONS", description: "Use assigned organizational mailboxes and conversations.", href: "/app/mailbox", icon: "✉", active: true },
  { module:"VOICE", name: "Voice", eyebrow: "VOICE OPERATIONS", description: "Manage AI voice agents, calls and conversation workflows.", icon: "◉" },
  { module:"SOCIAL", name: "Social", eyebrow: "SOCIAL OPERATIONS", description: "Coordinate social conversations, publishing and response queues.", icon: "#" },
  { module:"DOCUMENTS", name: "Documents", eyebrow: "KNOWLEDGE OPERATIONS", description: "Organize documents, approved knowledge and agent references.", icon: "▤" },
];
export default async function OLVApp() {
  const principal = await requirePrincipal();
  const allowed=modules.filter((module)=>principal.orgRole==="ADMIN"||principal.modules.includes(module.module as "MAILBOX"|"VOICE"|"SOCIAL"|"DOCUMENTS"));
  return <main className="olv-hub"><header><Link href="/" className="olv-wordmark">RoleField <i>APP</i></Link><nav>{principal.orgRole==="ADMIN"&&<Link className="active" href="/app/admin">Administration</Link>}{allowed.map((module)=>module.href?<Link key={module.name} href={module.href}>{module.name}</Link>:<span key={module.name}>{module.name}</span>)}</nav><LogoutButton/></header><section><p className="eyebrow"><i/> {principal.orgRole==="ADMIN"?"ADMINISTRATOR WORKSPACE":"EMPLOYEE WORKSPACE"}</p><h1>Choose your operating surface.</h1><p>Welcome, {principal.name}. You can access the modules assigned to your account.</p><div className="olv-module-grid">{allowed.map((module)=><article key={module.name} className={module.active?"active":"coming"}><span>{module.icon}</span><small>{module.eyebrow}</small><h2>{module.name}</h2><p>{module.description}</p>{module.href?<Link href={module.href}>Open {module.name} <b>→</b></Link>:<div>Coming next</div>}</article>)}</div></section></main>;
}
