"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import styles from "@/app/homepage.module.css";

const DEMO_EVENT = "rolefield:open-demo";
const SUBSCRIBER_SESSION_KEY = "rolefield:subscriber-prompt-shown";

type DemoTriggerProps = {
  children: React.ReactNode;
  className?: string;
  product?: "Kiosk" | "Seer";
};

export function DemoTrigger({ children, className, product }: DemoTriggerProps) {
  return (
    <button className={className} type="button" onClick={() => window.dispatchEvent(new CustomEvent(DEMO_EVENT, { detail: { product } }))}>
      {children}
    </button>
  );
}

function DialogShell({ label, onClose, children, wide = false }: { label: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const handleKey = (event: KeyboardEvent) => event.key === "Escape" && onCloseRef.current();
    window.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", handleKey);
    };
  }, []);

  return (
    <div className={styles.dialogBackdrop} role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className={`${styles.dialog} ${wide ? styles.dialogWide : ""}`} role="dialog" aria-modal="true" aria-label={label}>
        <button ref={closeRef} className={styles.dialogClose} type="button" onClick={onClose} aria-label="Close dialog">×</button>
        {children}
      </section>
    </div>
  );
}

function SessionEmailCapture() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (sessionStorage.getItem(SUBSCRIBER_SESSION_KEY)) return;
    const timer = window.setTimeout(() => {
      sessionStorage.setItem(SUBSCRIBER_SESSION_KEY, "1");
      setOpen(true);
    }, 4_000);
    const deferToDemo = () => {
      window.clearTimeout(timer);
      sessionStorage.setItem(SUBSCRIBER_SESSION_KEY, "1");
      setOpen(false);
    };
    window.addEventListener(DEMO_EVENT, deferToDemo);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(DEMO_EVENT, deferToDemo);
    };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    setMessage("");
    try {
      const response = await fetch("/api/subscribers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, source: "homepage-session-popup" }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Unable to subscribe");
      setStatus("success");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Please try again.");
    }
  }

  if (!open) return null;
  return (
    <DialogShell label="Subscribe to Rolefield updates" onClose={() => setOpen(false)}>
      <div className={styles.subscribeVisual} aria-hidden="true"><span /><i /><b>15M</b><small>conversations / month</small></div>
      <div className={styles.subscribeCopy}>
        <span className={styles.modalEyebrow}>The real-world AI brief</span>
        {status === "success" ? (
          <div className={styles.modalSuccess}>
            <span>✓</span>
            <h2>You’re on the list.</h2>
            <p>We’ll send you the signals that matter—enterprise AI economics, deployment lessons and what comes next.</p>
            <button type="button" onClick={() => setOpen(false)}>Continue exploring</button>
          </div>
        ) : (
          <>
            <h2>See the operating shift before it becomes obvious.</h2>
            <p>Occasional field notes on AI that works beyond the screen—built for leaders turning capability into return.</p>
            <form className={styles.subscribeForm} onSubmit={submit}>
              <label htmlFor="subscriber-email">Work email</label>
              <div><input id="subscriber-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" autoComplete="email" required /><button disabled={status === "sending"}>{status === "sending" ? "Joining…" : "Keep me ahead"}</button></div>
              {status === "error" && <p className={styles.formError} role="alert">{message}</p>}
            </form>
            <small className={styles.privacyNote}>Useful perspective, not inbox noise. Unsubscribe anytime. <Link href="/privacy">Privacy</Link></small>
          </>
        )}
      </div>
    </DialogShell>
  );
}

function dubaiDate(offset: number) {
  const date = new Date(Date.now() + offset * 86_400_000);
  const dateValue = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Dubai", weekday: "short" }).format(date);
  const display = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Dubai", month: "short", day: "numeric" }).format(date);
  return { value: dateValue, weekday, display };
}

function DemoScheduler({ onClose, initialProduct }: { onClose: () => void; initialProduct?: "Kiosk" | "Seer" }) {
  const dates = useMemo(() => Array.from({ length: 16 }, (_, index) => dubaiDate(index + 1)).filter((date) => !["Fri", "Sat"].includes(date.weekday)).slice(0, 7), []);
  const slots = ["09:30", "11:00", "12:30", "14:00", "15:30", "17:00"];
  const [step, setStep] = useState(1);
  const [date, setDate] = useState(dates[0]?.value || "");
  const [time, setTime] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [confirmationSent, setConfirmationSent] = useState(false);
  const initialPriority = initialProduct === "Kiosk" ? "Kiosk — physical customer service" : initialProduct === "Seer" ? "Seer — real-world intelligence" : "";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setStatus("sending");
    setMessage("");
    try {
      const response = await fetch("/api/demos", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: data.get("name"), email: data.get("email"), company: data.get("company"), phone: data.get("phone"),
          language: "English", useCase: data.get("useCase"), notes: data.get("notes"), date, time,
        }),
      });
      const result = await response.json() as { error?: string; bookingId?: string; emailSent?: boolean };
      if (!response.ok) throw new Error(result.error || "Unable to book your session");
      setStatus("success");
      setMessage(result.bookingId || "");
      setConfirmationSent(Boolean(result.emailSent));
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Please try again.");
    }
  }

  const selectedDate = dates.find((item) => item.value === date);
  return (
    <DialogShell label="Book a Rolefield demo" onClose={onClose} wide>
      <div className={styles.schedulerRail}>
        <span className={styles.modalEyebrow}>Executive working session</span>
        <h2>{initialProduct ? <>See {initialProduct}<br />in action.</> : <>See where real-world AI creates return first.</>}</h2>
        <p>A focused 30-minute session around your operating model—not a generic product tour.</p>
        <ul><li><b>01</b> Find the highest-value workflow</li><li><b>02</b> Model cost, capacity and ROI</li><li><b>03</b> Map a responsible path to scale</li></ul>
        <div><strong>30 minutes</strong><span>Video call · Gulf Standard Time</span></div>
      </div>
      <div className={styles.schedulerBody}>
        {status === "success" ? (
          <div className={styles.bookingSuccess}><span>Confirmed</span><h2>Your working session is booked.</h2><p>{selectedDate?.weekday}, {selectedDate?.display} at {time} GST</p><small>Reference {message}. {confirmationSent ? "A confirmation has been sent to your email." : "Our team has your booking details."}</small><button type="button" onClick={onClose}>Done</button></div>
        ) : step === 1 ? (
          <>
            <div className={styles.schedulerHead}><span>1 of 2</span><h3>Choose a time</h3><p>All times are shown in Gulf Standard Time (UTC+4).</p></div>
            <div className={styles.dateGrid}>{dates.map((item) => <button key={item.value} type="button" aria-pressed={date === item.value} onClick={() => { setDate(item.value); setTime(""); }}><span>{item.weekday}</span><b>{item.display}</b></button>)}</div>
            <div className={styles.slotGrid}>{slots.map((slot) => <button key={slot} type="button" aria-pressed={time === slot} onClick={() => setTime(slot)}>{slot}</button>)}</div>
            <button className={styles.schedulerNext} type="button" disabled={!time} onClick={() => setStep(2)}>Continue <span aria-hidden="true">→</span></button>
          </>
        ) : (
          <form className={styles.bookingForm} onSubmit={submit}>
            <div className={styles.schedulerHead}><button type="button" onClick={() => setStep(1)}>← Back</button><span>2 of 2</span><h3>Tell us where to focus</h3><p>{selectedDate?.weekday}, {selectedDate?.display} · {time} GST</p></div>
            <div className={styles.fieldPair}><label>Full name<input name="name" autoComplete="name" required /></label><label>Work email<input name="email" type="email" autoComplete="email" required /></label></div>
            <div className={styles.fieldPair}><label>Company<input name="company" autoComplete="organization" required /></label><label>Phone<input name="phone" type="tel" autoComplete="tel" required /></label></div>
            <label>Priority<select name="useCase" required defaultValue={initialPriority}><option value="" disabled>Select a focus</option><option>CX Bridge — customer conversations</option><option>Kiosk — physical customer service</option><option>Seer — real-world intelligence</option><option>Enterprise AI strategy</option></select></label>
            <label>What should we understand before the call?<textarea name="notes" rows={3} placeholder="Your workflow, scale or target outcome" /></label>
            {status === "error" && <p className={styles.formError} role="alert">{message}</p>}
            <button className={styles.schedulerNext} disabled={status === "sending"}>{status === "sending" ? "Confirming…" : "Confirm meeting"}</button>
          </form>
        )}
      </div>
    </DialogShell>
  );
}

export function ConversionLayer() {
  const [demoOpen, setDemoOpen] = useState(false);
  const [demoProduct, setDemoProduct] = useState<"Kiosk" | "Seer" | undefined>();
  useEffect(() => {
    const open = (event?: Event) => {
      const product = (event as CustomEvent<{ product?: "Kiosk" | "Seer" }> | undefined)?.detail?.product;
      setDemoProduct(product);
      setDemoOpen(true);
    };
    window.addEventListener(DEMO_EVENT, open);
    const queryTimer = new URLSearchParams(window.location.search).get("demo") === "1" ? window.setTimeout(open, 0) : undefined;
    return () => {
      window.removeEventListener(DEMO_EVENT, open);
      if (queryTimer) window.clearTimeout(queryTimer);
    };
  }, []);
  return <><SessionEmailCapture />{demoOpen && <DemoScheduler initialProduct={demoProduct} onClose={() => setDemoOpen(false)} />}</>;
}
