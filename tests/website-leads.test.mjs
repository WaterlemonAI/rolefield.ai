import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const demoRoute = await readFile(new URL("../app/api/demos/route.ts", import.meta.url), "utf8");
const subscriberRoute = await readFile(new URL("../app/api/subscribers/route.ts", import.meta.url), "utf8");
const store = await readFile(new URL("../lib/website-lead-store.ts", import.meta.url), "utf8");
const template = await readFile(new URL("../infra/cloudformation/rolefield-website-data.yaml", import.meta.url), "utf8");

test("demo booking is persisted before email delivery is attempted", () => {
  assert.ok(demoRoute.indexOf("await storeDemoBooking") < demoRoute.indexOf("await sendLeadEmails"));
  assert.match(demoRoute, /catch \(error\).*Demo saved, but email delivery failed/s);
});

test("subscriber is persisted before notification delivery is attempted", () => {
  assert.ok(subscriberRoute.indexOf("await storeSubscriber") < subscriberRoute.indexOf("await sendSubscriberNotification"));
  assert.match(subscriberRoute, /catch \(error\).*Subscriber saved, but notification delivery failed/s);
});

test("website lead store targets the retained AWS DynamoDB tables", () => {
  assert.match(store, /DynamoDBDocumentClient/);
  assert.match(store, /rolefield-website-data-subscribers/);
  assert.match(store, /rolefield-website-data-demo-bookings/);
  assert.match(template, /DeletionPolicy: Retain/g);
  assert.match(template, /PointInTimeRecoveryEnabled: true/g);
  assert.match(template, /BillingMode: PAY_PER_REQUEST/g);
});
