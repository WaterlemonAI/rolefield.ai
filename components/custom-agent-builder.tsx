"use client";

import { FormEvent, useEffect, useState } from "react";

const genders = ["Female", "Male", "No preference"];
const languages = ["Arabic", "English", "Russian", "Hindi", "Urdu", "Malayalam", "Tagalog", "French", "German", "Italian", "Spanish"];
const useCases = ["Customer service", "Lead qualification", "Appointment booking", "Collections", "Guest concierge", "Property enquiries", "Banking assistance", "Order and delivery", "Custom workflow"];

export function CustomAgentBuilder({ onBookSession }: { onBookSession: () => void }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [gender, setGender] = useState(genders[2]);
  const [language, setLanguage] = useState(languages[0]);
  const [useCase, setUseCase] = useState(useCases[0]);
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");

  function start() { setOpen(true); setStep(1); setStatus("idle"); }

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("saving");
    const email = String(new FormData(event.currentTarget).get("email") || "");
    try {
      const response = await fetch("/api/agent-requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, gender, language, useCase }) });
      if (!response.ok) throw new Error("Agent request failed");
      setStatus("idle");
      setStep(3);
    } catch {
      setStatus("error");
    }
  }

  return <>
    <article className="agent-card custom-agent-card">
      <div className="agent-status"><span><i />BUILD YOURS</span><small>CONFIGURABLE</small></div>
      <div className="custom-agent-visual" aria-hidden="true"><div className="custom-orbit"><span>+</span></div><small>YOUR AGENT</small></div>
      <div className="agent-details"><div className="agent-profile"><p>Designed around your operation</p><h3>Set up your own agent</h3><span>Choose the voice, language and work to be done.</span><div className="custom-preview"><div><b>GENDER</b><span>Your choice</span></div><div><b>LANGUAGE</b><span>11 options</span></div><div><b>USE CASE</b><span>Your workflow</span></div></div></div><button className="custom-agent-start" onClick={start}>Configure your agent <b>→</b></button></div>
    </article>
    {open && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}><div className="scheduler agent-builder-modal" role="dialog" aria-modal="true" aria-labelledby="agent-builder-title"><button className="close" onClick={() => setOpen(false)} aria-label="Close">×</button>
      {step === 1 && <><p className="eyebrow"><i /> SET UP YOUR AGENT</p><h2 id="agent-builder-title">Make the agent fit your work.</h2><p className="modal-lede">Choose a starting configuration. We will refine it with you before the agent goes into service.</p><fieldset className="builder-options"><legend>1. Gender</legend><div>{genders.map((item) => <button type="button" key={item} className={gender === item ? "selected" : ""} onClick={() => setGender(item)}>{item}</button>)}</div></fieldset><fieldset className="builder-options"><legend>2. Primary language</legend><div>{languages.map((item) => <button type="button" key={item} className={language === item ? "selected" : ""} onClick={() => setLanguage(item)}>{item}</button>)}</div></fieldset><fieldset className="builder-options"><legend>3. Use case</legend><select value={useCase} onChange={(event) => setUseCase(event.target.value)}>{useCases.map((item) => <option key={item}>{item}</option>)}</select></fieldset><button className="button dark continue" onClick={() => setStep(2)}>Continue <span>→</span></button></>}
      {step === 2 && <><button type="button" className="back" onClick={() => setStep(1)}>← Change configuration</button><p className="eyebrow"><i /> ONE LAST STEP</p><h2 id="agent-builder-title">Where should we send the update?</h2><div className="agent-summary"><div><small>GENDER</small><b>{gender}</b></div><div><small>LANGUAGE</small><b>{language}</b></div><div><small>USE CASE</small><b>{useCase}</b></div></div><form onSubmit={submit} className="agent-email-form"><label>Work email<input name="email" type="email" required autoComplete="email" placeholder="you@company.com" /></label>{status === "error" && <p className="form-error" role="alert">We could not save your request. Please try again.</p>}<button className="button dark submit" disabled={status === "saving"}>{status === "saving" ? "Creating request…" : "Set up my agent"}</button><small>By continuing, you agree that RoleField may contact you about this request. See our <a href="/privacy">Privacy Notice</a>.</small></form></>}
      {step === 3 && <div className="success custom-agent-success"><span>✓</span><p className="eyebrow">REQUEST RECEIVED</p><h2 id="agent-builder-title">Your agent is getting ready.</h2><p>Done — we’ll update you once your agent is ready for service. Let’s connect to discuss your goals and objectives so your agent can start working for you.</p><button className="button dark" onClick={() => { setOpen(false); onBookSession(); }}>Book a session <b>→</b></button><button className="button light" onClick={() => setOpen(false)}>Done for now</button></div>}
    </div></div>}
  </>;
}
