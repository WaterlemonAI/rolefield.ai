import pg from "pg";
import argon2 from "argon2";

const OWNER_EMAIL = "arbaz.uddin@gmail.com";
const OWNER_PASSWORD = "Mahoba@210427";
const OWNER_NAME = "Arbaz";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
try {
  await client.query("BEGIN");
  const organization = (await client.query(
    `SELECT o.id FROM organizations o
     LEFT JOIN domains d ON d.organization_id=o.id
     ORDER BY CASE WHEN d.name='creatorleague.in' THEN 0 ELSE 1 END,o.created_at
     LIMIT 1`,
  )).rows[0] || (await client.query("INSERT INTO organizations(name) VALUES('Creator League') RETURNING id")).rows[0];
  let user = (await client.query("SELECT id FROM users WHERE recovery_email=$1 LIMIT 1", [OWNER_EMAIL])).rows[0];
  const passwordHash = await argon2.hash(`${OWNER_PASSWORD}${process.env.PASSWORD_PEPPER || ""}`, { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 1 });
  if (!user) user = (await client.query("INSERT INTO users(name,recovery_email,password_hash,activated_at) VALUES($1,$2,$3,now()) RETURNING id", [OWNER_NAME, OWNER_EMAIL, passwordHash])).rows[0];
  else await client.query("UPDATE users SET name=$1,password_hash=$2,activated_at=now() WHERE id=$3", [OWNER_NAME, passwordHash, user.id]);
  await client.query("DELETE FROM organization_members WHERE user_id=$1 AND organization_id<>$2", [user.id, organization.id]);
  await client.query("INSERT INTO organization_members(organization_id,user_id,role) VALUES($1,$2,'ADMIN') ON CONFLICT(organization_id,user_id) DO UPDATE SET role='ADMIN'", [organization.id, user.id]);
  await client.query("DELETE FROM organization_members WHERE organization_id=$1 AND user_id<>$2", [organization.id, user.id]);
  await client.query("UPDATE sessions SET revoked_at=now() WHERE user_id<>$1 AND revoked_at IS NULL", [user.id]);
  await client.query("COMMIT");
  console.log(`Owner access ready for ${OWNER_EMAIL}.`);
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
