"use client";

import Image from "next/image";
import { CSSProperties, PointerEvent, useRef } from "react";
import styles from "@/app/homepage.module.css";

type HeroStyle = CSSProperties & { "--mx": string; "--my": string };

export function RolefieldHero() {
  const heroRef = useRef<HTMLElement>(null);

  function trackPointer(event: PointerEvent<HTMLElement>) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--mx", `${((event.clientX - bounds.left) / bounds.width) * 100}%`);
    event.currentTarget.style.setProperty("--my", `${((event.clientY - bounds.top) / bounds.height) * 100}%`);
  }

  return (
    <section
      ref={heroRef}
      className={styles.hero}
      id="top"
      onPointerMove={trackPointer}
      style={{ "--mx": "74%", "--my": "24%" } as HeroStyle}
    >
      <div className={styles.heroMedia}>
        <Image
          src="/rolefield-home/seer.jpg"
          alt="People moving through a customer environment supported by real-time intelligence"
          fill
          priority
          sizes="100vw"
        />
      </div>
      <div className={styles.heroSignal} aria-hidden="true" />
      <div className={styles.heroContent}>
        <div>
          <p className={`${styles.kicker} ${styles.mono}`}>Enterprise AI / Measured in outcomes</p>
          <h1>Lower the cost.<span>Raise the standard.</span></h1>
          <p className={styles.heroCopy}>Rolefield puts AI to work across calls, customer-facing spaces and live environments—so you can serve more people, resolve work faster and grow without matching every gain with more headcount.</p>
        </div>
        <aside className={styles.heroProof} aria-label="Operating scale">
          <strong>15M</strong>
          <span>customer conversations handled every month.</span>
        </aside>
      </div>
    </section>
  );
}
