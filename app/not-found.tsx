import Link from "next/link";
import { BusinessPage } from "@/components/business-shell";

export default function NotFound() {
  return <BusinessPage><section className="business-hero compact"><p className="eyebrow"><i /> SIGNAL LOST / 404</p><h1>This path ends here.</h1><p>Return to the operating field or tell us what you were trying to find.</p><div className="not-found-actions"><Link className="button dark" href="/">Return home</Link><Link className="button light" href="/contact">Contact us</Link></div></section></BusinessPage>;
}
