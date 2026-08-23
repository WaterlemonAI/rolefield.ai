import type { PoolClient } from "pg";
import { randomToken, tokenHash } from "./security";
import { sendSystemEmail } from "./mail";
import { query } from "./db";

export const INVITATION_TTL_HOURS = 24;

export async function issueInvitation(client: PoolClient, organizationId: string, userId: string) {
  const token = randomToken();
  await client.query(
    "UPDATE account_activation_tokens SET consumed_at=now() WHERE organization_id=$1 AND user_id=$2 AND consumed_at IS NULL",
    [organizationId, userId],
  );
  const row = (await client.query<{ id: string }>(
    "INSERT INTO account_activation_tokens(organization_id,user_id,token_hash,expires_at,delivery_status) VALUES($1,$2,$3,now()+($4||' hours')::interval,'PENDING') RETURNING id",
    [organizationId, userId, tokenHash(token), INVITATION_TTL_HOURS],
  )).rows[0];
  return { id: row.id, token };
}

export async function deliverInvitation(input: { id: string; token: string; email: string; name: string }) {
  const baseUrl = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  const activationUrl = `${baseUrl}/activate?token=${encodeURIComponent(input.token)}`;
  try {
    await sendSystemEmail(
      input.email,
      "Set up your RoleField account",
      `Hello ${input.name},\n\nAn administrator created your RoleField account. Set your password within ${INVITATION_TTL_HOURS} hours:\n\n${activationUrl}\n\nIf you were not expecting this invitation, you can ignore it.`,
    );
    await query("UPDATE account_activation_tokens SET delivery_status='SENT',delivered_at=now(),delivery_error=NULL WHERE id=$1", [input.id]);
    return { deliveryStatus: "SENT" as const };
  } catch (error) {
    await query("UPDATE account_activation_tokens SET delivery_status='FAILED',delivery_error=$2 WHERE id=$1", [input.id, (error as Error).message.slice(0, 300)]);
    return {
      deliveryStatus: "FAILED" as const,
      ...(process.env.NODE_ENV === "production" ? {} : { activationUrl }),
    };
  }
}
