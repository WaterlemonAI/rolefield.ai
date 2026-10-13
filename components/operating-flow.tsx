"use client";

import { useState } from "react";
import styles from "@/app/homepage.module.css";

type Layer = "voice" | "place" | "world";

const layers = {
  voice: {
    number: "01", name: "Voice", kicker: "Voice / Automate → Resolve → Escalate",
    title: "Lower cost without lowering care.",
    text: "Routine demand is resolved by AI; complex cases reach people with the history and next step intact.",
    inputLabel: "Demand", inputTitle: "Customer request", core: <>Understand<br />and decide</>,
    aLabel: "Resolved", aTitle: "Handled by AI", bLabel: "Exception", bTitle: "Human + full context",
    values: ["Less repetition", "Faster resolution", "People focus on exceptions"],
  },
  place: {
    number: "02", name: "Place", kicker: "Place / Recognize → Guide → Continue",
    title: "More service capacity at every location.",
    text: "Kiosk understands the visitor, guides the immediate decision and preserves useful context for what happens next.",
    inputLabel: "Arrival", inputTitle: "Visitor intent", core: <>Recognize<br />and guide</>,
    aLabel: "Now", aTitle: "Right product or service", bLabel: "Next", bTitle: "Context remembered",
    values: ["Always-on guidance", "Shorter path to value", "Continuity across visits"],
  },
  world: {
    number: "03", name: "World", kicker: "World / Perceive → Decide → Act",
    title: "Act while the moment still matters.",
    text: "Seer interprets live signals, identifies what matters and directs the right response before the opportunity is gone.",
    inputLabel: "Live world", inputTitle: "Signals + context", core: <>Perceive<br />and decide</>,
    aLabel: "Act", aTitle: "Timely engagement", bLabel: "Escalate", bTitle: "Evidence for people",
    values: ["Earlier awareness", "Relevant action", "Human control preserved"],
  },
} satisfies Record<Layer, {
  number: string; name: string; kicker: string; title: string; text: string;
  inputLabel: string; inputTitle: string; core: React.ReactNode; aLabel: string; aTitle: string;
  bLabel: string; bTitle: string; values: string[];
}>;

export function OperatingFlow() {
  const [active, setActive] = useState<Layer>("voice");
  const layer = layers[active];

  return (
    <div className={styles.intelligenceStage}>
      <div className={styles.layerTabs} role="tablist" aria-label="Intelligence surfaces">
        {(Object.keys(layers) as Layer[]).map((key) => (
          <button key={key} type="button" role="tab" aria-selected={active === key} onClick={() => setActive(key)}>
            <span className={styles.mono}>{layers[key].number}</span>{layers[key].name}
          </button>
        ))}
      </div>
      <div className={styles.layerView} role="tabpanel" aria-live="polite">
        <div className={styles.flowHead}>
          <div><span className={`${styles.kicker} ${styles.mono}`}>{layer.kicker}</span><h3>{layer.title}</h3></div>
          <p>{layer.text}</p>
        </div>
        <div className={styles.flowBoard}>
          <svg viewBox="0 0 1000 430" preserveAspectRatio="none" aria-hidden="true">
            <defs><marker id="route-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8 Z" /></marker></defs>
            <path className={`${styles.route} ${styles.routeMain}`} d="M100 215 H400 H600" />
            <path className={`${styles.route} ${styles.routeMain}`} d="M600 215 C680 215 670 120 770 120" />
            <path className={`${styles.route} ${styles.routeHuman}`} markerEnd="url(#route-arrow)" d="M600 215 C680 215 670 310 770 310" />
            <text className={styles.routeLabel} x="630" y="286" textAnchor="end">handoff / full context</text>
            <circle className={styles.token} r="5"><animateMotion dur="3.8s" repeatCount="indefinite" path="M100 215 H400 H600 C680 215 670 120 770 120" /></circle>
            <circle className={styles.token} r="5"><animateMotion begin="1.35s" dur="4.8s" repeatCount="indefinite" path="M100 215 H400 H600 C680 215 670 310 770 310" /></circle>
            <circle className={styles.token} r="3" opacity=".55"><animateMotion begin=".7s" dur="3.8s" repeatCount="indefinite" path="M100 215 H400 H600 C680 215 670 120 770 120" /></circle>
          </svg>
          <FlowNode className={styles.input} label={layer.inputLabel} title={layer.inputTitle} />
          <FlowNode className={styles.core} label="Rolefield" title={layer.core} />
          <FlowNode className={styles.outcomeA} label={layer.aLabel} title={layer.aTitle} status />
          <FlowNode className={styles.outcomeB} label={layer.bLabel} title={layer.bTitle} />
          <div className={styles.flowValue}>{layer.values.map((value) => <span key={value}><i />{value}</span>)}</div>
        </div>
      </div>
    </div>
  );
}

function FlowNode({ className, label, title, status = false }: { className: string; label: string; title: React.ReactNode; status?: boolean }) {
  return <div className={`${styles.flowNode} ${className}`}><div><small className={status ? styles.status : ""}>{label}</small><b>{title}</b></div></div>;
}
