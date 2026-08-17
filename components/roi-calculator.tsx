"use client";

import { useMemo, useState } from "react";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const aed = new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED", maximumFractionDigits: 0 });
const number = new Intl.NumberFormat("en-US");

function Input({ label, value, onChange, min = 0, step = 1, prefix, suffix, help }: { label: string; value: number; onChange: (value: number) => void; min?: number; step?: number; prefix?: string; suffix?: string; help?: string }) {
  return <label className="roi-input"><span>{label}</span><div>{prefix && <b>{prefix}</b>}<input type="number" value={value} min={min} step={step} onChange={(event) => onChange(Math.max(min, Number(event.target.value) || 0))} />{suffix && <b>{suffix}</b>}</div>{help && <small>{help}</small>}</label>;
}

export function RoiCalculator() {
  const [minutes, setMinutes] = useState(50000);
  const [workflows, setWorkflows] = useState(1);

  const result = useMemo(() => {
    const billableMinutes = Math.max(minutes, 10000);
    const rolefieldUsage = billableMinutes * .10;
    const setup = workflows * 3000;
    const rolefield = rolefieldUsage + setup;
    const workingDays = 5 * 52;
    const dailyCallMinutes = 80;
    const minutesPerCaller = dailyCallMinutes * workingDays;
    const telecallers = Math.max(1, Math.ceil(minutes / minutesPerCaller));
    const annualSalaryAed = telecallers * 10000 * 12;
    const human = annualSalaryAed / 3.6725;
    const lowHeadcount = Math.max(1, Math.ceil(minutes / (100 * workingDays)));
    const highHeadcount = Math.max(1, Math.ceil(minutes / (60 * workingDays)));
    const competitorBenchmark = rolefield / .70;
    const humanSavings = human - rolefield;
    const roi = rolefield > 0 ? humanSavings / rolefield * 100 : 0;
    return { billableMinutes, rolefieldUsage, setup, rolefield, human, competitorBenchmark, humanSavings, roi, telecallers, annualSalaryAed, lowHeadcount, highHeadcount };
  }, [minutes, workflows]);

  const options = [
    { name: "RoleField", detail: "$0.10/min + workflow setup", cost: result.rolefield, featured: true },
    { name: "Human-led", detail: `${result.telecallers} UAE telecaller${result.telecallers === 1 ? "" : "s"} at AED 10,000/month`, cost: result.human },
    { name: "Well-known competitors", detail: "Illustrative market benchmark", cost: result.competitorBenchmark },
  ];
  const maxCost = Math.max(...options.map((item) => item.cost), 1);

  return <div className="roi-tool">
    <section className="roi-controls" aria-label="ROI assumptions">
      <div className="roi-control-group"><div><small>01</small><h2>Your RoleField plan</h2></div><Input label="Annual conversation minutes" value={minutes} min={10000} step={1000} onChange={setMinutes} suffix="min" help="Minimum commitment: 10,000 minutes. Your minutes can be shared across every workflow and used within one year." /><Input label="Number of workflows" value={workflows} min={1} step={1} onChange={(value) => setWorkflows(Math.max(1, Math.floor(value)))} help="$3,000 one-time setup for each workflow." /></div>
      <div className="roi-control-group"><div><small>02</small><h2>UAE human benchmark</h2></div><div className="roi-human-model"><div><span>MONTHLY SALARY</span><b>AED 10,000</b><small>per telecaller</small></div><div><span>CALL TIME</span><b>60–100 min</b><small>per working day</small></div><div><span>WORKING WEEK</span><b>5 days</b><small>52 weeks/year</small></div><p>Your volume requires approximately <strong>{result.lowHeadcount}–{result.highHeadcount} telecallers</strong>. The estimate uses {result.telecallers} at the 80-minute midpoint.</p></div></div>
      <div className="roi-control-group roi-benchmark"><div><small>03</small><h2>Market advantage</h2></div><div className="roi-benchmark-stat"><b>30%</b><span>cheaper than well-known competitors</span></div><div className="roi-benchmark-stat"><b>50%</b><span>faster response time than well-known competitors</span></div>
      </div>
    </section>

    <section className="roi-results" aria-live="polite">
      <div className="roi-result-heading"><div><p className="eyebrow"><i /> ANNUAL ESTIMATE</p><h2>Your cost comparison</h2></div><div className="roi-volume"><small>ANNUAL USAGE</small><b>{number.format(minutes)} minutes</b><span>{result.billableMinutes === minutes ? "All minutes used" : `${number.format(result.billableMinutes - minutes)} committed minutes remain`}</span></div></div>
      <div className="roi-kpis"><article><small>ESTIMATED ROLEFIELD COST</small><b>{money.format(result.rolefield)}</b><span>{money.format(result.rolefieldUsage)} usage + {money.format(result.setup)} workflow setup</span></article><article className={result.humanSavings >= 0 ? "positive" : "negative"}><small>SAVINGS VS HUMAN-LED</small><b>{money.format(result.humanSavings)}</b><span>{result.telecallers} telecaller{result.telecallers === 1 ? "" : "s"} · {aed.format(result.annualSalaryAed)}/year</span></article><article><small>ROI VS HUMAN-LED</small><b>{result.roi.toFixed(0)}%</b><span>Plus 24/7 availability and instant response</span></article></div>
      <div className="roi-bars">{options.map((item) => <article key={item.name} className={item.featured ? "featured" : ""}><div><b>{item.name}</b><span>{item.detail}</span></div><div className="roi-track"><i style={{ width: `${Math.max(item.cost / maxCost * 100, 2)}%` }} /></div><strong>{money.format(item.cost)}</strong></article>)}</div>
      <div className="roi-table-wrap"><table><caption>Detailed annual estimate</caption><thead><tr><th>Operating model</th><th>Annual cost</th><th>Effective cost/min</th><th>Difference vs RoleField</th></tr></thead><tbody>{options.map((item) => <tr key={item.name} className={item.featured ? "featured" : ""}><th>{item.name}</th><td>{money.format(item.cost)}</td><td>${(item.cost / minutes).toFixed(2)}</td><td>{item.featured ? "—" : money.format(item.cost - result.rolefield)}</td></tr>)}</tbody></table></div>
    </section>

    <section className="roi-notes"><h2>What this estimate includes—and what it does not.</h2><div><p><b>RoleField.</b> Uses the higher of actual annual minutes or the 10,000-minute commitment at $0.10/minute, plus a fixed $3,000 setup per workflow. Purchased minutes are shared across workflows and remain usable for one year.</p><p><b>Human-led.</b> Assumes AED 10,000 monthly salary per UAE telecaller, five working days per week and 80 customer-call minutes per day—the midpoint of the typical 60–100 minute range. Headcount is rounded up because a business cannot employ a fraction of a telecaller. Recruitment, benefits, management, leave, tools and office costs are not included, making this a conservative human-cost estimate.</p><p><b>Market benchmark.</b> The comparison illustrates RoleField at 30% lower total estimated cost and 50% faster response time than well-known competitors. Integrations and support vary by workflow, so our experts will prepare the right estimate for your company.</p></div></section>
  </div>;
}
