import { z } from "zod";
import { query, transaction } from "@/lib/olv/db";
import { email } from "@/lib/olv/validation";
import { randomToken, tokenHash, hashPassword } from "@/lib/olv/security";
import { sendSystemEmail } from "@/lib/olv/mail";
import { guardLeadRequest } from "@/lib/request-guard";
const requestSchema = z.object({ action: z.literal("request"), email });
const resetSchema = z.object({
  action: z.literal("reset"),
  token: z.string().min(32),
  password: z.string().min(12).max(200),
});
export async function POST(request: Request) {
  const limit = guardLeadRequest(request, "password", 6);
  if (limit) return limit;
  const parsed = z
    .discriminatedUnion("action", [requestSchema, resetSchema])
    .safeParse(await request.json());
  if (!parsed.success)
    return Response.json({ error: "Invalid request." }, { status: 400 });
  if (parsed.data.action === "request") {
    const address = parsed.data.email;
    const user = (
      await query<{ id: string; organization_id: string }>(
        "SELECT u.id,om.organization_id FROM users u JOIN organization_members om ON om.user_id=u.id WHERE u.recovery_email=$1 LIMIT 1",
        [address],
      )
    ).rows[0];
    if (user) {
      const token = randomToken();
      await query(
        "INSERT INTO password_reset_tokens(organization_id,user_id,token_hash,expires_at) VALUES($1,$2,$3,now()+interval '30 minutes')",
        [user.organization_id, user.id, tokenHash(token)],
      );
      await sendSystemEmail(
        address,
        "Reset your OLV password",
        `Reset your password using this one-time link:\n\n${process.env.APP_URL}/reset-password?token=${token}\n\nThe link expires in 30 minutes.`,
      );
    }
    return Response.json({
      message: "If an account exists, a reset link has been sent.",
    });
  }
  const reset = parsed.data;
  const password = await hashPassword(reset.password);
  const ok = await transaction(async (c) => {
    const token = (
      await c.query<{ id: string; user_id: string; organization_id: string }>(
        "SELECT id,user_id,organization_id FROM password_reset_tokens WHERE token_hash=$1 AND consumed_at IS NULL AND expires_at>now() FOR UPDATE",
        [tokenHash(reset.token)],
      )
    ).rows[0];
    if (!token) return false;
    await c.query("UPDATE users SET password_hash=$1 WHERE id=$2", [
      password,
      token.user_id,
    ]);
    await c.query(
      "UPDATE password_reset_tokens SET consumed_at=now() WHERE id=$1",
      [token.id],
    );
    await c.query(
      "UPDATE sessions SET revoked_at=now() WHERE user_id=$1 AND organization_id=$2",
      [token.user_id, token.organization_id],
    );
    await c.query(
      "INSERT INTO audit_logs(organization_id,actor_user_id,action,target_type,target_id) VALUES($1,$2,'PASSWORD_RESET','user',$2)",
      [token.organization_id, token.user_id],
    );
    return true;
  });
  return ok
    ? Response.json({ ok: true })
    : Response.json(
        { error: "Reset link is invalid or expired." },
        { status: 400 },
      );
}
