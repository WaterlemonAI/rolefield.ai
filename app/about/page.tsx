import type { Metadata } from "next";
import Link from "next/link";
import { BusinessPage } from "@/components/business-shell";

export const metadata: Metadata = { title: "About us", description: "Meet RoleField, the UAE-built autonomous customer operations company creating multilingual AI agents for the GCC.", alternates: { canonical: "/about" } };

export default function AboutPage() {
  return <BusinessPage>
    <section className="business-hero"><p className="eyebrow"><i /> ABOUT ROLEFIELD</p><h1>Customer operations should move at the speed of the customer.</h1><p>RoleField builds autonomous, multilingual AI agents that carry work from the first conversation through to the completed outcome.</p></section>
    <section className="business-section split-story"><div><p className="eyebrow"><i /> OUR PURPOSE</p><h2>Conversations are only the beginning.</h2></div><div><p>Most customer journeys break between systems: a good conversation happens, but the follow-up is late, the calendar is not updated or the CRM record is incomplete. RoleField is designed to own that gap.</p><p>Our agents understand the customer, take the next approved action, coordinate with business systems and keep a clear record of every outcome. People remain in control through defined rules, approvals and contextual handovers.</p></div></section>
    <section className="business-section values-section"><header><p className="eyebrow"><i /> HOW WE BUILD</p><h2>Regional context. Operational accountability.</h2></header><div className="value-grid"><article><span>01</span><h3>Built for the GCC</h3><p>Arabic-native experiences, multilingual coverage and deployment choices shaped around regional businesses.</p></article><article><span>02</span><h3>Outcome over novelty</h3><p>We measure completed work, customer experience and business impact—not the number of conversations.</p></article><article><span>03</span><h3>Human control</h3><p>Clear boundaries, auditable actions and seamless escalation keep teams responsible for important decisions.</p></article></div></section>
    <section className="business-section company-facts"><div><b>ROLEFIELD</b><span>Product and company</span></div><div><b>AI7Lab</b><span>Parent company</span></div><div><b>DIFC, UAE</b><span>Our location</span></div><div><b>GCC</b><span>Our home market</span></div></section>
    <section className="business-cta"><p className="eyebrow light"><i /> WORK WITH US</p><h2>Bring us the outcome.<br />We will design the workflow.</h2><div><Link className="button teal" href="/?demo=1">Book a demo</Link><Link className="button light" href="/contact">Contact us</Link></div></section>
  </BusinessPage>;
}
