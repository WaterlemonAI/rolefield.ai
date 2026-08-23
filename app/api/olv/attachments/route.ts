import { apiPrincipal, requireMailbox } from "@/lib/olv/session";
import { putPrivateObject, signedAttachmentUrl } from "@/lib/olv/aws";
import { query } from "@/lib/olv/db";
import { sanitizeFilename } from "@/lib/olv/validation";
import { requireSameOrigin } from "@/lib/olv/security";
export async function POST(request: Request) {
  requireSameOrigin(request);
  const p = await apiPrincipal(request);
  const mailboxId = request.headers.get("x-mailbox-id") || "";
  const draftId = request.headers.get("x-draft-id") || "";
  await requireMailbox(p, mailboxId);
  const size = Number(request.headers.get("content-length") || 0),
    max = Number(process.env.MAX_ATTACHMENT_BYTES || 25_000_000);
  if (!size || size > max)
    return Response.json(
      { error: "Attachment exceeds the allowed size." },
      { status: 413 },
    );
  const filename = sanitizeFilename(
    decodeURIComponent(request.headers.get("x-filename") || "attachment"),
  );
  const contentType = (
    request.headers.get("content-type") || "application/octet-stream"
  ).slice(0, 200);
  const draft = (
    await query(
      "SELECT 1 FROM drafts WHERE id=$1 AND organization_id=$2 AND mailbox_id=$3 AND user_id=$4",
      [draftId, p.organizationId, mailboxId, p.userId],
    )
  ).rowCount;
  if (!draft)
    return Response.json({ error: "Draft not found." }, { status: 404 });
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.length !== size)
    return Response.json(
      { error: "Incomplete attachment upload." },
      { status: 400 },
    );
  const key = await putPrivateObject(
    `attachments/${p.organizationId}/drafts/${draftId}`,
    bytes,
    contentType,
  );
  const saved = await query<{ id: string }>(
    "INSERT INTO attachments(organization_id,draft_id,filename,content_type,size_bytes,s3_key) VALUES($1,$2,$3,$4,$5,$6) RETURNING id",
    [p.organizationId, draftId, filename, contentType, size, key],
  );
  return Response.json(
    { id: saved.rows[0].id, filename, size },
    { status: 201 },
  );
}
export async function GET(request: Request) {
  const p = await apiPrincipal(request);
  const id = new URL(request.url).searchParams.get("id");
  const { rows } = await query<{ s3_key: string }>(
    `SELECT a.s3_key FROM attachments a LEFT JOIN messages m ON m.id=a.message_id LEFT JOIN drafts d ON d.id=a.draft_id WHERE a.id=$1 AND a.organization_id=$2 AND ((m.id IS NOT NULL AND EXISTS(SELECT 1 FROM mailbox_members mm WHERE mm.organization_id=$2 AND mm.user_id=$3 AND mm.mailbox_id=m.mailbox_id)) OR (d.id IS NOT NULL AND d.user_id=$3))`,
    [id, p.organizationId, p.userId],
  );
  if (!rows[0])
    return Response.json({ error: "Attachment not found." }, { status: 404 });
  return Response.json({
    url: await signedAttachmentUrl(rows[0].s3_key),
    expiresIn: 300,
  });
}
