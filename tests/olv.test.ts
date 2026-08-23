import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeDomain,
  sanitizeFilename,
  normalizeSubject,
} from "../lib/olv/validation";
import { cleanHtml, buildMime, parseMime, chooseThread } from "../lib/olv/mail";
import {
  hashPassword,
  verifyPassword,
  randomToken,
  tokenHash,
} from "../lib/olv/security";
import { readFile } from "node:fs/promises";
import { calculateDomainHealth } from "../lib/olv/domain-verification";
test("domain normalization rejects URLs, paths, emails and malformed names", () => {
  assert.equal(normalizeDomain("Example.COM."), "example.com");
  for (const value of [
    "https://example.com",
    "a@example.com",
    "example.com/path",
    "localhost",
    "-bad.com",
  ])
    assert.throws(() => normalizeDomain(value));
});
test("filenames cannot traverse paths", () => {
  assert.equal(sanitizeFilename("../../etc/passwd"), "_.._etc_passwd");
  assert.equal(sanitizeFilename("a\\b\0.txt"), "a_b_.txt");
});
test("subject normalization is fallback-safe", () => {
  assert.equal(normalizeSubject(" Re: FWD: Quarterly plan "), "quarterly plan");
});
test("argon2id passwords verify and reject invalid values", async () => {
  process.env.PASSWORD_PEPPER = "test-only-pepper";
  const hash = await hashPassword("correct horse battery staple");
  assert.match(hash, /^\$argon2id\$/);
  assert.equal(
    await verifyPassword(hash, "correct horse battery staple"),
    true,
  );
  assert.equal(await verifyPassword(hash, "wrong password here"), false);
});
test("tokens are random and only hashes need persistence", () => {
  const a = randomToken(),
    b = randomToken();
  assert.notEqual(a, b);
  assert.equal(tokenHash(a).length, 64);
  assert.notEqual(tokenHash(a), a);
});
test("domain health is deterministic from real check results", () => {
  assert.equal(calculateDomainHealth({ identity: true, dkim: true, requiredRecords: [true, true, true] }), "GREEN");
  assert.equal(calculateDomainHealth({ identity: true, dkim: false, requiredRecords: [true, false] }), "AMBER");
  assert.equal(calculateDomainHealth({ identity: false, dkim: false, requiredRecords: [false, false] }), "RED");
  assert.equal(calculateDomainHealth({ identity: true, dkim: true, requiredRecords: [true], unreachable: true }), "RED");
});
test("HTML sanitizer strips executable content and unsafe protocols", () => {
  const clean = cleanHtml(
    `<p onclick="steal()">Safe<script>alert(1)</script><a href="javascript:bad()">link</a><iframe src="x"></iframe></p>`,
  );
  assert.doesNotMatch(clean, /script|onclick|javascript|iframe/i);
  assert.match(clean, /Safe/);
});
test("MIME generation and parsing preserve Internet threading headers", async () => {
  const raw = await buildMime({
    from: "sender@example.com",
    to: ["receiver@example.net"],
    cc: ["copy@example.net"],
    subject: "Re: Status",
    text: "Ready",
    messageId: "<child@example.com>",
    inReplyTo: "<parent@example.com>",
    references: ["<root@example.com>", "<parent@example.com>"],
  });
  const parsed = await parseMime(raw);
  assert.equal(parsed.messageId, "<child@example.com>");
  assert.equal(parsed.inReplyTo, "<parent@example.com>");
  assert.equal(parsed.text.trim(), "Ready");
  assert.equal(parsed.to[0].address, "receiver@example.net");
});
test("thread selection uses Message-ID references, never subject alone", () => {
  const messages = [
    { id: "1", thread_id: "thread-a", internet_message_id: "<root@x>" },
  ];
  assert.equal(
    chooseThread({ inReplyTo: "<root@x>", references: [] }, messages),
    "thread-a",
  );
  assert.equal(
    chooseThread({ inReplyTo: null, references: [] }, messages),
    null,
  );
});
test("schema carries tenant relationships and authorization indexes", async () => {
  const sql = await readFile(
    new URL("../db/schema.sql", import.meta.url),
    "utf8",
  );
  for (const table of [
    "domains",
    "mailboxes",
    "threads",
    "messages",
    "attachments",
    "drafts",
    "sessions",
    "audit_logs",
  ])
    assert.match(
      sql,
      new RegExp(
        `CREATE TABLE IF NOT EXISTS ${table}[^;]+organization_id`,
        `s`,
      ),
    );
  assert.match(sql, /UNIQUE\(organization_id,internet_message_id\)/);
  assert.match(sql, /idx_mailbox_members_user/);
  assert.match(sql, /idx_search_messages/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS user_module_entitlements/);
  assert.match(sql, /CREATE TYPE user_status AS ENUM \('INVITED','ACTIVE','SUSPENDED'\)/);
  assert.match(sql, /delivery_status TEXT NOT NULL DEFAULT 'PENDING'/);
});
test("mailbox creation cannot demote an existing administrator", async () => {
  const source = await readFile(new URL("../app/api/olv/mailboxes/route.ts", import.meta.url), "utf8");
  assert.match(source, /administrator account cannot be converted into an employee/i);
  assert.match(source, /ON CONFLICT\(organization_id,user_id\) DO NOTHING/);
  assert.doesNotMatch(source, /DO UPDATE SET role='MEMBER'/);
});
