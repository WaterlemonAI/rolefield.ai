# RoleField and OLV

RoleField's bilingual GCC site and the OLV secure organizational-email product.
OLV uses Next.js/Node.js, PostgreSQL, BullMQ on Render Key Value, AWS SES for
transport, and private AWS S3 objects for raw MIME and attachments.

## Local development

Requirements:

- Node.js 22.13 or newer
- PostgreSQL
- Redis/Valkey
- AWS credentials with SES and private S3 access for real mail paths

```bash
cp .env.example .env.local
npm install
npm run db:migrate
npm run dev
```

Run the worker in a second terminal:

```bash
npm run worker
```

## OLV product

Create a workspace at `/setup`. OLV registers the domain with SES, persists the
exact DKIM/MX/SPF/DMARC records, and emails a one-time activation link to the
administrator's external recovery email. After activation, `/login` opens the
database-backed mailbox. `/app/admin` verifies SES and public DNS and creates
individual or shared mailboxes only after the domain reaches `MAIL_READY`.

The mail UI implements Inbox, Sent, Drafts, Archive, Trash, PostgreSQL search,
compose and thread reading. The APIs enforce organization and mailbox access;
the worker owns MIME parsing/generation and all SES transitions. See
`docs/EMAIL_FLOW.md` and `docs/SECURITY.md`.

## Database and migrations

`db/schema.sql` is the reproducible idempotent migration entrypoint. It creates
the existing marketing tables plus 26 normalized OLV tables, enum constraints,
tenant-safe composite foreign keys and search/authorization indexes.

```bash
npm run db:migrate
```

Run it twice against a fresh database to verify idempotence.

## AWS setup

1. Create a private S3 bucket in `S3_REGION`. Enable Block Public Access,
   versioning, default encryption and lifecycle retention for raw MIME.
2. Grant the web/worker identity only `s3:GetObject`, `s3:PutObject` on that
   bucket and the required SES v2 identity/send operations.
3. Move SES out of sandbox or verify every test recipient. Configure
   `SES_CONFIGURATION_SET` with delivery, bounce, complaint, reject and send
   events.
4. Create an SES receipt rule for each OLV domain: recipient validation, S3 raw
   message action, then the bounded-retry event bridge documented in
   `docs/EMAIL_FLOW.md`.
5. Authenticate `INVITATION_FROM_EMAIL`; it sends activation/reset mail before
   the customer's new domain is ready.
6. Add the exact records shown in `/app/admin` at the customer's DNS provider,
   then use **Verify configuration**. OLV queries SES and public DNS and never
   marks a domain mail-ready early.

For local AWS testing, use real sandbox resources. Production adapters are not
replaced by mocks; automated tests isolate MIME and provider boundaries.

## Lead notifications with Brevo

Demo bookings and callback requests are always saved to PostgreSQL first. When
Brevo is configured, the site also sends a lead notification to the RoleField
team and an acknowledgement to the prospect.

1. Authenticate `mail.rolefield.ai` in Brevo and register the sender address.
2. Create a sending API key.
3. Configure these values locally and in the Render service environment:
   `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME`,
   `LEAD_NOTIFICATION_EMAIL`, and `REPLY_TO_EMAIL`.

The website uses Brevo templates 1–4 for demo and callback notifications.
Templates 5–7 provide a demo reminder, demo follow-up, and reusable customer
communication email for later workflows.

The API key must stay server-side and must not be prefixed with `NEXT_PUBLIC_`.
Without it, lead capture still works and email delivery is skipped.

## Validation

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm audit --omit=dev
```

With a disposable migrated PostgreSQL database:

```bash
TEST_DATABASE_URL=postgresql://... npx tsx --test tests/db.test.ts
```

## Deploying on Render

The included `render.yaml` provisions:

- a Node web service with a pre-deploy migration and health check;
- a graceful Node background worker;
- managed PostgreSQL 16 with internal connection wiring;
- a private, no-eviction Render Key Value queue;
- generated session/pepper/encryption/webhook secrets;
- Dashboard prompts for AWS, bucket, URL and SES values.

Create a Blueprint from this repository, enter every `sync: false` value, and
deploy the web and worker together. PostgreSQL and Key Value stay private. The
web service binds Render's `PORT`; the worker handles SIGTERM and drains jobs.
Run `render blueprints validate` with Render CLI 2.7+ before provisioning.

The existing Sites deployment is separate and remains live until its DNS or URL
is intentionally replaced.
