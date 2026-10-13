import { SendEmailCommand, SESv2Client } from "@aws-sdk/client-sesv2";

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

type AgentRequestEmail = { requestId: string; email: string; gender: string; language: string; useCase: string };

const globalForWebsiteSes = globalThis as unknown as { rolefieldWebsiteSes?: SESv2Client };

function ses() {
  globalForWebsiteSes.rolefieldWebsiteSes ??= new SESv2Client({
    region: process.env.SES_REGION || process.env.AWS_REGION || "us-east-1",
    maxAttempts: 4,
  });
  return globalForWebsiteSes.rolefieldWebsiteSes;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] || character);
}

async function sendEmail(input: { to: string; replyTo?: string; subject: string; html: string; text: string }) {
  const configurationSet = process.env.WEBSITE_SES_CONFIGURATION_SET;
  const result = await ses().send(new SendEmailCommand({
    FromEmailAddress: `Rolefield <${process.env.WEBSITE_SENDER_EMAIL || "hello@rolefield.ai"}>`,
    Destination: { ToAddresses: [input.to] },
    ReplyToAddresses: input.replyTo ? [input.replyTo] : undefined,
    ConfigurationSetName: configurationSet || undefined,
    Content: {
      Simple: {
        Subject: { Data: input.subject, Charset: "UTF-8" },
        Body: {
          Html: { Data: input.html, Charset: "UTF-8" },
          Text: { Data: input.text, Charset: "UTF-8" },
        },
      },
    },
  }));
  if (!result.MessageId) throw new Error("Amazon SES did not return a message ID.");
  return result.MessageId;
}

export async function sendLeadEmails(lead: LeadEmail) {
  const notify = process.env.LEAD_NOTIFICATION_EMAIL || "arbaz@ai7lab.net";
  const replyTo = process.env.REPLY_TO_EMAIL || notify;
  const isDemo = lead.type === "demo";
  const title = isDemo ? "New Rolefield demo booking" : "New Rolefield callback request";
  const schedule = isDemo ? `${lead.date || "Date not supplied"} at ${lead.time || "Time not supplied"} GST` : lead.callbackWindow || "Window not supplied";
  const rows = [
    ["Reference", lead.leadId], ["Name", lead.name], ["Email", lead.email], ["Company", lead.company],
    ["Phone", lead.phone], ["Language", lead.language], ["Priority", lead.useCase], ["Schedule", schedule],
  ].map(([label, value]) => `<tr><td style="padding:8px 12px;color:#64748b;border-bottom:1px solid #e5e7eb">${label}</td><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${escapeHtml(value)}</td></tr>`).join("");

  await Promise.all([
    sendEmail({
      to: notify,
      replyTo: lead.email,
      subject: `${title}: ${lead.company}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:640px;color:#071b36"><h1>${title}</h1><table style="width:100%;border-collapse:collapse">${rows}</table><h3>Notes</h3><p style="white-space:pre-wrap;line-height:1.6">${escapeHtml(lead.notes || "Not provided")}</p></div>`,
      text: `${title}\nReference: ${lead.leadId}\nName: ${lead.name}\nEmail: ${lead.email}\nCompany: ${lead.company}\nPhone: ${lead.phone}\nPriority: ${lead.useCase}\nSchedule: ${schedule}\nNotes: ${lead.notes || "Not provided"}`,
    }),
    sendEmail({
      to: lead.email,
      replyTo,
      subject: isDemo ? "Your Rolefield working session is booked" : "We received your callback request",
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;color:#071b36"><p style="color:#1a67d3;font-size:12px;letter-spacing:1px">ROLEFIELD · REAL-WORLD AI</p><h1>${isDemo ? "Your working session is booked." : "Your callback is requested."}</h1><p style="font-size:16px;line-height:1.65">Hi ${escapeHtml(lead.name)}, ${isDemo ? `we have reserved ${escapeHtml(schedule)}.` : "our team will contact you in your selected window."}</p><p>Reference: <strong>${escapeHtml(lead.leadId)}</strong></p><p>Rolefield · Dubai, UAE</p></div>`,
      text: `Hi ${lead.name},\n\n${isDemo ? `Your Rolefield working session is booked for ${schedule}.` : "We received your Rolefield callback request."}\nReference: ${lead.leadId}\n\nRolefield · Dubai, UAE`,
    }),
  ]);
  return { sent: true };
}

export async function sendSubscriberNotification(subscriber: { email: string; source: string }) {
  const notify = process.env.SUBSCRIBER_NOTIFICATION_EMAIL || process.env.LEAD_NOTIFICATION_EMAIL;
  if (!notify) return { sent: false };
  await sendEmail({
    to: notify,
    replyTo: subscriber.email,
    subject: "New Rolefield brief subscriber",
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;color:#071b36"><h1>New subscriber</h1><p><strong>${escapeHtml(subscriber.email)}</strong> joined the Rolefield brief.</p><p>Source: ${escapeHtml(subscriber.source)}</p></div>`,
    text: `New Rolefield brief subscriber\nEmail: ${subscriber.email}\nSource: ${subscriber.source}`,
  });
  return { sent: true };
}

export async function sendInquiryEmails(inquiry: InquiryEmail) {
  const notify = process.env.LEAD_NOTIFICATION_EMAIL || "arbaz@ai7lab.net";
  const title = inquiry.kind === "partnership" ? "New partnership enquiry" : "New website enquiry";
  const rows = [
    ["Reference", inquiry.inquiryId], ["Name", inquiry.name], ["Email", inquiry.email],
    ["Company", inquiry.company], ["Phone", inquiry.phone || "Not provided"], ["Topic", inquiry.topic],
  ].map(([label, value]) => `<tr><td style="padding:8px 12px;color:#666;border-bottom:1px solid #eee">${label}</td><td style="padding:8px 12px;border-bottom:1px solid #eee">${escapeHtml(value)}</td></tr>`).join("");
  await Promise.all([
    sendEmail({ to: notify, replyTo: inquiry.email, subject: `${title}: ${inquiry.company}`, html: `<div style="font-family:Arial,sans-serif;max-width:640px"><h1 style="color:#14213d">${title}</h1><table style="width:100%;border-collapse:collapse">${rows}</table><h3>Message</h3><p style="white-space:pre-wrap;line-height:1.6">${escapeHtml(inquiry.message)}</p></div>`, text: `${title}\n${inquiry.name} · ${inquiry.email} · ${inquiry.company}\n${inquiry.topic}\n${inquiry.message}` }),
    sendEmail({ to: inquiry.email, replyTo: notify, subject: "We received your message — Rolefield", html: `<div style="font-family:Arial,sans-serif;max-width:600px;color:#14213d"><h1>Thank you, ${escapeHtml(inquiry.name)}.</h1><p style="line-height:1.6">We have received your ${inquiry.kind === "partnership" ? "partnership enquiry" : "message"}. Our UAE team will respond within one business day.</p><p>Your reference is <strong>${escapeHtml(inquiry.inquiryId)}</strong>.</p></div>`, text: `Thank you, ${inquiry.name}. We received your message. Reference: ${inquiry.inquiryId}.` }),
  ]);
  return { sent: true };
}

export async function sendAgentRequestEmails(request: AgentRequestEmail) {
  const notify = process.env.LEAD_NOTIFICATION_EMAIL || "arbaz@ai7lab.net";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://rolefield.ai";
  const details = `<table style="width:100%;border-collapse:collapse"><tr><td style="padding:8px;border-bottom:1px solid #eee;color:#666">Gender</td><td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(request.gender)}</td></tr><tr><td style="padding:8px;border-bottom:1px solid #eee;color:#666">Language</td><td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(request.language)}</td></tr><tr><td style="padding:8px;border-bottom:1px solid #eee;color:#666">Use case</td><td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(request.useCase)}</td></tr></table>`;
  await Promise.all([
    sendEmail({ to: notify, replyTo: request.email, subject: `New custom agent request: ${request.useCase}`, html: `<div style="font-family:Arial,sans-serif;max-width:620px;color:#14213d"><h1>New custom agent request</h1><p><strong>${escapeHtml(request.email)}</strong> requested an agent.</p>${details}<p>Reference: ${escapeHtml(request.requestId)}</p></div>`, text: `New custom agent request from ${request.email}. ${request.gender}, ${request.language}, ${request.useCase}. Reference: ${request.requestId}` }),
    sendEmail({ to: request.email, replyTo: notify, subject: "Your Rolefield agent is getting ready", html: `<div style="font-family:Arial,sans-serif;max-width:620px;color:#14213d"><p style="color:#147d75;font-size:12px;letter-spacing:1px">ROLEFIELD · CONVERSATIONS &amp; MORE</p><h1>Your agent is getting ready.</h1><p style="font-size:16px;line-height:1.65">We’ll update you once your agent is ready for service.</p>${details}<p style="margin:30px 0"><a href="${siteUrl}/?demo=1" style="display:inline-block;background:#14213d;color:#fff;text-decoration:none;padding:14px 22px">Book a session</a></p><p>Request reference: ${escapeHtml(request.requestId)}</p></div>`, text: `Your Rolefield agent is getting ready. Request reference: ${request.requestId}. Book a session: ${siteUrl}/?demo=1` }),
  ]);
  return { sent: true };
}
