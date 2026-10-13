import type { Metadata } from "next";
import Link from "next/link";
import { BusinessPage } from "@/components/business-shell";
import { InquiryForm } from "@/components/inquiry-form";

export const metadata: Metadata = { title: "Contact", description: "Talk to Rolefield about applying real-world AI to a measurable enterprise workflow.", alternates: { canonical: "/contact" } };

export default function ContactPage() {
  return <BusinessPage><section className="business-hero compact"><p className="eyebrow"><i /> CONTACT / START WITH AN OUTCOME</p><h1>Show us where the work slows down.</h1><p>Bring a high-volume workflow, a costly queue or a customer journey that loses context. We will map the fastest route to measurable value.</p></section><section className="contact-layout business-section"><aside><div><small>BEST STARTING POINT</small><p>Volume, handling time, escalation rate and the outcome you want to improve.</p></div><div><small>DIRECT</small><a href="mailto:voice@ai7lab.net">voice@ai7lab.net</a></div><div><small>RESPONSE</small><p>Within one business day</p></div><div><small>WORKING SESSION</small><Link href="/?demo=1">See the products in action →</Link></div></aside><div className="form-panel"><p className="eyebrow"><i /> TELL US THE OPERATING PROBLEM</p><h2>What should AI make easier?</h2><InquiryForm kind="contact" /></div></section></BusinessPage>;
}
