"use client";

import { FormEvent, useMemo, useState } from "react";

type Locale = "en" | "ar";

const countries = [
  ["UAE", "Arabic · English · Hindi · Urdu"],
  ["KSA", "Arabic · English"],
  ["Qatar", "Arabic · English"],
  ["Oman", "Arabic · English · Hindi"],
  ["Kuwait", "Arabic · English"],
  ["Bahrain", "Arabic · English"],
];

const useCases = [
  { n: "01", tag: "BANKING & FINTECH", title: "Collections that protect the relationship.", copy: "Natural reminders, promise-to-pay capture and compliant escalation in Arabic and English.", metric: "34%", label: "more promises captured" },
  { n: "02", tag: "HEALTHCARE", title: "Every patient gets an answer.", copy: "Bookings, confirmations and follow-ups that understand Gulf accents and switch languages naturally.", metric: "24/7", label: "patient access" },
  { n: "03", tag: "LOGISTICS", title: "Last-mile conversations, resolved.", copy: "Address confirmation, delivery coordination and exception handling across the GCC.", metric: "41%", label: "fewer failed drops" },
  { n: "04", tag: "HOSPITALITY", title: "Service that sounds local.", copy: "Reservations, guest requests and multilingual concierge support with brand-safe responses.", metric: "6", label: "GCC markets ready" },
];

const dates = Array.from({ length: 16 }, (_, i) => {
  const date = new Date();
  date.setDate(date.getDate() + i + 1);
  return date;
}).filter((date) => ![5, 6].includes(date.getDay())).slice(0, 8);

const slots = ["10:00", "10:30", "11:00", "11:30", "14:00", "14:30", "15:00", "15:30", "16:00"];

export default function Home() {
  const [locale, setLocale] = useState<Locale>("en");
  const [scheduler, setScheduler] = useState(false);
  const [step, setStep] = useState(1);
  const [selectedDate, setSelectedDate] = useState(dates[0]);
  const [selectedTime, setSelectedTime] = useState("10:00");
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">("idle");

  const dateKey = useMemo(() => selectedDate.toISOString().slice(0, 10), [selectedDate]);

  function openScheduler() {
    setScheduler(true);
    setStep(1);
    setStatus("idle");
  }

  async function submitDemo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("saving");
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());
    try {
      const response = await fetch("/api/demos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, date: dateKey, time: selectedTime }),
      });
      if (!response.ok) throw new Error("Booking failed");
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }

  return (
    <main dir={locale === "ar" ? "rtl" : "ltr"}>
      <header className="nav-shell">
        <a className="brand" href="#top" aria-label="RoleField home"><span className="brand-mark"><i /><i /><i /></span>RoleField</a>
        <nav aria-label="Primary navigation">
          <a href="#platform">Platform</a><a href="#use-cases">Use cases</a><a href="#languages">Languages</a><a href="#security">Security</a>
        </nav>
        <div className="nav-actions">
          <button className="locale" onClick={() => setLocale(locale === "en" ? "ar" : "en")} aria-label="Switch language">{locale === "en" ? "العربية" : "English"}</button>
          <button className="primary small" onClick={openScheduler}>Book a demo <span>↗</span></button>
        </div>
      </header>

      <section className="hero grid-bg" id="top">
        <div className="hero-copy">
          <p className="eyebrow"><span /> {locale === "en" ? "ENTERPRISE VOICE AI, BUILT FOR THE GCC" : "ذكاء صوتي للمؤسسات، مصمم للخليج"}</p>
          <h1>{locale === "en" ? <>Scale conversations.<em>Not headcount.</em></> : <>وسّع محادثاتك.<em>وليس فريقك.</em></>}</h1>
          <p className="lede">{locale === "en" ? "Human-like voice agents that resolve customer conversations across the GCC—deployed in-region, connected to your systems and measured against real business outcomes." : "وكلاء صوتيون بتجربة بشرية يديرون محادثات العملاء في دول الخليج، باستضافة إقليمية وتكامل مباشر مع أنظمتك ونتائج أعمال قابلة للقياس."}</p>
          <div className="hero-actions"><button className="primary" onClick={openScheduler}>Book your GCC demo</button><a href="#platform">Hear RoleField <span>↓</span></a></div>
          <p className="trust-line"><span /> CUSTOMER DATA STAYS IN THE REGION</p>
        </div>
        <div className="voice-orbit" aria-label="Live RoleField call interface">
          <div className="orbit orbit-a" /><div className="orbit orbit-b" />
          <div className="region-tag tag-one"><small>UAE</small><b>العربية</b></div>
          <div className="region-tag tag-two"><small>KSA</small><b>Khaleeji Arabic</b></div>
          <div className="region-tag tag-three"><small>QATAR</small><b>English</b></div>
          <div className="call-card">
            <div className="call-head"><span><i /> LIVE CUSTOMER CALL</span><b>00:42</b></div>
            <div className="wave">{[18,32,48,25,62,38,70,28,55,34,49,24,42,20].map((h,i)=><i key={i} style={{height:h}} />)}</div>
            <div className="detected"><small>LANGUAGE DETECTED</small><strong>العربية</strong><span>Gulf dialect · Context retained</span></div>
            <div className="outcome"><small>OUTCOME</small><b>Appointment confirmed</b><span>CRM updated ✓</span></div>
          </div>
          <p className="orbit-caption">ONE ENGINE. EVERY GCC VOICE.</p>
        </div>
      </section>

      <section className="proof-strip"><span>BUILT FOR REGIONAL OPERATIONS</span><b>Arabic-native</b><b>In-region deployment</b><b>Enterprise integrations</b><b>Human escalation</b></section>

      <section className="section intro" id="platform">
        <div><p className="eyebrow"><span /> THE ROLEFIELD PLATFORM</p><h2>Conversations that move<br/><em>business forward.</em></h2></div>
        <div><p>RoleField voice agents listen, reason and act across the customer journey—without forcing your customers through menus, scripts or awkward handoffs.</p><div className="stats"><div><b>&lt;500ms</b><span>response latency</span></div><div><b>99.9%</b><span>platform availability</span></div><div><b>24/7</b><span>multilingual coverage</span></div></div></div>
      </section>

      <section className="workflow-section grid-bg">
        <div className="workflow-ui">
          <div className="workflow-top"><span>LIVE OPERATIONS</span><b>RoleField Control Room</b><i>● 12 agents online</i></div>
          <div className="workflow-body">
            <aside><b>Overview</b><span>Live calls</span><span>Agent library</span><span>Knowledge</span><span>Analytics</span><span>Integrations</span></aside>
            <div className="dashboard"><div className="dash-head"><div><small>ACTIVE CONVERSATIONS</small><strong>148</strong><em>↑ 18% today</em></div><div className="mini-chart">{[38,62,45,74,55,82,68,91,78,96,72,88].map((h,i)=><i key={i} style={{height:h+"%"}} />)}</div></div><div className="calls"><span><i className="live"/>Fatima A. <small>Arabic · Billing</small><b>02:18</b></span><span><i className="live"/>Ahmed K. <small>English · Booking</small><b>01:44</b></span><span><i/>Priya S. <small>Hindi · Delivery</small><b>Resolved</b></span></div></div>
          </div>
        </div>
        <div className="workflow-copy"><p className="eyebrow"><span /> FROM HELLO TO RESOLUTION</p><h2>Not a chatbot<br/>with a voice.</h2><p>RoleField understands intent, retrieves context, completes actions and knows when to bring in your team.</p><ol><li><b>01</b><span><strong>Listen naturally</strong>Interruptions, accents and code-switching included.</span></li><li><b>02</b><span><strong>Act in your systems</strong>CRM, booking, payment and support workflows.</span></li><li><b>03</b><span><strong>Improve continuously</strong>Every outcome is measured and reviewable.</span></li></ol></div>
      </section>

      <section className="section use-cases" id="use-cases">
        <div className="section-head"><div><p className="eyebrow"><span /> GCC USE CASES</p><h2>Built around the calls<br/><em>your teams handle every day.</em></h2></div><p>Deploy one focused workflow or orchestrate the entire customer journey.</p></div>
        <div className="case-grid">{useCases.map((item)=><article key={item.n}><div className="case-top"><span>{item.n}</span><small>{item.tag}</small></div><h3>{item.title}</h3><p>{item.copy}</p><div className="metric"><b>{item.metric}</b><span>{item.label}</span></div></article>)}</div>
      </section>

      <section className="region-stories" aria-label="RoleField in the GCC">
        <figure className="region-photo team-photo"><figcaption><span>01 / UAE OPERATIONS</span><b>Designed with regional teams,<br/>for regional conversations.</b><small>Photo: Kristina Spremo / Unsplash</small></figcaption></figure>
        <figure className="region-photo city-photo"><figcaption><span>02 / BUILT IN THE UAE</span><b>One platform for the<br/>GCC’s connected economy.</b><small>Photo: Kate Trysh / Unsplash</small></figcaption></figure>
      </section>

      <section className="language-section" id="languages">
        <div className="language-copy"><p className="eyebrow light"><span /> LANGUAGE INTELLIGENCE</p><h2>Arabic first.<br/><em>Multilingual by design.</em></h2><p>RoleField handles Modern Standard Arabic, Gulf dialects and the languages your customers switch between—within the same call.</p><div className="quote-ar">“أهلاً وسهلاً، كيف أقدر أساعدك اليوم؟”<small>Natural Gulf Arabic · Brand vocabulary retained</small></div></div>
        <div className="country-list">{countries.map(([country,languages],i)=><div key={country}><span>0{i+1}</span><b>{country}</b><p>{languages}</p><i>↗</i></div>)}</div>
      </section>

      <section className="section security" id="security"><div><p className="eyebrow"><span /> ENTERPRISE CONTROL</p><h2>Regional by design.<br/><em>Secure by default.</em></h2><p>Choose UAE or KSA data residency, control every integration, and keep a complete audit trail of what your agents heard, decided and did.</p><button className="outline" onClick={openScheduler}>Discuss your requirements ↗</button></div><div className="security-grid"><article><span>01</span><b>In-region deployment</b><p>UAE and Saudi hosting options for customer data and recordings.</p></article><article><span>02</span><b>Private integrations</b><p>Least-privilege access to your CRM, telephony and core systems.</p></article><article><span>03</span><b>Human-in-control</b><p>Clear escalation rules, approval paths and full conversation review.</p></article><article><span>04</span><b>Measurable governance</b><p>Outcome analytics, quality scoring and auditable action logs.</p></article></div></section>

      <section className="cta grid-bg"><p className="eyebrow"><span /> SEE IT IN YOUR WORKFLOW</p><h2>Bring us one call.<br/><em>We’ll show you the agent.</em></h2><p>Book a 30-minute working session with our UAE team. Choose your language, use case and time.</p><button className="primary" onClick={openScheduler}>Schedule your demo ↗</button></section>

      <footer><div className="footer-brand"><a className="brand" href="#top"><span className="brand-mark"><i/><i/><i/></span>RoleField</a><p>Enterprise voice agents for the GCC.<br/>A company by AI7Lab, UAE.</p></div><div><small>EXPLORE</small><a href="#platform">Platform</a><a href="#use-cases">Use cases</a><a href="#languages">Languages</a></div><div><small>COMPANY</small><a href="mailto:hello@rolefield.ai">hello@rolefield.ai</a><button onClick={openScheduler}>Book a demo</button></div><div><small>REGION</small><p>Dubai, United Arab Emirates<br/>Serving the GCC</p></div><p className="copyright">© {new Date().getFullYear()} RoleField · A company by AI7Lab, UAE</p></footer>

      {scheduler && <div className="modal-backdrop" role="presentation" onMouseDown={(e)=>e.target===e.currentTarget&&setScheduler(false)}><div className="scheduler" role="dialog" aria-modal="true" aria-labelledby="schedule-title"><button className="close" onClick={()=>setScheduler(false)} aria-label="Close">×</button>{status === "done" ? <div className="success"><span>✓</span><p className="eyebrow">DEMO CONFIRMED</p><h2>You’re booked.</h2><p>We’ve reserved {selectedTime} Gulf time on {selectedDate.toLocaleDateString("en-GB", {weekday:"long",day:"numeric",month:"long"})}. A RoleField specialist will contact you with the meeting details.</p><button className="primary" onClick={()=>setScheduler(false)}>Done</button></div> : <><p className="eyebrow"><span /> BOOK A ROLEFIELD DEMO</p><h2 id="schedule-title">Choose a time for your GCC use case.</h2><p className="modal-lede">30 minutes with our UAE team · English or Arabic</p>{step===1 ? <div className="slot-picker"><label>Select a date</label><div className="dates">{dates.map(date=><button key={date.toISOString()} className={date.toDateString()===selectedDate.toDateString()?"selected":""} onClick={()=>setSelectedDate(date)}><small>{date.toLocaleDateString("en-GB",{weekday:"short"})}</small><b>{date.getDate()}</b><span>{date.toLocaleDateString("en-GB",{month:"short"})}</span></button>)}</div><label>Select a time <small>Gulf Standard Time (UTC+4)</small></label><div className="times">{slots.map(time=><button key={time} className={time===selectedTime?"selected":""} onClick={()=>setSelectedTime(time)}>{time}</button>)}</div><button className="primary continue" onClick={()=>setStep(2)}>Continue <span>→</span></button></div> : <form onSubmit={submitDemo}><button type="button" className="back" onClick={()=>setStep(1)}>← Change time</button><div className="chosen"><b>{selectedDate.toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long"})}</b><span>{selectedTime} GST · 30 minutes</span></div><div className="form-grid"><label>Your name<input name="name" required autoComplete="name" /></label><label>Work email<input name="email" type="email" required autoComplete="email" /></label><label>Company<input name="company" required autoComplete="organization" /></label><label>Phone<input name="phone" type="tel" required autoComplete="tel" placeholder="+971" /></label><label>Preferred language<select name="language"><option>English</option><option>العربية (Arabic)</option><option>Both</option></select></label><label>Primary use case<select name="useCase"><option>Customer service</option><option>Collections</option><option>Booking & scheduling</option><option>Sales qualification</option><option>Delivery & logistics</option><option>Other</option></select></label><label className="full">Other attendees (optional)<input name="attendees" type="text" placeholder="colleague@company.com" /></label><label className="full">What should we demonstrate?<textarea name="notes" rows={3} placeholder="Tell us about the call workflow you want to automate." /></label></div>{status==="error"&&<p className="form-error">We couldn’t save the booking. Please try again.</p>}<button className="primary submit" disabled={status==="saving"}>{status==="saving"?"Confirming…":"Confirm demo"}</button></form>}</>}</div></div>}
    </main>
  );
}
