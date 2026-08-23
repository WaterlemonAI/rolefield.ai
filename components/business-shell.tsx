import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

const companyLinks = [
  ["About us", "/about"],
  ["Partnerships", "/partnerships"],
  ["Contact", "/contact"],
];

export function Brand() {
  return <span className="brand-lockup">
    <Image className="brand-logo" src="/rolefield-logo.png" alt="RoleField.ai" width={1527} height={406} priority />
    <small>conversations &amp; more</small>
  </span>;
}

export function BusinessHeader() {
  return <header className="business-nav">
    <Link className="brand" href="/" aria-label="RoleField.ai home"><Brand /></Link>
    <nav className="business-desktop-nav" aria-label="Business navigation">
      <Link href="/#platform">Platform</Link>
      <Link href="/#agents">Agents</Link>
      <Link href="/about">About</Link>
      <Link href="/partnerships">Partnerships</Link>
      <Link href="/roi-calculator">ROI calculator</Link>
      <Link href="/contact">Contact</Link>
      <Link href="/login">App</Link>
    </nav>
    <details className="business-menu"><summary>Menu</summary><nav aria-label="Mobile business navigation"><Link href="/">Home</Link><Link href="/#platform">Platform</Link><Link href="/#agents">Agents</Link><Link href="/about">About</Link><Link href="/partnerships">Partnerships</Link><Link href="/roi-calculator">ROI calculator</Link><Link href="/contact">Contact</Link><Link href="/login">App</Link><Link href="/terms">Terms</Link><Link href="/privacy">Privacy</Link></nav></details>
    <Link className="button dark compact" href="/?demo=1">Book a demo</Link>
  </header>;
}

export function BusinessFooter() {
  return <footer className="business-footer">
    <div className="business-footer-grid">
      <div><Link className="brand" href="/" aria-label="RoleField.ai home"><Brand /></Link><p>Autonomous customer operations for ambitious businesses across the GCC.</p><small>A company by AI7Lab, UAE.</small></div>
      <div><b>COMPANY</b>{companyLinks.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}<Link href="/roi-calculator">ROI calculator</Link></div>
      <div><b>LEGAL</b><Link href="/terms">Terms of use</Link><Link href="/privacy">Privacy</Link></div>
      <div><b>CONTACT</b><a href="mailto:voice@ai7lab.net">voice@ai7lab.net</a><p>DIFC, Dubai, UAE</p></div>
    </div>
    <div className="footer-bottom"><span>© {new Date().getFullYear()} RoleField</span><span>Built in the UAE for the GCC</span></div>
  </footer>;
}

export function BusinessPage({ children }: { children: ReactNode }) {
  return <div className="business-page"><a className="skip-link" href="#main-content">Skip to main content</a><BusinessHeader /><main id="main-content">{children}</main><BusinessFooter /></div>;
}
