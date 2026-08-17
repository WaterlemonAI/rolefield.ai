import type { Metadata } from "next";
import { BusinessPage } from "@/components/business-shell";

export const metadata: Metadata = { title: "Terms of use", description: "Terms governing the use of the RoleField website.", alternates: { canonical: "/terms" } };

const sections = [
  ["1. About these terms", "These Terms of Use govern your access to and use of the RoleField website. RoleField is a product of AI7Lab in the United Arab Emirates. By using this website, you agree to these terms. If you do not agree, please do not use the website."],
  ["2. Website purpose", "This website provides general information about RoleField products and services and lets you contact us or request a demonstration. Website content is not professional, legal, financial or regulatory advice, and does not create a customer or partnership relationship."],
  ["3. Permitted use", "You may use the website for lawful business and informational purposes. You must not misuse the website, attempt unauthorised access, interfere with its operation, introduce malicious code, scrape it at scale, impersonate another person or submit false or unlawful information."],
  ["4. Intellectual property", "The website, RoleField name, logo, visual design, text, software and other content are owned by or licensed to AI7Lab and protected by applicable intellectual-property laws. No licence is granted except the limited right to access and use the website under these terms."],
  ["5. Demonstrations and enquiries", "A demo booking, callback request, contact form or partnership enquiry is a request for discussion only. It does not guarantee availability, create a binding offer or form a contract. Any product subscription or commercial engagement will be governed by separate written terms."],
  ["6. Third-party services", "The website may use or link to third-party services. We are not responsible for third-party content, availability or practices. Your use of those services may be subject to their own terms and privacy notices."],
  ["7. Availability and accuracy", "We work to keep the website available and accurate, but it is provided on an “as available” basis. To the extent permitted by law, we do not warrant that content will always be complete, current, uninterrupted or error-free."],
  ["8. Liability", "To the fullest extent permitted by applicable law, AI7Lab and RoleField will not be liable for indirect, incidental, special or consequential loss arising from use of, or inability to use, this website. Nothing in these terms excludes liability that cannot lawfully be excluded."],
  ["9. Privacy", "Personal information submitted through the website is handled as described in our Privacy Notice. Please do not send confidential, regulated or sensitive information through general enquiry forms."],
  ["10. Changes", "We may update the website or these terms when our services, practices or legal obligations change. Updated terms take effect when published on this page, with the effective date shown above."],
  ["11. Governing law", "These terms are governed by the laws applicable in the Dubai International Financial Centre, United Arab Emirates. Courts with competent jurisdiction in the DIFC will have exclusive jurisdiction, subject to any mandatory law that applies."],
  ["12. Contact", "Questions about these terms may be sent to voice@ai7lab.net or addressed to RoleField, AI7Lab, DIFC, Dubai, United Arab Emirates."],
];

export default function TermsPage() { return <BusinessPage><section className="legal-hero"><p className="eyebrow"><i /> LEGAL</p><h1>Terms of use</h1><p>Effective 18 August 2026</p></section><article className="legal-document">{sections.map(([title, body]) => <section key={title}><h2>{title}</h2><p>{body}</p></section>)}</article></BusinessPage>; }
