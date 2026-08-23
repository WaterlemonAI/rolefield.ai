import { z } from "zod";
import { transaction } from "@/lib/olv/db";
import { hashPassword, tokenHash } from "@/lib/olv/security";
import { guardLeadRequest } from "@/lib/request-guard";

const input = z.object({ token: z.string().min(32), password: z.string().min(12).max(200) });

export async function POST(request: Request) {
  const limited = guardLeadRequest(request, "olv-activate", 8);
  if (limited) return limited;
  let data: z.infer<typeof input>;
  try {
    data = input.parse(await request.json());
  } catch {
    return Response.json({ error: "Use a password with at least 12 characters." }, { status: 400 });
  }
  try {
    const passwordHash = await hashPassword(data.password);
    const ok = await transaction(async (c) => {
      const token = (
        await c.query<{ id: string; user_id: string; organization_id: string }>(
          "SELECT id,user_id,organization_id FROM account_activation_tokens WHERE token_hash=$1 AND consumed_at IS NULL AND expires_at>now() FOR UPDATE",
          [tokenHash(data.token)],
        )
      ).rows[0];
      if (!token) return false;
      await c.query("UPDATE users SET password_hash=$1,activated_at=now() WHERE id=$2", [passwordHash, token.user_id]);
      await c.query("UPDATE account_activation_tokens SET consumed_at=now() WHERE id=$1", [token.id]);
      await c.query(
        "INSERT INTO audit_logs(organization_id,actor_user_id,action,target_type,target_id) VALUES($1,$2,'ACCOUNT_ACTIVATED','user',$3)",
        [token.organization_id, token.user_id, token.user_id],
      );
      return true;
    });
    return ok ? Response.json({ ok: true }) : Response.json({ error: "This activation link is invalid, expired, or has already been used." }, { status: 400 });
  } catch (error) {
    console.error("OLV activation failed", { name: (error as Error).name });
    return Response.json({ error: "We could not activate the account. Please try again." }, { status: 500 });
  }
}
