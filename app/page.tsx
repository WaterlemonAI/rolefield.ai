import Image from "next/image";
import Link from "next/link";
import { OperatingFlow } from "@/components/operating-flow";
import { RolefieldFilm } from "@/components/rolefield-film";
import { RolefieldHero } from "@/components/rolefield-hero";
import { ConversionLayer, DemoTrigger } from "@/components/conversion-layer";
import styles from "./homepage.module.css";

const products = [
  {
    number: "01", name: "CX Bridge", field: "Voice",
    title: <>Make every service team<br />more productive.</>,
    copy: "CX Bridge handles routine conversations and carries the complete context into human support when judgment is needed.",
    points: ["Reduce avoidable agent workload", "Shorten resolution and handoff time", "Measure quality, cost and outcomes"],
    image: "/rolefield-home/cx-bridge.jpg", alt: "CX Bridge contextual customer operations interface", label: "Enterprise operations / Voice",
  },
  {
    number: "02", name: "Kiosk", field: "Place",
    title: <>Put your best service model<br />in every location.</>,
    copy: "Kiosk gives customers immediate, personalized guidance without expanding every front desk or service counter.",
    points: ["Extend service without equivalent staffing growth", "Guide customers to the right product faster", "Build continuity across repeat visits"],
    image: "/rolefield-home/kiosk.jpg", alt: "Customer receiving personalized assistance from a Rolefield Kiosk", label: "Agentic assistance / In place",
  },
  {
    number: "03", name: "Seer", field: "World",
    title: <>Turn real-world signals<br />into earlier action.</>,
    copy: "Seer gives agentic AI live context—helping enterprises identify needs, initiate relevant engagement and respond sooner.",
    points: ["See demand and opportunity sooner", "Initiate timely, contextual engagement", "Keep consent, control and governance visible"],
    image: "/rolefield-home/seer.jpg", alt: "Seer interpreting a live public environment", label: "Real-world intelligence / Privacy-forward",
  },
];

export default function Home() {
  return (
    <div className={styles.site}>
      <header className={styles.nav}>
        <Link className={styles.brand} href="#top" aria-label="Rolefield home">
          <Image src="/rolefield-logo.png" alt="Rolefield.ai" width={1527} height={406} priority />
        </Link>
        <nav aria-label="Primary navigation">
          <Link href="#products">Products</Link>
          <Link href="#film">How it works</Link>
          <Link href="#technology">Technology</Link>
          <Link href="#enterprise">Enterprise</Link>
          <Link href="#about">About</Link>
        </nav>
        <DemoTrigger className={styles.navAction}>Book a demo <span aria-hidden="true">↗</span></DemoTrigger>
      </header>

      <main>
        <RolefieldHero />

        <section className={styles.film} id="film">
          <div className={styles.sectionHead}>
            <h2>See the operating<br />advantage.</h2>
            <p>Three moments. One principle: let AI carry the routine work, preserve context and bring people in where judgment matters.</p>
          </div>
          <RolefieldFilm />
        </section>

        <section className={styles.products} id="products">
          <div className={styles.productsIntro}>
            <h2>Three products.<br />One business case.</h2>
            <p>Lower the cost to serve, protect the customer experience and create operating leverage across more of the real world.</p>
          </div>
          {products.map((product, index) => (
            <article className={styles.chapter} key={product.name}>
              <div className={styles.chapterCopy}>
                <span className={`${styles.kicker} ${styles.mono}`}>{product.number} / {product.name} / {product.field}</span>
                <h3>{product.title}</h3>
                <p>{product.copy}</p>
                <div className={styles.chapterPoints}>{product.points.map((point) => <span key={point}><i />{point}</span>)}</div>
                <div className={styles.chapterAction}>
                  {product.name === "CX Bridge" ? (
                    <a href="https://app.cxbridge.io" target="_blank" rel="noopener noreferrer">Sign in to CX Bridge <span aria-hidden="true">↗</span></a>
                  ) : (
                    <DemoTrigger product={product.name as "Kiosk" | "Seer"}>See it in action <span aria-hidden="true">→</span></DemoTrigger>
                  )}
                </div>
              </div>
              <div className={`${styles.chapterMedia} ${index === 0 ? styles.productUi : ""}`}>
                <Image src={product.image} alt={product.alt} fill sizes="(max-width: 820px) 100vw, 58vw" />
                {index > 0 && <div className={styles.scan} aria-hidden="true" />}
                <span className={`${styles.mediaLabel} ${styles.mono}`}>{product.label}</span>
              </div>
            </article>
          ))}
        </section>

        <section className={styles.intelligence} id="technology">
          <div className={styles.intelligenceHead}>
            <h2>One operating layer.<br />More return from every channel.</h2>
            <p>Rolefield connects context, memory and action across voice, physical spaces and live environments—without rebuilding the operating model each time.</p>
          </div>
          <OperatingFlow />
        </section>

        <section className={styles.proof} id="enterprise">
          <div className={styles.proofHead}>
            <h2>Serve more people.<br />Grow without growing costs.</h2>
            <p>Rolefield already supports millions of customer conversations every month. The same proven foundation now helps teams deliver better service across calls, physical spaces and live environments.</p>
          </div>
          <div className={styles.proofStage}>
            <div className={styles.proofNumber}><span className={styles.mono}>Operating scale / Today</span><strong>15M</strong><p>customer conversations every month</p></div>
            <div className={styles.proofStory}>
              <article><span className={styles.mono}>Save</span><div><b>Lower cost to serve</b><p>Automate repeatable demand and reserve people for higher-value work.</p></div></article>
              <article><span className={styles.mono}>Grow</span><div><b>Create operating leverage</b><p>Expand service capacity without expanding cost at the same rate.</p></div></article>
              <article><span className={styles.mono}>Lead</span><div><b>Build the next advantage</b><p>Move from AI experiments to real-world capability competitors must catch up to.</p></div></article>
            </div>
          </div>
        </section>

        <section className={styles.about} id="about">
          <div className={styles.aboutMark}>
            <Image src="/ai7lab-logo.png" alt="AI7Lab" width={607} height={318} sizes="(max-width: 520px) 68vw, (max-width: 820px) 34vw, 300px" />
            <i aria-hidden="true" />
          </div>
          <div className={styles.aboutCopy}>
            <span className={`${styles.kicker} ${styles.mono}`}>About / Rolefield × AI7Lab</span>
            <h2>Built to move AI<br />into the real world.</h2>
            <p>Rolefield is a product of <strong>AI7Lab Tech Evolution Pte. Ltd.</strong>, the parent company building the research, infrastructure and engineering capability behind production AI.</p>
            <p>Together, we connect intelligence with real environments—so enterprises can move from isolated AI experiments to systems they can operate, govern and scale.</p>
            <div className={styles.aboutActions}>
              <Link href="/about">About Rolefield <span aria-hidden="true">→</span></Link>
              <a href="https://www.ai7lab.net" target="_blank" rel="noopener noreferrer">Explore AI7Lab <span aria-hidden="true">↗</span></a>
            </div>
          </div>
          <div className={styles.aboutSystem}>
            <span className={styles.mono}>Parent capability / Applied product</span>
            <article><b>Research</b><i />Conversational and real-world intelligence</article>
            <article><b>Engineering</b><i />Enterprise systems and deployment</article>
            <article><b>Control</b><i />Security, governance and operations</article>
            <article><b>Rolefield</b><i />AI working across voice, place and world</article>
          </div>
        </section>

        <section className={styles.close}>
          <div><h2>Lead the shift.<br />Capture the return.</h2><p>Start with a high-cost workflow, prove the economics and expand from a position of strength.</p></div>
          <div className={styles.closeActions}><DemoTrigger>Book a working session <span aria-hidden="true">↗</span></DemoTrigger><Link href="/roi-calculator">Calculate ROI</Link></div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div><Image src="/rolefield-logo.png" alt="Rolefield.ai" width={1527} height={406} /><p>Enterprise AI for conversations, physical service and the live world.</p><a href="https://www.ai7lab.net" target="_blank" rel="noopener noreferrer">A product of AI7Lab Tech Evolution Pte. Ltd. ↗</a></div>
        <div><span className={styles.mono}>Dubai, UAE</span><a href="mailto:voice@ai7lab.net">voice@ai7lab.net</a></div>
        <div><Link href="/about">About</Link><Link href="/partnerships">Partnerships</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link></div>
      </footer>
      <ConversionLayer />
    </div>
  );
}
