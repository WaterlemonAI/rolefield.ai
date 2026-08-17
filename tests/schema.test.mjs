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

test("callback schema captures contact preferences and follow-up state", () => {
  assert.match(schema, /CREATE TABLE IF NOT EXISTS callback_requests/i);
  for (const field of ["request_id", "name", "email", "company", "phone", "language", "use_case", "callback_window", "status", "created_at"]) {
    assert.match(schema, new RegExp(`\\b${field}\\b`));
  }
  assert.match(schema, /idx_callback_requests_created_at/i);
});

test("website inquiry schema supports contact and partnership leads", () => {
  assert.match(schema, /CREATE TABLE IF NOT EXISTS website_inquiries/i);
  for (const field of ["inquiry_id", "kind", "name", "email", "company", "topic", "message", "status", "created_at"]) {
    assert.match(schema, new RegExp(`\\b${field}\\b`));
  }
  assert.match(schema, /idx_website_inquiries_created_at/i);
});

test("custom agent request schema captures configuration and email", () => {
  assert.match(schema, /CREATE TABLE IF NOT EXISTS custom_agent_requests/i);
  for (const field of ["request_id", "email", "gender", "language", "use_case", "status", "created_at"]) {
    assert.match(schema, new RegExp(`\\b${field}\\b`));
  }
  assert.match(schema, /idx_custom_agent_requests_created_at/i);
});
