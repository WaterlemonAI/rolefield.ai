import type { Metadata } from "next";
import { BusinessPage } from "@/components/business-shell";

export const metadata: Metadata = { title: "Privacy Notice", description: "How RoleField collects, uses and protects information submitted through its website.", alternates: { canonical: "/privacy" } };

const sections = [
  ["1. Who we are", "RoleField is a product of AI7Lab in the United Arab Emirates. This notice explains how we handle personal information collected through the RoleField website. For privacy questions, contact voice@ai7lab.net."],
  ["2. Information we collect", "We collect information you choose to provide, such as your name, work email, company, phone number, preferred language, meeting preferences, use case and message. We may also receive basic technical information needed to operate and secure the website, such as IP address, browser type, timestamps and server logs."],
  ["3. How we use information", "We use information to respond to enquiries, arrange demonstrations and callbacks, assess partnership opportunities, provide requested communications, operate and secure the website, prevent misuse, improve our services and meet legal obligations."],
  ["4. Our basis for processing", "Depending on the circumstances, we process information because you asked us to take steps before entering a contract, because it is necessary for our legitimate interests in responding to business enquiries and operating our website, because we must meet a legal obligation or because you have given consent."],
  ["5. Who receives information", "We may share information with authorised AI7Lab personnel and service providers that support hosting, databases, email delivery and website operations. These providers may process information only for the services they provide to us and under appropriate safeguards. We do not sell personal information."],
  ["6. International processing", "Our service providers may process information outside the UAE. Where required, we use appropriate contractual or legal safeguards for international transfers."],
  ["7. Retention", "We keep enquiry and booking information only for as long as reasonably necessary to respond, manage the relationship, maintain business records and meet legal obligations. Retention periods depend on the nature of the interaction and applicable requirements."],
  ["8. Security", "We use reasonable technical and organisational measures designed to protect information. No internet transmission or storage system is completely secure, so please do not submit passwords, payment-card data, health information or other sensitive material through general forms."],
  ["9. Your rights", "Depending on applicable law, you may ask to access, correct, delete or restrict the use of your information, object to certain processing, withdraw consent or request a portable copy. We may need to verify your identity before acting on a request."],
  ["10. Cookies and analytics", "The current website does not use advertising cookies. Essential technical storage may be used where necessary for security and basic website operation. If we add non-essential analytics or marketing cookies, we will update this notice and provide any consent controls required by law."],
  ["11. Updates and contact", "We may update this notice as our practices or legal obligations change. The latest version will appear here. To exercise a privacy right or ask a question, email voice@ai7lab.net or write to RoleField, AI7Lab, DIFC, Dubai, United Arab Emirates."],
];

export default function PrivacyPage() { return <BusinessPage><section className="legal-hero"><p className="eyebrow"><i /> PRIVACY</p><h1>Privacy Notice</h1><p>Effective 18 August 2026</p></section><article className="legal-document">{sections.map(([title, body]) => <section key={title}><h2>{title}</h2><p>{body}</p></section>)}</article></BusinessPage>; }
