import type { Metadata } from "next";
import Link from "next/link";
import { BusinessPage } from "@/components/business-shell";
import { InquiryForm } from "@/components/inquiry-form";

export const metadata: Metadata = { title: "Contact", description: "Contact RoleField in DIFC, Dubai about autonomous multilingual customer operations.", alternates: { canonical: "/contact" } };

export default function ContactPage() {
  return <BusinessPage><section className="business-hero compact"><p className="eyebrow"><i /> CONTACT</p><h1>Let’s talk about the work you want to transform.</h1><p>Tell us what your customers need and where the workflow slows down. We will help you map the right starting point.</p></section><section className="contact-layout business-section"><aside><div><small>EMAIL</small><a href="mailto:voice@ai7lab.net">voice@ai7lab.net</a></div><div><small>LOCATION</small><p>DIFC<br />Dubai, United Arab Emirates</p></div><div><small>RESPONSE TIME</small><p>Within one business day</p></div><div><small>DEMO</small><Link href="/?demo=1">Book a product demonstration →</Link></div></aside><div className="form-panel"><p className="eyebrow"><i /> SEND A MESSAGE</p><h2>How can we help?</h2><InquiryForm kind="contact" /></div></section></BusinessPage>;
}
