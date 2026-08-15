import { Pool } from "pg";

const globalForPostgres = globalThis as unknown as { rolefieldPool?: Pool };

function createPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required for demo booking storage.");
  }

  return new Pool({
    connectionString,
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
}

export function getDb() {
  globalForPostgres.rolefieldPool ??= createPool();
  return globalForPostgres.rolefieldPool;
}
