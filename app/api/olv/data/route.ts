import { z } from "zod";
import { randomUUID } from "node:crypto";
import { apiPrincipal, requireMailbox } from "@/lib/olv/session";
import { query, transaction } from "@/lib/olv/db";
import { audit } from "@/lib/olv/audit";
import { cleanHtml, normalizeSubject } from "@/lib/olv/mail";
import { enqueue } from "@/lib/olv/queue";
import { participantList } from "@/lib/olv/validation";
import { requireSameOrigin } from "@/lib/olv/security";

const sendSchema = z.object({
  action: z.literal("send"),
  mailboxId: z.string().uuid(),
  to: participantList.min(1),
  cc: participantList.default([]),
  bcc: participantList.default([]),
  subject: z.string().trim().min(1).max(998),
  text: z.string().max(2_000_000),
  html: z.string().max(2_000_000).optional(),
  threadId: z.string().uuid().optional(),
  inReplyTo: z.string().max(998).optional(),
  references: z.array(z.string().max(998)).max(100).default([]),
  draftId: z.string().uuid().optional(),
});
const stateSchema = z.object({
  action: z.literal("state"),
  mailboxId: z.string().uuid(),
  messageId: z.string().uuid(),
  archived: z.boolean().optional(),
  trashed: z.boolean().optional(),
  unread: z.boolean().optional(),
});
const draftSchema = z.object({
  action: z.literal("draft"),
  id: z.string().uuid().optional(),
  mailboxId: z.string().uuid(),
  to: participantList,
  cc: participantList,
  bcc: participantList,
  subject: z.string().max(998),
  text: z.string().max(2_000_000),
  threadId: z.string().uuid().optional(),
  inReplyTo: z.string().optional(),
  references: z.array(z.string()).max(100).default([]),
});
const discardSchema = z.object({ action: z.literal("discard"), mailboxId: z.string().uuid(), draftId: z.string().uuid() });

export async function GET(request: Request) {
  const p = await apiPrincipal(request);
  if (p.orgRole !== "ADMIN" && !p.modules.includes("MAILBOX")) return Response.json({ error: "Mailbox access required." }, { status: 403 });
  const url = new URL(request.url);
  const mailboxId = url.searchParams.get("mailboxId");
  const folder = url.searchParams.get("folder") || "Inbox";
  const q = url.searchParams.get("q")?.trim();
  const cursor = url.searchParams.get("cursor");
  const mailboxes = await query<{
    id: string;
    name: string;
    address: string;
    type: string;
  }>(
    `SELECT m.id,m.name,a.address,m.type FROM mailbox_members mm JOIN mailboxes m ON m.id=mm.mailbox_id AND m.organization_id=mm.organization_id JOIN mailbox_addresses a ON a.mailbox_id=m.id AND a.is_primary WHERE mm.organization_id=$1 AND mm.user_id=$2 AND m.active ORDER BY m.name`,
    [p.organizationId, p.userId],
  );
  if (!mailboxId)
    return Response.json({
      principal: p,
      mailboxes: mailboxes.rows,
      threads: [],
    });
  await requireMailbox(p, mailboxId);
  const conditions: string[] = ["t.organization_id=$1", "t.mailbox_id=$2"];
  const values: unknown[] = [p.organizationId, mailboxId];
  if (folder === "Inbox")
    conditions.push(
      "m.direction='INBOUND' AND NOT s.archived AND NOT s.trashed",
    );
  else if (folder === "Sent")
    conditions.push(
      "m.direction='OUTBOUND' AND m.state<>'DRAFT' AND NOT s.trashed",
    );
  else if (folder === "Archive")
    conditions.push("s.archived AND NOT s.trashed");
  else if (folder === "Trash") conditions.push("s.trashed");
  if (cursor) {
    values.push(cursor);
    conditions.push(`t.latest_at<$${values.length}`);
  }
  if (q) {
    values.push(q);
    conditions.push(
      `to_tsvector('simple',m.subject||' '||m.text_body) @@ plainto_tsquery('simple',$${values.length})`,
    );
  }
  const threads = await query(
    `SELECT * FROM (SELECT DISTINCT ON(t.id) t.id,t.subject,t.latest_at,m.id message_id,m.text_body,m.html_body,m.direction,m.state,m.received_at,m.sent_at,m.internet_message_id,m.in_reply_to,m.reference_ids,s.unread,(SELECT json_agg(json_build_object('kind',mp.kind,'email',mp.email,'name',mp.name)) FROM message_participants mp WHERE mp.organization_id=$1 AND mp.message_id=m.id) participants,(SELECT count(*) FROM messages mc WHERE mc.organization_id=$1 AND mc.thread_id=t.id) message_count,(SELECT count(*) FROM attachments at WHERE at.organization_id=$1 AND at.message_id=m.id) attachment_count FROM threads t JOIN messages m ON m.thread_id=t.id AND m.organization_id=t.organization_id JOIN mailbox_message_state s ON s.message_id=m.id AND s.mailbox_id=t.mailbox_id AND s.organization_id=t.organization_id WHERE ${conditions.join(" AND ")} ORDER BY t.id,m.created_at DESC) latest_threads ORDER BY latest_at DESC LIMIT 50`,
    values,
  );
  const drafts =
    folder === "Drafts"
      ? (
          await query(
            "SELECT * FROM drafts WHERE organization_id=$1 AND user_id=$2 AND mailbox_id=$3 ORDER BY updated_at DESC LIMIT 50",
            [p.organizationId, p.userId, mailboxId],
          )
        ).rows
      : [];
  const threadIds = threads.rows.map((thread) => String(thread.id));
  const conversationRows = threadIds.length
    ? (
        await query(
          `SELECT m.id,m.thread_id,m.text_body,m.html_body,m.sent_at,m.received_at,m.state,m.direction,(SELECT json_agg(json_build_object('kind',mp.kind,'email',mp.email,'name',mp.name)) FROM message_participants mp WHERE mp.organization_id=$1 AND mp.message_id=m.id) participants,(SELECT COALESCE(json_agg(json_build_object('id',a.id,'filename',a.filename,'contentType',a.content_type,'size',a.size_bytes)),'[]'::json) FROM attachments a WHERE a.organization_id=$1 AND a.message_id=m.id) attachments FROM messages m WHERE m.organization_id=$1 AND m.thread_id=ANY($2::uuid[]) ORDER BY COALESCE(m.received_at,m.sent_at,m.created_at)`,
          [p.organizationId, threadIds],
        )
      ).rows
    : [];
  for (const thread of threads.rows)
    thread.conversation = conversationRows.filter(
      (message) => message.thread_id === thread.id,
    );
  const draftThreads = drafts.map((draft) => ({
    id: draft.id,
    message_id: draft.id,
    subject: draft.subject || "(no subject)",
    text_body: draft.text_body,
    latest_at: draft.updated_at,
    direction: "OUTBOUND",
    state: "DRAFT",
    unread: false,
    message_count: 1,
    attachment_count: 0,
    participants: (draft.to_list as PersonRecord[]).map((person) => ({ kind: "TO", ...person })),
    draft: true,
    to_list: draft.to_list,
    cc_list: draft.cc_list,
    bcc_list: draft.bcc_list,
  }));
  return Response.json({
    principal: p,
    mailboxes: mailboxes.rows,
    threads: (folder === "Drafts" ? draftThreads : threads.rows).sort(
      (a, b) =>
        new Date(String(b.latest_at)).getTime() -
        new Date(String(a.latest_at)).getTime(),
    ),
    drafts,
    nextCursor:
      threads.rows.length === 50
        ? threads.rows[threads.rows.length - 1].latest_at
        : null,
  });
}

type PersonRecord = { email: string; name?: string };

export async function POST(request: Request) {
  requireSameOrigin(request);
  const p = await apiPrincipal(request);
  if (p.orgRole !== "ADMIN" && !p.modules.includes("MAILBOX")) return Response.json({ error: "Mailbox access required." }, { status: 403 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const parsed = z
    .discriminatedUnion("action", [sendSchema, stateSchema, draftSchema, discardSchema])
    .safeParse(body);
  if (!parsed.success)
    return Response.json(
      {
        error: "Invalid mail request.",
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  const data = parsed.data;
  await requireMailbox(p, data.mailboxId);
  if (data.action === "discard") {
    await query("DELETE FROM drafts WHERE id=$1 AND organization_id=$2 AND mailbox_id=$3 AND user_id=$4", [data.draftId, p.organizationId, data.mailboxId, p.userId]);
    return Response.json({ ok: true });
  }
  if (data.action === "state") {
    await transaction(async (c) => {
      const result = await c.query(
        "UPDATE mailbox_message_state SET archived=COALESCE($4,archived),trashed=COALESCE($5,trashed),unread=COALESCE($6,unread),updated_at=now() WHERE organization_id=$1 AND mailbox_id=$2 AND message_id=$3",
        [
          p.organizationId,
          data.mailboxId,
          data.messageId,
          data.archived,
          data.trashed,
          data.unread,
        ],
      );
      if (!result.rowCount)
        throw Object.assign(new Error("Message not found."), { status: 404 });
      await audit(
        c,
        p,
        data.trashed
          ? "MESSAGE_TRASHED"
          : data.archived
            ? "MESSAGE_ARCHIVED"
            : "MESSAGE_STATE_CHANGED",
        "message",
        data.messageId,
      );
    });
    return Response.json({ ok: true });
  }
  if (data.action === "draft") {
    const result = await query<{ id: string }>(
      `INSERT INTO drafts(id,organization_id,mailbox_id,user_id,thread_id,to_list,cc_list,bcc_list,subject,text_body,in_reply_to,reference_ids) VALUES(COALESCE($1::uuid,gen_random_uuid()),$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT(id) DO UPDATE SET to_list=EXCLUDED.to_list,cc_list=EXCLUDED.cc_list,bcc_list=EXCLUDED.bcc_list,subject=EXCLUDED.subject,text_body=EXCLUDED.text_body,version=drafts.version+1,updated_at=now() WHERE drafts.organization_id=$2 AND drafts.user_id=$4 RETURNING id`,
      [
        data.id || null,
        p.organizationId,
        data.mailboxId,
        p.userId,
        data.threadId || null,
        JSON.stringify(data.to),
        JSON.stringify(data.cc),
        JSON.stringify(data.bcc),
        data.subject,
        data.text,
        data.inReplyTo || null,
        data.references,
      ],
    );
    return Response.json({ id: result.rows[0].id });
  }
  const mailbox = await requireMailbox(p, data.mailboxId);
  const messageId = randomUUID();
  const internetId = `<${randomUUID()}@${mailbox.address.split("@")[1]}>`;
  await transaction(async (c) => {
    const recipients = [...data.to, ...data.cc, ...data.bcc].map((person) => person.email);
    const blocked = await c.query<{ recipient: string }>(
      "SELECT DISTINCT recipient FROM mail_bounces WHERE organization_id=$1 AND hard AND recipient=ANY($2::text[])",
      [p.organizationId, recipients],
    );
    if (blocked.rowCount)
      throw Object.assign(new Error(`Cannot send to hard-bounced recipient: ${blocked.rows[0].recipient}`), { status: 409 });
    let threadId = data.threadId;
    if (threadId) {
      const check = await c.query(
        "SELECT 1 FROM threads WHERE id=$1 AND organization_id=$2 AND mailbox_id=$3",
        [threadId, p.organizationId, data.mailboxId],
      );
      if (!check.rowCount)
        throw Object.assign(new Error("Thread not found."), { status: 404 });
    } else
      threadId = (
        await c.query<{ id: string }>(
          "INSERT INTO threads(organization_id,mailbox_id,subject,normalized_subject) VALUES($1,$2,$3,$4) RETURNING id",
          [
            p.organizationId,
            data.mailboxId,
            data.subject,
            normalizeSubject(data.subject),
          ],
        )
      ).rows[0].id;
    await c.query(
      `INSERT INTO messages(id,organization_id,thread_id,mailbox_id,internet_message_id,direction,subject,text_body,html_body,in_reply_to,reference_ids,state,idempotency_key,actor_user_id) VALUES($1,$2,$3,$4,$5,'OUTBOUND',$6,$7,$8,$9,$10,'QUEUED',$11,$12)`,
      [
        messageId,
        p.organizationId,
        threadId,
        data.mailboxId,
        internetId,
        data.subject,
        data.text,
        data.html ? cleanHtml(data.html) : null,
        data.inReplyTo || null,
        data.references,
        `outbound:${messageId}`,
        p.userId,
      ],
    );
    if (data.draftId) {
      await c.query(
        "UPDATE attachments SET message_id=$1,draft_id=NULL WHERE organization_id=$2 AND draft_id=$3 AND EXISTS(SELECT 1 FROM drafts WHERE id=$3 AND organization_id=$2 AND user_id=$4)",
        [messageId, p.organizationId, data.draftId, p.userId],
      );
      await c.query(
        "DELETE FROM drafts WHERE id=$1 AND organization_id=$2 AND user_id=$3",
        [data.draftId, p.organizationId, p.userId],
      );
    }
    const people = [
      { kind: "FROM", email: mailbox.address },
      ...data.to.map((x) => ({ kind: "TO", ...x })),
      ...data.cc.map((x) => ({ kind: "CC", ...x })),
      ...data.bcc.map((x) => ({ kind: "BCC", ...x })),
    ];
    for (const person of people)
      await c.query(
        "INSERT INTO message_participants(organization_id,message_id,kind,email,name) VALUES($1,$2,$3,$4,$5)",
        [
          p.organizationId,
          messageId,
          person.kind,
          person.email,
          person.name || null,
        ],
      );
    await c.query(
      "INSERT INTO mailbox_message_state(organization_id,mailbox_id,message_id,unread) VALUES($1,$2,$3,false)",
      [p.organizationId, data.mailboxId, messageId],
    );
    await c.query(
      "UPDATE threads SET latest_at=now() WHERE id=$1 AND organization_id=$2",
      [threadId, p.organizationId],
    );
    await audit(c, p, "MESSAGE_SENT", "message", messageId, {
      mailboxId: data.mailboxId,
    });
  });
  await enqueue(
    "outbound.send",
    { messageId, organizationId: p.organizationId },
    `send-${messageId}`,
  );
  return Response.json({ id: messageId, state: "QUEUED" }, { status: 202 });
}

export function errorResponse(error: unknown) {
  const e = error as { status?: number; message?: string };
  console.error("OLV API error", {
    name: (error as Error).name,
    status: e.status,
  });
  return Response.json(
    {
      error:
        e.status && e.status < 500 ? e.message : "Unable to complete request.",
    },
    { status: e.status || 500 },
  );
}
