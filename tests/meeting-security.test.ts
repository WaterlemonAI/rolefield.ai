import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { visibilitySql } from "../lib/meeting/access";
import {
  actionSchema,
  actionUpdateSchema,
  createMeetingSchema,
  evidenceSchema,
  nudgeSchema,
  preparationSchema,
} from "../lib/meeting/validation";

const member = {
  userId: "11111111-1111-4111-8111-111111111111",
  organizationId: "22222222-2222-4222-8222-222222222222",
  email: "member@example.com",
  name: "Member",
  orgRole: "MEMBER" as const,
  modules: ["MEETINGS" as const],
};

const fixture = {
  title: "Quarterly review",
  startsAt: "2026-09-01T10:00:00+00:00",
  endsAt: "2026-09-01T11:00:00+00:00",
};

test("meeting mutations reject malformed and oversized input", () => {
  assert.equal(createMeetingSchema.safeParse({ ...fixture, title: " " }).success, false);
  assert.equal(createMeetingSchema.safeParse({ ...fixture, title: "x".repeat(201) }).success, false);
  assert.equal(createMeetingSchema.safeParse({ ...fixture, participants: new Array(501).fill({ email: "p@example.com" }) }).success, false);
  assert.equal(createMeetingSchema.safeParse({ ...fixture, participants: [{ email: "not-an-email" }] }).success, false);
  assert.equal(createMeetingSchema.safeParse({ ...fixture, startsAt: "2026-09-01T12:00:00Z" }).success, false);
  assert.equal(nudgeSchema.safeParse({ message: " " }).success, false);
  assert.equal(nudgeSchema.safeParse({ message: "x".repeat(2001) }).success, false);
  assert.equal(preparationSchema.safeParse({ status: "READY", agenda: "x".repeat(30001) }).success, false);
  assert.equal(actionUpdateSchema.safeParse({}).success, false);
});

test("visibility is closed and private artifacts bind to an owner", () => {
  assert.equal(evidenceSchema.safeParse({ kind: "TRANSCRIPT", content: "Evidence", visibility: "WORLD" }).success, false);
  assert.equal(actionSchema.safeParse({ title: "Follow up", visibility: "TEAM_PRIVATE" }).success, false);

  const filter = visibilitySql("artifact", member, 7);
  assert.match(filter.sql, /artifact\.visibility='USER_PRIVATE' AND artifact\.owner_user_id=\$7/);
  assert.match(filter.sql, /artifact\.visibility='ADMIN_PRIVATE' AND \$8='ADMIN'/);
  assert.deepEqual(filter.values, [member.userId, member.orgRole]);
});

test("meeting tables use composite tenant foreign keys and nudge tenancy is invariant", async () => {
  const sql = await readFile(new URL("../db/schema.sql", import.meta.url), "utf8");
  for (const constraint of [
    "meeting_org_meeting_fk",
    "meeting_participant_meeting_fk",
    "meeting_preparation_meeting_fk",
    "meeting_action_meeting_fk",
    "meeting_action_evidence_fk",
    "meeting_nudge_meeting_fk",
    "meeting_nudge_evidence_fk",
  ]) {
    assert.match(sql, new RegExp(`ADD CONSTRAINT ${constraint}[^;]+\\([\\s\\S]*organization_id[\\s\\S]*\\)[^;]+\\([\\s\\S]*organization_id[\\s\\S]*\\)`));
  }
  assert.match(sql, /meeting_nudges[^;]+CHECK\(organization_id=recipient_organization_id\)/);
  assert.match(sql, /meeting_evidence[^;]+CHECK\(\(visibility='USER_PRIVATE'\)=\(owner_user_id IS NOT NULL\)\)/);
  assert.match(sql, /meeting_action_items[^;]+CHECK\(\(visibility='USER_PRIVATE'\)=\(owner_user_id IS NOT NULL\)\)/);
});

test("every meeting API authenticates, scopes tenant queries, and guards mutations", async () => {
  const paths = [
    "../app/api/meetings/route.ts",
    "../app/api/meetings/[id]/route.ts",
    "../app/api/meetings/[id]/preparation/route.ts",
    "../app/api/meetings/[id]/evidence/route.ts",
    "../app/api/meetings/[id]/actions/route.ts",
    "../app/api/meetings/[id]/actions/[actionId]/route.ts",
    "../app/api/meetings/[id]/nudges/route.ts",
  ];
  for (const path of paths) {
    const source = await readFile(new URL(path, import.meta.url), "utf8");
    assert.match(source, /meetingPrincipal\(request(?:,true)?\)/, `${path} must authenticate through the meeting module guard`);
    assert.match(source, /organization_id/, `${path} must include tenant scope in persistence queries`);
    if (/export async function (POST|PUT|PATCH|DELETE)/.test(source)) {
      assert.match(source, /meetingPrincipal\(request,true\)/, `${path} mutations must enforce same-origin protection`);
    }
  }
});

test("organization-private nudges cannot be addressed to another tenant", async () => {
  const [createRoute, detailRoute] = await Promise.all([
    readFile(new URL("../app/api/meetings/[id]/nudges/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/meetings/[id]/route.ts", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(createRoute, /recipientOrganizationId\s*[:=]\s*(?:d|parsed\.data)\./);
  assert.match(createRoute, /recipient_organization_id[^;]+VALUES\(\$1,\$2,\$2,/);
  assert.match(createRoute, /requireMeeting\(c,p,id!?\)/);
  assert.match(detailRoute, /meeting_id=\$1 AND organization_id=\$2 AND recipient_organization_id=\$2/);
});

test("meeting page is not a public route and does not render fabricated operational claims", async () => {
  const [page, workspace] = await Promise.all([
    readFile(new URL("../app/meet/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/meet/workspace.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(page, /requireModule\(["']MEETINGS["']\)/);
  assert.match(page, /<MeetingWorkspace\s+principal=/);
  assert.doesNotMatch(workspace, /Enterprise secure|AI ready|Recording in progress|recording is active/i);
  assert.match(workspace, /Media is not configured/);
});

test("MEETINGS can be provisioned and revoked through every supported entitlement path", async () => {
  const sources = await Promise.all([
    "../app/api/olv/admin/route.ts",
    "../app/api/olv/mailboxes/route.ts",
    "../app/app/admin/admin-console.tsx",
    "../scripts/bootstrap-owner.mjs",
  ].map((path) => readFile(new URL(path, import.meta.url), "utf8")));
  for (const source of sources) assert.match(source, /MEETINGS/);
  assert.match(sources[0], /modules: z\.array\(moduleSchema\)\.max\(6\)/);
  assert.match(sources[1], /modules: z\.array\(modules\)\.max\(6\)/);
});

test("action evidence lookup enforces that the actor can see the evidence", async () => {
  const route = await readFile(new URL("../app/api/meetings/[id]/actions/route.ts", import.meta.url), "utf8");
  assert.match(
    route,
    /visibilitySql\("e",p,4\)[\s\S]*meeting_evidence[^;]+access\.sql/,
    "An action must not reference another user's USER_PRIVATE or an inaccessible ADMIN_PRIVATE evidence record",
  );
});
