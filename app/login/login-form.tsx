"use client";
import { FormEvent, useState } from "react";
import Link from "next/link";

export function LoginForm() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError("");
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const response = await fetch("/api/olv/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Unable to sign in.");
      window.location.assign("/app");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to sign in."); setLoading(false); }
  }
  return <main className="olv-login">
    <section className="olv-login-brand"><Link href="/" className="olv-wordmark">RoleField <i>OLV</i></Link><div><p>ORGANIZATIONAL LANGUAGE &amp; VELOCITY</p><h1>Business email,<br/><em>quietly organized.</em></h1><span>A private preview environment for secure organizational communication.</span></div><small>PRIVATE MVP · OWNER ACCESS ONLY</small></section>
    <section className="olv-login-panel"><form onSubmit={submit}><header><span className="olv-mark">O</span><p>Welcome back</p><h2>Sign in to OLV</h2><small>Use your external recovery email and OLV password.</small></header><label>Email address<input name="email" type="email" autoComplete="email" required placeholder="you@company.com"/></label><label>Password<input name="password" type="password" autoComplete="current-password" required minLength={12} placeholder="••••••••••••"/></label><a className="olv-forgot" href="/forgot-password">Forgot password?</a>{error && <p className="olv-form-error" role="alert">{error}</p>}<button disabled={loading}>{loading ? "Signing in…" : "Sign in"}<span>→</span></button><p className="olv-login-note"><i/> Protected by an HTTP-only session. Access expires after 12 hours.</p><a className="olv-create-workspace" href="/setup">Create an organization workspace</a></form><Link href="/">← Back to RoleField</Link></section>
  </main>;
}
