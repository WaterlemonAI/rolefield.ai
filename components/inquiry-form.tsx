"use client";

import { FormEvent, useState } from "react";

type InquiryFormProps = { kind: "contact" | "partnership" };

export function InquiryForm({ kind }: InquiryFormProps) {
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">("idle");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("saving");
    const form = event.currentTarget;
    try {
      const response = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...Object.fromEntries(new FormData(form).entries()), kind }),
      });
      if (!response.ok) throw new Error("Inquiry request failed");
      form.reset();
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }

  if (status === "done") return <div className="inquiry-success" role="status"><span>✓</span><h2>Thank you.</h2><p>We have received your message. Our UAE team will respond within one business day.</p><button className="button light" onClick={() => setStatus("idle")}>Send another message</button></div>;

  return <form className="inquiry-form" onSubmit={submit}>
    <div className="form-grid">
      <label>Full name<input name="name" required autoComplete="name" maxLength={120} /></label>
      <label>Work email<input name="email" type="email" required autoComplete="email" maxLength={200} /></label>
      <label>Company<input name="company" required autoComplete="organization" maxLength={160} /></label>
      <label>Phone number<input name="phone" type="tel" autoComplete="tel" maxLength={40} placeholder="+971" /></label>
      {kind === "partnership" ? <label className="full">Partnership type<select name="topic" required defaultValue=""><option value="" disabled>Select one</option><option>Technology integration</option><option>Channel or reseller</option><option>Implementation partner</option><option>Telephony or infrastructure</option><option>Strategic partnership</option><option>Other</option></select></label> : <label className="full">How can we help?<select name="topic" required defaultValue=""><option value="" disabled>Select one</option><option>Product enquiry</option><option>Customer support</option><option>Press and media</option><option>Careers</option><option>Billing</option><option>Other</option></select></label>}
      <label className="full">Message<textarea name="message" required rows={6} maxLength={3000} placeholder={kind === "partnership" ? "Tell us about your organisation, customers and the partnership you have in mind." : "Tell us what you would like to discuss."} /></label>
      <label className="consent full"><input name="consent" type="checkbox" value="yes" required /><span>I agree that RoleField may use these details to respond to my enquiry, as described in the <a href="/privacy">Privacy Notice</a>.</span></label>
      <div className="honeypot" aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
    </div>
    {status === "error" && <p className="form-error" role="alert">We could not send your message. Please try again or email <a href="mailto:voice@ai7lab.net">voice@ai7lab.net</a>.</p>}
    <button className="button dark submit" disabled={status === "saving"}>{status === "saving" ? "Sending…" : kind === "partnership" ? "Start a partnership conversation" : "Send message"}</button>
  </form>;
}
