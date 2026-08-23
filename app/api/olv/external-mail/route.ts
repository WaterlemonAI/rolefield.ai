import { z } from "zod";
import { apiRequireAdmin } from "@/lib/olv/session";
import { requireSameOrigin, encryptSecret } from "@/lib/olv/security";
import { query, transaction } from "@/lib/olv/db";
import { testExternalMail } from "@/lib/olv/external-mail";

const schema = z.object({
  email: z.string().trim().email().transform(v=>v.toLowerCase()), displayName: z.string().trim().min(1).max(160),
  imapHost: z.string().trim().min(1).max(253), imapPort: z.coerce.number().int().min(1).max(65535), imapSecure: z.boolean(),
  smtpHost: z.string().trim().min(1).max(253), smtpPort: z.coerce.number().int().min(1).max(65535), smtpSecure: z.boolean(),
  username: z.string().trim().min(1).max(320), password: z.string().min(1).max(1000),
});
export async function GET(request:Request){
  const p=await apiRequireAdmin(request);
  const {rows}=await query(`SELECT e.id,e.email,e.display_name "displayName",e.imap_host "imapHost",e.smtp_host "smtpHost",e.status,e.last_synced_at "lastSyncedAt",e.last_error "lastError",e.mailbox_id "mailboxId" FROM external_mail_accounts e WHERE e.organization_id=$1 AND e.user_id=$2 ORDER BY e.created_at`,[p.organizationId,p.userId]);
  return Response.json({accounts:rows});
}
export async function POST(request:Request){
  requireSameOrigin(request); const p=await apiRequireAdmin(request);
  const parsed=schema.safeParse(await request.json().catch(()=>null));
  if(!parsed.success)return Response.json({error:"Enter valid IMAP and SMTP account details.",details:parsed.error.flatten().fieldErrors},{status:400});
  try { await testExternalMail(parsed.data); }
  catch(error){
    const message=String((error as Error).message).slice(0,500);
    console.warn("External mail connection test failed", {imapHost:parsed.data.imapHost,imapPort:parsed.data.imapPort,smtpHost:parsed.data.smtpHost,smtpPort:parsed.data.smtpPort,message});
    return Response.json({error:`Connection failed: ${message}`},{status:422});
  }
  try {
    const account=await transaction(async c=>{
      const mailbox=(await c.query<{id:string}>("INSERT INTO mailboxes(organization_id,name,type,active) VALUES($1,$2,'INDIVIDUAL',true) RETURNING id",[p.organizationId,parsed.data.displayName])).rows[0];
      await c.query("INSERT INTO mailbox_addresses(organization_id,mailbox_id,domain_id,address,is_primary) VALUES($1,$2,NULL,$3,true)",[p.organizationId,mailbox.id,parsed.data.email]);
      await c.query("INSERT INTO mailbox_members(organization_id,mailbox_id,user_id,role) VALUES($1,$2,$3,'OWNER')",[p.organizationId,mailbox.id,p.userId]);
      return (await c.query<{id:string}>(`INSERT INTO external_mail_accounts(organization_id,user_id,mailbox_id,email,display_name,imap_host,imap_port,imap_secure,smtp_host,smtp_port,smtp_secure,username,secret_encrypted) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,[p.organizationId,p.userId,mailbox.id,parsed.data.email,parsed.data.displayName,parsed.data.imapHost,parsed.data.imapPort,parsed.data.imapSecure,parsed.data.smtpHost,parsed.data.smtpPort,parsed.data.smtpSecure,parsed.data.username,encryptSecret(parsed.data.password)])).rows[0];
    });
    return Response.json({id:account.id,email:parsed.data.email,status:"CONNECTED"},{status:201});
  }catch(error){const code=(error as {code?:string}).code;return Response.json({error:code==="23505"?"This email account is already connected.":"Unable to save the connected email account."},{status:code==="23505"?409:500});}
}
