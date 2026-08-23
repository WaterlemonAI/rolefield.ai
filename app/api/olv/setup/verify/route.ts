import { z } from "zod";
import { query } from "@/lib/olv/db";
import { requireSameOrigin, tokenHash } from "@/lib/olv/security";
import { verifyDomainConnection } from "@/lib/olv/domain-verification";

const input = z.object({ token: z.string().min(32) });

export async function POST(request: Request) {
  requireSameOrigin(request);
  let parsed: z.infer<typeof input>;
  try { parsed = input.parse(await request.json()); }
  catch { return Response.json({ error: "This setup session is invalid." }, { status: 400 }); }
  const domain = (await query<{ id: string; organization_id: string; name: string; state: string }>(
    `SELECT d.id,d.organization_id,d.name,d.state
     FROM account_activation_tokens t
     JOIN domains d ON d.organization_id=t.organization_id
     WHERE t.token_hash=$1 AND t.consumed_at IS NULL AND t.expires_at>now()
     ORDER BY d.created_at LIMIT 1`,
    [tokenHash(parsed.token)],
  )).rows[0];
  if (!domain) return Response.json({ error: "This setup session expired. Submit the setup form again to continue." }, { status: 401 });
  try {
    return Response.json(await verifyDomainConnection({ id: domain.id, organizationId: domain.organization_id, name: domain.name, state: domain.state }));
  } catch (error) {
    console.error("OLV setup verification failed", { name: (error as Error).name });
    return Response.json({ error: "The live DNS check could not complete. Please try again." }, { status: 502 });
  }
}
