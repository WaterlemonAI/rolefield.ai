import Link from "next/link";
import { BusinessPage } from "@/components/business-shell";

export default function NotFound() {
  return <BusinessPage><section className="business-hero compact"><p className="eyebrow"><i /> 404</p><h1>This page is not part of the workflow.</h1><p>The address may have changed, or the page may no longer exist.</p><div className="not-found-actions"><Link className="button dark" href="/">Return home</Link><Link className="button light" href="/contact">Contact us</Link></div></section></BusinessPage>;
}
