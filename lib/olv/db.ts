import type { PoolClient, QueryResultRow } from "pg";
import { getDb } from "@/db";

export async function query<T extends QueryResultRow>(text: string, values: unknown[] = []) { return getDb().query<T>(text, values); }
export async function transaction<T>(fn: (client: PoolClient)=>Promise<T>) { const client=await getDb().connect(); try { await client.query("BEGIN"); const value=await fn(client); await client.query("COMMIT"); return value; } catch(error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); } }
