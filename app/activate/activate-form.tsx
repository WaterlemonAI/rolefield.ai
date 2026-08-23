"use client";
import { FormEvent, useState } from "react";

export function ActivateForm({ token }: { token: string }) {
  const [status, setStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [activated, setActivated] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setStatus("");
    const password = String(new FormData(e.currentTarget).get("password"));
    try {
      const response = await fetch("/api/olv/activate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password }) });
      const body = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) {
        setStatus(body.error || "We could not activate the account. Please try again.");
        return;
      }
      setActivated(true);
      setStatus("Account activated. Taking you to sign in…");
      window.setTimeout(() => window.location.assign("/login?activated=1"), 900);
    } catch {
      setStatus("The activation service could not be reached. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="olv-auth-page">
      <section>
        <form onSubmit={submit}>
          <p className="eyebrow"><i /> ACCOUNT ACTIVATION</p>
          <h1>{activated ? "You’re activated." : "Choose your password."}</h1>
          <p>{activated ? "Your password is saved securely. Redirecting you to the OLV sign-in page." : "Use at least 12 characters. Your activation link can only be used once."}</p>
          {!activated && <label>New password<input name="password" type="password" minLength={12} required autoComplete="new-password" disabled={submitting} /></label>}
          {!activated && <button className="button dark" disabled={submitting}>{submitting ? "Activating…" : "Activate account"}</button>}
          {status && <p role="status" className={activated ? "olv-activation-success" : "olv-form-error"}>{status}</p>}
          <a href="/login">Go to sign in</a>
        </form>
      </section>
    </main>
  );
}
