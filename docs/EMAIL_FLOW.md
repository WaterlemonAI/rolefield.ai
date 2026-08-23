# OLV email flow

## Inbound

1. A verified domain publishes the SES inbound MX record shown by OLV.
2. The SES receipt rule stores the untouched RFC 5322 message in the private
   S3 bucket. S3 default encryption and Block Public Access must be enabled.
3. The receipt action invokes the small event bridge described below. It calls
   `POST /api/olv/inbound` with the object key, provider event ID, and
   `x-olv-webhook-secret`.
4. The web service writes a stable BullMQ job to Render Key Value. Duplicate
   event IDs resolve to the same queue job.
5. The worker reads the raw object, parses it with `postal-mime`, resolves only
   explicitly-created recipient addresses, selects a thread using Message-ID,
   In-Reply-To and References, sanitizes HTML, stores attachments as separate
   private S3 objects, and commits normalized state in PostgreSQL.
6. `processed_jobs` and the unique `(organization_id,internet_message_id)` key
   make replay safe. Raw MIME remains in S3 for recovery.

Unknown recipients are not provisioned and do not appear in an Inbox. Configure
the SES receipt rule to reject recipients outside the verified address set when
operational automation is added.

## Outbound

1. The API derives the organization and user from the server session, verifies
   active mailbox membership, and derives the From address from
   `mailbox_addresses`. The browser cannot submit an arbitrary From value.
2. The API commits a `QUEUED` message, normalized participants, mailbox state,
   and an audit record in one PostgreSQL transaction.
3. BullMQ hands the stable job to the worker. The worker re-checks address
   ownership, loads authorized attachments from S3, builds RFC-compliant MIME
   using Nodemailer, and sends raw bytes through SES v2.
4. SES acceptance changes the state to `SENT`, not `DELIVERED`.
5. SES configuration-set events enter `/api/olv/events`; the worker persists
   each event idempotently and applies DELIVERED, BOUNCED, COMPLAINED or FAILED.

## AWS event bridges

SES receipt actions cannot directly call a Render URL. Use an AWS Lambda behind
the S3 notification/SNS topic to POST this minimal JSON:

```json
{ "eventId": "aws-event-id", "s3Key": "raw/domain/object.eml" }
```

Delivery-event bridge payload:

```json
{
  "eventId": "ses-event-id",
  "type": "Delivery",
  "messageId": "<internet-message-id>",
  "organizationId": "uuid",
  "timestamp": "2026-08-23T00:00:00Z",
  "recipients": ["recipient@example.com"]
}
```

Both bridges must send the matching 32-byte webhook secret. Retry non-2xx
responses with bounded exponential backoff and a dead-letter queue.
