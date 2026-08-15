import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const schema = await readFile(new URL("../db/schema.sql", import.meta.url), "utf8");

test("booking schema includes required persistence and lookup fields", () => {
  for (const field of ["booking_id", "email", "demo_date", "demo_time", "created_at"]) {
    assert.match(schema, new RegExp(`\\b${field}\\b`));
  }
  assert.match(schema, /CREATE INDEX IF NOT EXISTS idx_demo_bookings_slot/i);
});
