import type { Metadata } from "next";
import Link from "next/link";
import { BusinessPage } from "@/components/business-shell";
import { RoiCalculator } from "@/components/roi-calculator";

export const metadata: Metadata = { title: "ROI Calculator", description: "Compare the estimated annual cost of RoleField with human-led customer operations and an anonymized market benchmark.", alternates: { canonical: "/roi-calculator" } };

export default function RoiCalculatorPage() {
  return <BusinessPage><section className="business-hero compact roi-hero"><p className="eyebrow"><i /> ROI / TURN VOLUME INTO LEVERAGE</p><h1>Put a number on the operating advantage.</h1><p>Model the annual cost of a voice workflow with Rolefield, compare it with human-led delivery and identify where automation creates room to grow.</p></section><RoiCalculator /><section className="roi-funnel-cta"><div><p className="eyebrow light"><i /> FROM ESTIMATE TO BUSINESS CASE</p><h2>Use your real workflow.<br />Find your credible return.</h2><p>We will pressure-test the assumptions, map integrations and define the first deployment milestone.</p></div><div><span>30 minutes · Enterprise working session</span><Link className="button teal" href="/?demo=1">Build my business case <b>→</b></Link><small>Bring volume, handling time and escalation data if you have it.</small></div></section></BusinessPage>;
}
