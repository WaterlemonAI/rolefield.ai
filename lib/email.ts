type LeadEmail = {
  type: "demo" | "callback";
  leadId: string;
  name: string;
  email: string;
  company: string;
  phone: string;
  language: string;
  useCase: string;
  notes?: string;
  date?: string;
  time?: string;
  callbackWindow?: string;
};

export async function sendLeadEmails(lead: LeadEmail) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    console.warn("BREVO_API_KEY is not configured; lead saved without email notifications.");
    return { sent: false };
  }

  const senderEmail = process.env.BREVO_SENDER_EMAIL || "hello@mail.rolefield.ai";
  const senderName = process.env.BREVO_SENDER_NAME || "RoleField";
  const notify = process.env.LEAD_NOTIFICATION_EMAIL || "voice@ai7lab.net";
  const replyTo = process.env.REPLY_TO_EMAIL || notify;
  const isDemo = lead.type === "demo";
  const teamTemplateId = Number(isDemo ? process.env.BREVO_DEMO_TEAM_TEMPLATE_ID || 3 : process.env.BREVO_CALLBACK_TEAM_TEMPLATE_ID || 4);
  const customerTemplateId = Number(isDemo ? process.env.BREVO_DEMO_CUSTOMER_TEMPLATE_ID || 1 : process.env.BREVO_CALLBACK_CUSTOMER_TEMPLATE_ID || 2);
  const params = {
    reference: lead.leadId, name: lead.name, email: lead.email, company: lead.company,
    phone: lead.phone, language: lead.language, useCase: lead.useCase,
    notes: lead.notes || "Not provided", date: lead.date || "", time: lead.time || "",
    callbackWindow: lead.callbackWindow || "",
  };

  const send = async (message: Record<string, unknown>) => {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      signal: AbortSignal.timeout(10_000),
      headers: { accept: "application/json", "api-key": apiKey, "content-type": "application/json" },
      body: JSON.stringify({ sender: { email: senderEmail, name: senderName }, ...message }),
    });
    if (!response.ok) throw new Error(`Brevo delivery failed (${response.status}): ${await response.text()}`);
    return response.json() as Promise<{ messageId: string }>;
  };

  await Promise.all([
    send({
      to: [{ email: notify, name: "RoleField leads" }],
      replyTo: { email: lead.email, name: lead.name },
      templateId: teamTemplateId,
      params,
    }),
    send({
      to: [{ email: lead.email, name: lead.name }],
      replyTo: { email: replyTo, name: "RoleField" },
      templateId: customerTemplateId,
      params,
    }),
  ]);
  return { sent: true };
}

type InquiryEmail = {
  kind: "contact" | "partnership";
  inquiryId: string;
  name: string;
  email: string;
  company: string;
  phone?: string;
  topic: string;
  message: string;
};

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] || character);
}

export async function sendInquiryEmails(inquiry: InquiryEmail) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    console.warn("BREVO_API_KEY is not configured; inquiry saved without email notifications.");
    return { sent: false };
  }
  const sender = { email: process.env.BREVO_SENDER_EMAIL || "hello@mail.rolefield.ai", name: process.env.BREVO_SENDER_NAME || "RoleField" };
  const notify = process.env.LEAD_NOTIFICATION_EMAIL || "voice@ai7lab.net";
  const title = inquiry.kind === "partnership" ? "New partnership enquiry" : "New website enquiry";
  const rows = [
    ["Reference", inquiry.inquiryId], ["Name", inquiry.name], ["Email", inquiry.email],
    ["Company", inquiry.company], ["Phone", inquiry.phone || "Not provided"], ["Topic", inquiry.topic],
  ].map(([label, value]) => `<tr><td style="padding:8px 12px;color:#666;border-bottom:1px solid #eee">${label}</td><td style="padding:8px 12px;border-bottom:1px solid #eee">${escapeHtml(value)}</td></tr>`).join("");
  const send = async (message: Record<string, unknown>) => {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", { method: "POST", signal: AbortSignal.timeout(10_000), headers: { accept: "application/json", "api-key": apiKey, "content-type": "application/json" }, body: JSON.stringify({ sender, ...message }) });
    if (!response.ok) throw new Error(`Brevo delivery failed (${response.status}): ${await response.text()}`);
  };
  await Promise.all([
    send({ to: [{ email: notify, name: "RoleField enquiries" }], replyTo: { email: inquiry.email, name: inquiry.name }, subject: `${title}: ${inquiry.company}`, htmlContent: `<div style="font-family:Arial,sans-serif;max-width:640px"><h1 style="color:#14213d">${title}</h1><table style="width:100%;border-collapse:collapse">${rows}</table><h3>Message</h3><p style="white-space:pre-wrap;line-height:1.6">${escapeHtml(inquiry.message)}</p></div>` }),
    send({ to: [{ email: inquiry.email, name: inquiry.name }], replyTo: { email: notify, name: "RoleField" }, subject: "We received your message — RoleField", htmlContent: `<div style="font-family:Arial,sans-serif;max-width:600px;color:#14213d"><h1>Thank you, ${escapeHtml(inquiry.name)}.</h1><p style="line-height:1.6">We have received your ${inquiry.kind === "partnership" ? "partnership enquiry" : "message"}. Our UAE team will respond within one business day.</p><p style="line-height:1.6">Your reference is <strong>${escapeHtml(inquiry.inquiryId)}</strong>.</p><p>RoleField · conversations &amp; more<br>DIFC, Dubai, UAE</p></div>` }),
  ]);
  return { sent: true };
}

type AgentRequestEmail = { requestId: string; email: string; gender: string; language: string; useCase: string };

export async function sendAgentRequestEmails(request: AgentRequestEmail) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    console.warn("BREVO_API_KEY is not configured; agent request saved without email notifications.");
    return { sent: false };
  }
  const sender = { email: process.env.BREVO_SENDER_EMAIL || "hello@mail.rolefield.ai", name: process.env.BREVO_SENDER_NAME || "RoleField" };
  const notify = process.env.LEAD_NOTIFICATION_EMAIL || "voice@ai7lab.net";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://rolefield.ai";
  const send = async (message: Record<string, unknown>) => {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", { method: "POST", signal: AbortSignal.timeout(10_000), headers: { accept: "application/json", "api-key": apiKey, "content-type": "application/json" }, body: JSON.stringify({ sender, ...message }) });
    if (!response.ok) throw new Error(`Brevo delivery failed (${response.status}): ${await response.text()}`);
  };
  const details = `<table style="width:100%;border-collapse:collapse"><tr><td style="padding:8px;border-bottom:1px solid #eee;color:#666">Gender</td><td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(request.gender)}</td></tr><tr><td style="padding:8px;border-bottom:1px solid #eee;color:#666">Language</td><td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(request.language)}</td></tr><tr><td style="padding:8px;border-bottom:1px solid #eee;color:#666">Use case</td><td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(request.useCase)}</td></tr></table>`;
  await Promise.all([
    send({ to: [{ email: notify, name: "RoleField leads" }], replyTo: { email: request.email }, subject: `New custom agent request: ${request.useCase}`, htmlContent: `<div style="font-family:Arial,sans-serif;max-width:620px;color:#14213d"><h1>New custom agent request</h1><p><strong>${escapeHtml(request.email)}</strong> requested an agent.</p>${details}<p>Reference: ${escapeHtml(request.requestId)}</p></div>` }),
    send({ to: [{ email: request.email }], replyTo: { email: notify, name: "RoleField" }, subject: "Your RoleField agent is getting ready", htmlContent: `<div style="font-family:Arial,sans-serif;max-width:620px;color:#14213d"><p style="color:#147d75;font-size:12px;letter-spacing:1px">ROLEFIELD · CONVERSATIONS &amp; MORE</p><h1>Your agent is getting ready.</h1><p style="font-size:16px;line-height:1.65">We’ll update you once your agent is ready for service. Let’s connect sometime to discuss your goals and objectives so your agent can start working for you.</p>${details}<p style="margin:30px 0"><a href="${siteUrl}/?demo=1" style="display:inline-block;background:#14213d;color:#fff;text-decoration:none;padding:14px 22px;border-radius:7px;font-weight:bold">Book a session</a></p><p style="font-size:12px;color:#666">Request reference: ${escapeHtml(request.requestId)}<br>RoleField · DIFC, Dubai, UAE</p></div>` }),
  ]);
  return { sent: true };
}
