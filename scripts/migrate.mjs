import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("DATABASE_URL is required to run database migrations.");
  process.exit(1);
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.join(scriptDir, "..", "db", "schema.sql");
const schema = await readFile(schemaPath, "utf8");
const pool = new pg.Pool({ connectionString, max: 1 });

try {
  await pool.query(schema);
  console.log("PostgreSQL schema is ready.");
} finally {
  await pool.end();
}
