import type { Metadata } from "next";
import Link from "next/link";
import { BusinessPage } from "@/components/business-shell";
import { RoiCalculator } from "@/components/roi-calculator";

export const metadata: Metadata = { title: "ROI Calculator", description: "Compare the estimated annual cost of RoleField with human-led customer operations and an anonymized market benchmark.", alternates: { canonical: "/roi-calculator" } };

export default function RoiCalculatorPage() {
  return <BusinessPage><section className="business-hero compact roi-hero"><p className="eyebrow"><i /> ROI CALCULATOR</p><h1>See what customer operations could cost differently.</h1><p>Enter your annual conversation volume and number of workflows. We will compare RoleField with the UAE telecaller headcount required to handle the same call time.</p></section><RoiCalculator /><section className="roi-funnel-cta"><div><p className="eyebrow light"><i /> YOUR NEXT STEP</p><h2>Need a customized proposal for your company?</h2><p>Our experts can help you build the right estimates around your actual workflow, answer your questions and identify the strongest path to ROI.</p></div><div><span>30 minutes · UAE team · English or Arabic</span><Link className="button teal" href="/?demo=1">Book a demo <b>→</b></Link><small>No obligation. Bring your call volumes or use-case questions.</small></div></section></BusinessPage>;
}
