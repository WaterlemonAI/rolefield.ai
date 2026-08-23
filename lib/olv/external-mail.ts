import { ImapFlow } from "imapflow";
import nodemailer from "nodemailer";
import { decryptSecret } from "./security";
import { query, transaction } from "./db";
import { chooseThread, normalizeSubject, parseMime } from "./mail";

export type ExternalMailConfig = {
  email: string; imapHost: string; imapPort: number; imapSecure: boolean;
  smtpHost: string; smtpPort: number; smtpSecure: boolean; username: string; password: string;
};
export type StoredExternalMailAccount = {
  id: string; organization_id: string; user_id: string; mailbox_id: string; email: string; display_name: string;
  imap_host: string; imap_port: number; imap_secure: boolean; smtp_host: string; smtp_port: number; smtp_secure: boolean;
  username: string; secret_encrypted: string; status: string; last_synced_at: string | null; last_error: string | null;
};
export function accountConfig(account: StoredExternalMailAccount): ExternalMailConfig {
  return { email: account.email, imapHost: account.imap_host, imapPort: account.imap_port, imapSecure: account.imap_secure, smtpHost: account.smtp_host, smtpPort: account.smtp_port, smtpSecure: account.smtp_secure, username: account.username, password: decryptSecret(account.secret_encrypted) };
}
function imapError(error: unknown) {
  const value=error as {message?:string;responseText?:string;serverResponseCode?:string;authenticationFailed?:boolean};
  if(value.authenticationFailed)return "Authentication rejected. Enable Titan third-party email access and, if 2FA is enabled, use a Titan application password.";
  return [value.responseText,value.serverResponseCode,value.message].filter(Boolean).join(" · ")||"Unknown IMAP error";
}
export async function testExternalMail(config: ExternalMailConfig) {
  const imap = new ImapFlow({ host: config.imapHost, port: config.imapPort, secure: config.imapSecure, auth: { user: config.username, pass: config.password }, logger: false });
  try { await imap.connect(); await imap.mailboxOpen("INBOX", { readOnly: true }); }
  catch(error) { throw new Error(`IMAP connection failed (${config.imapHost}:${config.imapPort}, ${config.imapSecure ? "SSL/TLS" : "STARTTLS"}): ${imapError(error)}`); }
  finally { if (imap.usable) await imap.logout().catch(() => undefined); }
  const smtp = nodemailer.createTransport({ host: config.smtpHost, port: config.smtpPort, secure: config.smtpSecure, auth: { user: config.username, pass: config.password }, connectionTimeout: 15_000, greetingTimeout: 15_000 });
  try { await smtp.verify(); }
  catch(error) { throw new Error(`SMTP connection failed (${config.smtpHost}:${config.smtpPort}, ${config.smtpSecure ? "SSL/TLS" : "STARTTLS"}): ${String((error as Error).message)}`); }
}
export function imapClient(config: ExternalMailConfig) {
  return new ImapFlow({ host: config.imapHost, port: config.imapPort, secure: config.imapSecure, auth: { user: config.username, pass: config.password }, logger: false });
}
export function smtpTransport(config: ExternalMailConfig) {
  return nodemailer.createTransport({ host: config.smtpHost, port: config.smtpPort, secure: config.smtpSecure, auth: { user: config.username, pass: config.password } });
}
export async function syncExternalAccount(account: StoredExternalMailAccount) {
  const config = accountConfig(account);
  const client = imapClient(config);
  let imported = 0;
  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");
    try {
      const exists = client.mailbox && typeof client.mailbox !== "boolean" ? client.mailbox.exists : 0;
      if (!exists) return 0;
      const start = Math.max(1, exists - 99);
      for await (const item of client.fetch(`${start}:*`, { source: true, uid: true })) {
        if (!item.source) continue;
        const parsed = await parseMime(new Uint8Array(item.source));
        const result = await transaction(async (c) => {
          const duplicate = await c.query("SELECT 1 FROM messages WHERE organization_id=$1 AND internet_message_id=$2", [account.organization_id, parsed.messageId]);
          if (duplicate.rowCount) return false;
          const related = await c.query<{ id:string;thread_id:string;internet_message_id:string }>("SELECT id,thread_id,internet_message_id FROM messages WHERE organization_id=$1 AND (internet_message_id=$2 OR internet_message_id=ANY($3::text[]))", [account.organization_id, parsed.inReplyTo, parsed.references]);
          let threadId = chooseThread(parsed, related.rows);
          if (!threadId) threadId = (await c.query<{id:string}>("INSERT INTO threads(organization_id,mailbox_id,subject,normalized_subject,latest_at) VALUES($1,$2,$3,$4,$5) RETURNING id", [account.organization_id, account.mailbox_id, parsed.subject, normalizeSubject(parsed.subject), parsed.date])).rows[0].id;
          const message = (await c.query<{id:string}>(`INSERT INTO messages(organization_id,thread_id,mailbox_id,internet_message_id,direction,subject,text_body,html_body,received_at,state,idempotency_key) VALUES($1,$2,$3,$4,'INBOUND',$5,$6,$7,$8,'RECEIVED',$9) RETURNING id`, [account.organization_id, threadId, account.mailbox_id, parsed.messageId, parsed.subject, parsed.text, parsed.html, parsed.date, `imap:${account.id}:${item.uid}`])).rows[0];
          const people = [...(parsed.from ? [{kind:"FROM",...parsed.from}] : []), ...parsed.to.map(p=>({kind:"TO",...p})), ...parsed.cc.map(p=>({kind:"CC",...p}))];
          for (const person of people) if (person.address) await c.query("INSERT INTO message_participants(organization_id,message_id,kind,email,name) VALUES($1,$2,$3,$4,$5)", [account.organization_id, message.id, person.kind, person.address.toLowerCase(), person.name || null]);
          await c.query("INSERT INTO mailbox_message_state(organization_id,mailbox_id,message_id) VALUES($1,$2,$3)", [account.organization_id, account.mailbox_id, message.id]);
          await c.query("UPDATE threads SET latest_at=$1 WHERE id=$2 AND organization_id=$3", [parsed.date, threadId, account.organization_id]);
          return true;
        });
        if (result) imported++;
      }
    } finally { lock.release(); }
    await query("UPDATE external_mail_accounts SET status='CONNECTED',last_synced_at=now(),last_error=NULL,updated_at=now() WHERE id=$1", [account.id]);
    return imported;
  } catch (error) {
    await query("UPDATE external_mail_accounts SET status='ERROR',last_error=$2,updated_at=now() WHERE id=$1", [account.id, String((error as Error).message).slice(0,500)]);
    throw error;
  } finally { if (client.usable) await client.logout().catch(() => undefined); }
}
