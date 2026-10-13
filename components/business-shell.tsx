import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { ConversionLayer, DemoTrigger } from "@/components/conversion-layer";

const companyLinks = [
  ["About us", "/about"],
  ["Partnerships", "/partnerships"],
  ["Contact", "/contact"],
];

export function Brand() {
  return <span className="brand-lockup">
    <Image className="brand-logo" src="/rolefield-logo.png" alt="RoleField.ai" width={1527} height={406} priority />
  </span>;
}

export function BusinessHeader() {
  return <header className="business-nav">
    <Link className="brand" href="/" aria-label="RoleField.ai home"><Brand /></Link>
    <nav className="business-desktop-nav" aria-label="Business navigation">
      <Link href="/#products">Products</Link>
      <Link href="/#technology">Technology</Link>
      <Link href="/about">About</Link>
      <Link href="/roi-calculator">ROI calculator</Link>
      <Link href="/partnerships">Partners</Link>
    </nav>
    <details className="business-menu"><summary>Menu</summary><nav aria-label="Mobile business navigation"><Link href="/">Home</Link><Link href="/#products">Products</Link><Link href="/#technology">Technology</Link><Link href="/about">About</Link><Link href="/partnerships">Partners</Link><Link href="/roi-calculator">ROI calculator</Link><Link href="/contact">Contact</Link><Link href="/terms">Terms</Link><Link href="/privacy">Privacy</Link></nav></details>
    <DemoTrigger className="button dark compact">Book a demo <span aria-hidden="true">↗</span></DemoTrigger>
  </header>;
}

export function BusinessFooter() {
  return <footer className="business-footer">
    <div className="business-footer-grid">
      <div><Link className="brand" href="/" aria-label="RoleField.ai home"><Brand /></Link><p>Enterprise AI across conversations, physical service and the live world.</p><small>A product of AI7Lab Tech Evolution Pte. Ltd.</small></div>
      <div><b>EXPLORE</b><Link href="/#products">Products</Link><Link href="/#technology">Technology</Link><Link href="/roi-calculator">ROI calculator</Link></div>
      <div><b>COMPANY</b>{companyLinks.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}</div>
      <div><b>LEGAL</b><Link href="/terms">Terms of use</Link><Link href="/privacy">Privacy</Link></div>
      <div><b>CONTACT</b><a href="mailto:voice@ai7lab.net">voice@ai7lab.net</a><a href="https://www.ai7lab.net" target="_blank" rel="noopener noreferrer">AI7Lab ↗</a></div>
    </div>
    <div className="footer-bottom"><span>© {new Date().getFullYear()} Rolefield</span><span>AI for the real world.</span></div>
  </footer>;
}

export function BusinessPage({ children }: { children: ReactNode }) {
  return <div className="business-page"><a className="skip-link" href="#main-content">Skip to main content</a><BusinessHeader /><main id="main-content">{children}</main><BusinessFooter /><ConversionLayer /></div>;
}
