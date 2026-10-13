"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import styles from "@/app/homepage.module.css";

const scenes = [
  {
    label: "Scene 01 / Voice",
    title: "Resolve more. Escalate less.",
    copy: "Routine demand is automated. Exceptions reach people with the full context intact.",
    src: "/rolefield-home/cx-bridge.jpg",
    alt: "CX Bridge enterprise agent workspace",
  },
  {
    label: "Scene 02 / Place",
    title: "Serve every visitor well.",
    copy: "Always-on guidance extends your best service model across every location.",
    src: "/rolefield-home/kiosk.jpg",
    alt: "Customer using an AI-led Rolefield Kiosk",
  },
  {
    label: "Scene 03 / World",
    title: "Act while the moment matters.",
    copy: "Live signals become earlier, more relevant decisions and action.",
    src: "/rolefield-home/seer.jpg",
    alt: "Seer interpreting activity in a live public environment",
  },
];

export function RolefieldFilm() {
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      setActive((current) => {
        if (current === scenes.length - 1) {
          setPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, 2900);
    return () => window.clearInterval(timer);
  }, [playing]);

  return (
    <div>
      <div className={styles.filmStage} aria-live="polite">
        {scenes.map((scene, index) => (
          <article className={`${styles.filmScene} ${active === index ? styles.active : ""}`} key={scene.title} aria-hidden={active !== index}>
            <div className={styles.filmFrame}>
              <Image
                src={scene.src}
                alt={scene.alt}
                fill
                quality={90}
                sizes="(max-width: 520px) calc(100vw - 80px), (max-width: 820px) calc(100vw - 100px), 780px"
              />
            </div>
            <div className={styles.filmCaption}>
              <div><span className={styles.mono}>{scene.label}</span><strong>{scene.title}</strong></div>
              <p>{scene.copy}</p>
            </div>
          </article>
        ))}
      </div>
      <div className={styles.filmControls}>
        <button type="button" className={styles.play} aria-pressed={playing} onClick={() => { if (!playing && active === scenes.length - 1) setActive(0); setPlaying((value) => !value); }}>
          <span aria-hidden="true">{playing ? "Ⅱ" : "▶"}</span> {playing ? "Pause film" : "Play the Rolefield film"}
        </button>
        <div className={styles.filmProgress} aria-hidden="true"><span style={{ width: `${((active + 1) / scenes.length) * 100}%` }} /></div>
        <div className={styles.sceneTabs} aria-label="Film scenes">
          {scenes.map((scene, index) => <button type="button" key={scene.title} aria-pressed={active === index} onClick={() => { setPlaying(false); setActive(index); }}>{String(index + 1).padStart(2, "0")}</button>)}
        </div>
      </div>
    </div>
  );
}
