import { Queue, Worker, type Job } from "bullmq";
import IORedis from "ioredis";
import { getDb } from "../db/index.js";
import {
  buildMime,
  chooseThread,
  normalizeSubject,
  parseMime,
} from "../lib/olv/mail.js";
import {
  putPrivateObject,
  readPrivateObject,
  SesMailProvider,
} from "../lib/olv/aws.js";
import { sanitizeFilename } from "../lib/olv/validation.js";

for (const key of [
  "DATABASE_URL",
  "REDIS_URL",
  "SES_REGION",
  "SES_CONFIGURATION_SET",
  "S3_REGION",
  "S3_BUCKET",
])
  if (!process.env[key]) throw new Error(`${key} is required.`);
const redisUrl = process.env.REDIS_URL as string;
const connection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
});
const provider = new SesMailProvider();
const deadLetters = new Queue("olv-mail-dead", { connection });

async function idempotent(key: string, type: string, fn: () => Promise<void>) {
  const db = getDb();
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const inserted = await client.query(
      "INSERT INTO processed_jobs(idempotency_key,job_type) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING idempotency_key",
      [key, type],
    );
    if (!inserted.rowCount) {
      await client.query("ROLLBACK");
      return;
    }
    await fn();
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function inbound(job: Job) {
  const data = job.data as { s3Key: string; eventId: string };
  await idempotent(data.eventId, "inbound.parse", async () => {
    const raw = await readPrivateObject(data.s3Key);
    if (raw.length > Number(process.env.MAX_MESSAGE_BYTES || 40_000_000))
      throw new Error("Inbound message exceeds MAX_MESSAGE_BYTES.");
    const parsed = await parseMime(raw);
    const recipients = [...parsed.to, ...parsed.cc]
      .map((p) => p.address?.toLowerCase())
      .filter((address): address is string => Boolean(address));
    const { rows: boxes } = await getDb().query<{
      mailbox_id: string;
      organization_id: string;
      address: string;
    }>(
      "SELECT mailbox_id,organization_id,address FROM mailbox_addresses WHERE address=ANY($1::text[])",
      [recipients],
    );
    for (const box of boxes) {
      const client = await getDb().connect();
      try {
        await client.query("BEGIN");
        const related = await client.query<{
          id: string;
          thread_id: string;
          internet_message_id: string;
        }>(
          "SELECT id,thread_id,internet_message_id FROM messages WHERE organization_id=$1 AND (internet_message_id=$2 OR internet_message_id=ANY($3::text[]))",
          [box.organization_id, parsed.inReplyTo, parsed.references],
        );
        let threadId = chooseThread(parsed, related.rows);
        if (!threadId) {
          threadId = (
            await client.query<{ id: string }>(
              "INSERT INTO threads(organization_id,mailbox_id,subject,normalized_subject,latest_at) VALUES($1,$2,$3,$4,$5) RETURNING id",
              [
                box.organization_id,
                box.mailbox_id,
                parsed.subject,
                normalizeSubject(parsed.subject),
                parsed.date,
              ],
            )
          ).rows[0].id;
        }
        const message = (
          await client.query<{ id: string }>(
            `INSERT INTO messages(organization_id,thread_id,mailbox_id,internet_message_id,direction,subject,text_body,html_body,raw_mime_s3_key,in_reply_to,reference_ids,received_at,state,idempotency_key) VALUES($1,$2,$3,$4,'INBOUND',$5,$6,$7,$8,$9,$10,$11,'RECEIVED',$12) ON CONFLICT(organization_id,internet_message_id) DO NOTHING RETURNING id`,
            [
              box.organization_id,
              threadId,
              box.mailbox_id,
              parsed.messageId,
              parsed.subject,
              parsed.text,
              parsed.html,
              data.s3Key,
              parsed.inReplyTo,
              parsed.references,
              parsed.date,
              `${data.eventId}:${box.mailbox_id}`,
            ],
          )
        ).rows[0];
        if (!message) {
          await client.query("ROLLBACK");
          continue;
        }
        const people = [
          ...[parsed.from && { kind: "FROM", ...parsed.from }],
          ...parsed.to.map((p) => ({ kind: "TO", ...p })),
          ...parsed.cc.map((p) => ({ kind: "CC", ...p })),
        ].filter(Boolean) as { kind: string; address: string; name?: string }[];
        for (const p of people) {
          await client.query(
            "INSERT INTO message_participants(organization_id,message_id,kind,email,name) VALUES($1,$2,$3,$4,$5)",
            [
              box.organization_id,
              message.id,
              p.kind,
              p.address.toLowerCase(),
              p.name || null,
            ],
          );
          await client.query(
            "INSERT INTO contacts(organization_id,email,name) VALUES($1,$2,$3) ON CONFLICT(organization_id,email) DO UPDATE SET name=COALESCE(EXCLUDED.name,contacts.name),last_seen_at=now()",
            [box.organization_id, p.address.toLowerCase(), p.name || null],
          );
          const externalDomain = p.address.toLowerCase().split("@")[1];
          if (externalDomain)
            await client.query(
              "INSERT INTO external_organizations(organization_id,domain) SELECT $1,$2 WHERE NOT EXISTS(SELECT 1 FROM domains WHERE organization_id=$1 AND name=$2) ON CONFLICT DO NOTHING",
              [box.organization_id, externalDomain],
            );
        }
        for (const attachment of parsed.attachments) {
          const content =
            typeof attachment.content === "string"
              ? new TextEncoder().encode(attachment.content)
              : new Uint8Array(attachment.content);
          if (
            content.length >
            Number(process.env.MAX_ATTACHMENT_BYTES || 25_000_000)
          )
            throw new Error("Inbound attachment exceeds MAX_ATTACHMENT_BYTES.");
          const key = await putPrivateObject(
            `attachments/${box.organization_id}/${message.id}`,
            content,
            attachment.mimeType || "application/octet-stream",
          );
          await client.query(
            "INSERT INTO attachments(organization_id,message_id,filename,content_type,size_bytes,s3_key,content_id,inline) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
            [
              box.organization_id,
              message.id,
              sanitizeFilename(attachment.filename || "attachment"),
              attachment.mimeType || "application/octet-stream",
              content.length,
              key,
              attachment.contentId || null,
              attachment.disposition === "inline",
            ],
          );
        }
        await client.query(
          "INSERT INTO mailbox_message_state(organization_id,mailbox_id,message_id) VALUES($1,$2,$3)",
          [box.organization_id, box.mailbox_id, message.id],
        );
        await client.query(
          "UPDATE threads SET latest_at=$1 WHERE id=$2 AND organization_id=$3",
          [parsed.date, threadId, box.organization_id],
        );
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    }
  });
}

async function outbound(job: Job) {
  const { messageId, organizationId } = job.data as {
    messageId: string;
    organizationId: string;
  };
  await idempotent(`send:${messageId}`, "outbound.send", async () => {
    const db = getDb();
    const { rows } = await db.query<{
      id: string;
      subject: string;
      text_body: string;
      html_body: string | null;
      internet_message_id: string;
      in_reply_to: string | null;
      reference_ids: string[];
      mailbox_id: string;
    }>(
      "SELECT * FROM messages WHERE id=$1 AND organization_id=$2 AND direction='OUTBOUND' AND state IN ('QUEUED','FAILED')",
      [messageId, organizationId],
    );
    const message = rows[0];
    if (!message) return;
    const participants = await db.query<{ kind: string; email: string }>(
      "SELECT kind,email FROM message_participants WHERE organization_id=$1 AND message_id=$2",
      [organizationId, messageId],
    );
    const by = (kind: string) =>
      participants.rows.filter((p) => p.kind === kind).map((p) => p.email);
    const from = by("FROM")[0];
    const owned = await db.query(
      "SELECT 1 FROM mailbox_addresses WHERE organization_id=$1 AND mailbox_id=$2 AND address=$3",
      [organizationId, message.mailbox_id, from],
    );
    if (!owned.rowCount)
      throw new Error("From address is not owned by the mailbox.");
    await db.query(
      "UPDATE messages SET state='SENDING',failure_reason=NULL WHERE id=$1 AND organization_id=$2",
      [messageId, organizationId],
    );
    const attachments = await db.query<{
      filename: string;
      content_type: string;
      s3_key: string;
    }>(
      "SELECT filename,content_type,s3_key FROM attachments WHERE organization_id=$1 AND message_id=$2",
      [organizationId, messageId],
    );
    const loaded = await Promise.all(
      attachments.rows.map(async (a) => ({
        filename: a.filename,
        contentType: a.content_type,
        content: await readPrivateObject(a.s3_key),
      })),
    );
    try {
      const raw = await buildMime({
        from,
        to: by("TO"),
        cc: by("CC"),
        bcc: by("BCC"),
        subject: message.subject,
        text: message.text_body,
        html: message.html_body || undefined,
        messageId: message.internet_message_id,
        inReplyTo: message.in_reply_to,
        references: message.reference_ids,
        attachments: loaded,
      });
      const providerMessageId = await provider.sendRaw(raw);
      await db.query(
        "UPDATE messages SET state='SENT',sent_at=now(),provider_message_id=$3 WHERE id=$1 AND organization_id=$2",
        [messageId, organizationId, providerMessageId],
      );
    } catch (error) {
      await db.query(
        "UPDATE messages SET state='FAILED',failure_reason=$3 WHERE id=$1 AND organization_id=$2",
        [
          messageId,
          organizationId,
          String((error as Error).message).slice(0, 500),
        ],
      );
      throw error;
    }
  });
}

async function sesEvent(job: Job) {
  const e = job.data as {
    eventId: string;
    type: string;
    messageId: string;
    organizationId: string;
    recipients?: string[];
    timestamp: string;
    payload: unknown;
  };
  await idempotent(e.eventId, "ses.event", async () => {
    const state: Record<string, string> = {
      Delivery: "DELIVERED",
      Bounce: "BOUNCED",
      Complaint: "COMPLAINED",
      Send: "SENT",
      Reject: "FAILED",
    };
    await getDb().query(
      "INSERT INTO mail_delivery_events(organization_id,message_id,provider_event_id,event_type,payload,occurred_at) VALUES($1,(SELECT id FROM messages WHERE organization_id=$1 AND (provider_message_id=$2 OR internet_message_id=$2)),$3,$4,$5,$6) ON CONFLICT DO NOTHING",
      [
        e.organizationId,
        e.messageId,
        e.eventId,
        e.type,
        JSON.stringify(e.payload),
        e.timestamp,
      ],
    );
    if (state[e.type])
      await getDb().query(
        "UPDATE messages SET state=$3 WHERE organization_id=$1 AND (provider_message_id=$2 OR internet_message_id=$2)",
        [e.organizationId, e.messageId, state[e.type]],
      );
    for (const recipient of e.recipients || []) {
      if (e.type === "Bounce")
        await getDb().query(
          "INSERT INTO mail_bounces(organization_id,message_id,recipient,hard,occurred_at) SELECT $1,id,$3,true,$4 FROM messages WHERE organization_id=$1 AND (provider_message_id=$2 OR internet_message_id=$2)",
          [e.organizationId, e.messageId, recipient, e.timestamp],
        );
      if (e.type === "Complaint")
        await getDb().query(
          "INSERT INTO mail_complaints(organization_id,message_id,recipient,occurred_at) SELECT $1,id,$3,$4 FROM messages WHERE organization_id=$1 AND (provider_message_id=$2 OR internet_message_id=$2)",
          [e.organizationId, e.messageId, recipient, e.timestamp],
        );
    }
  });
}

const worker = new Worker(
  "olv-mail",
  async (job) => {
    if (job.name === "inbound.parse") return inbound(job);
    if (job.name === "outbound.send") return outbound(job);
    if (job.name === "ses.event") return sesEvent(job);
    throw new Error(`Unknown job ${job.name}`);
  },
  {
    connection,
    concurrency: Number(process.env.WORKER_CONCURRENCY || 5),
    lockDuration: 120000,
  },
);
worker.on("failed", async (job, error) => {
  console.error(
    JSON.stringify({
      level: "error",
      event: "job_failed",
      jobId: job?.id,
      name: job?.name,
      error: error.message,
    }),
  );
  if (job && job.attemptsMade >= (job.opts.attempts || 1))
    await deadLetters.add(
      "dead-letter",
      { originalQueue: "olv-mail", jobId: job.id, name: job.name, data: job.data, error: error.message, failedAt: new Date().toISOString() },
      { jobId: `dead-${job.id}`, removeOnComplete: false },
    );
});
async function shutdown() {
  await worker.close();
  await deadLetters.close();
  await connection.quit();
  await getDb().end();
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
console.log(JSON.stringify({ level: "info", event: "worker_ready" }));
