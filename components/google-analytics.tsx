"use client";

import { useEffect, useState } from "react";

declare global { interface Window { dataLayer: unknown[]; gtag?: (...args: unknown[]) => void } }
const consentKey = "rolefield-analytics-consent";

export function AnalyticsConsent() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(!window.localStorage.getItem(consentKey)), 0);
    return () => window.clearTimeout(timer);
  }, []);
  function choose(value: "granted" | "denied") {
    window.localStorage.setItem(consentKey, value);
    window.gtag?.("consent", "update", { analytics_storage: value });
    setVisible(false);
  }
  if (!visible) return null;
  return <aside className="analytics-consent" aria-label="Analytics preferences"><div><b>Help us improve RoleField</b><p>We use Google Analytics to understand website usage. You can accept or decline analytics cookies. See our <a href="/privacy">Privacy Notice</a>.</p></div><div><button className="button light compact" onClick={() => choose("denied")}>Decline</button><button className="button teal compact" onClick={() => choose("granted")}>Accept analytics</button></div></aside>;
}
