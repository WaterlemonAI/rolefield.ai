import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const region = process.env.AWS_REGION || "us-east-1";
const subscriberTable = process.env.WEBSITE_SUBSCRIBER_TABLE || "rolefield-website-data-subscribers";
const demoBookingTable = process.env.WEBSITE_DEMO_BOOKING_TABLE || "rolefield-website-data-demo-bookings";

const globalForLeadStore = globalThis as unknown as { rolefieldLeadStore?: DynamoDBDocumentClient };

function client() {
  globalForLeadStore.rolefieldLeadStore ??= DynamoDBDocumentClient.from(
    new DynamoDBClient({ region, maxAttempts: 4 }),
    { marshallOptions: { removeUndefinedValues: true } },
  );
  return globalForLeadStore.rolefieldLeadStore;
}

export async function storeSubscriber(input: { email: string; source: string }) {
  const now = new Date().toISOString();
  await client().send(new UpdateCommand({
    TableName: subscriberTable,
    Key: { email: input.email },
    UpdateExpression: "SET #source = :source, #status = :status, updatedAt = :now, createdAt = if_not_exists(createdAt, :now)",
    ExpressionAttributeNames: { "#source": "source", "#status": "status" },
    ExpressionAttributeValues: { ":source": input.source, ":status": "subscribed", ":now": now },
  }));
  return { storedAt: now };
}

export type DemoBookingRecord = {
  bookingId: string;
  name: string;
  email: string;
  company: string;
  phone: string;
  language: string;
  useCase: string;
  attendees?: string;
  notes?: string;
  date: string;
  time: string;
};

export async function storeDemoBooking(booking: DemoBookingRecord) {
  const createdAt = new Date().toISOString();
  await client().send(new PutCommand({
    TableName: demoBookingTable,
    Item: {
      ...booking,
      slotKey: `${booking.date}#${booking.time}`,
      timezone: "Asia/Dubai",
      status: "confirmed",
      createdAt,
    },
    ConditionExpression: "attribute_not_exists(bookingId)",
  }));
  return { storedAt: createdAt };
}

export const websiteLeadTables = { subscriberTable, demoBookingTable, region };
