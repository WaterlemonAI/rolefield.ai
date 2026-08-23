"use client";
import { FormEvent, useState } from "react";
export function PasswordForm({ mode, token }: { mode: "request" | "reset"; token: string }) {
  const [status, setStatus] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload =
      mode === "request"
        ? { action: "request", email: fd.get("email") }
        : { action: "reset", token, password: fd.get("password") };
    const response = await fetch("/api/olv/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await response.json();
    setStatus(
      body.message ||
        body.error ||
        (response.ok ? "Password updated." : "Unable to continue."),
    );
  }
  return (
    <main className="olv-auth-page">
      <section>
        <form onSubmit={submit}>
          <p className="eyebrow">
            <i /> ACCOUNT RECOVERY
          </p>
          <h1>
            {mode === "request"
              ? "Reset your password."
              : "Choose a new password."}
          </h1>
          {mode === "request" ? (
            <label>
              External recovery email
              <input name="email" type="email" required />
            </label>
          ) : (
            <label>
              New password
              <input
                name="password"
                type="password"
                minLength={12}
                maxLength={200}
                required
              />
            </label>
          )}
          <button className="button dark">Continue</button>
          {status && <p role="status">{status}</p>}
          <a href="/login">Back to sign in</a>
        </form>
      </section>
    </main>
  );
}
