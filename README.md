# RoleField GCC

RoleField's bilingual GCC website, built with standard Next.js and PostgreSQL.

## Local development

Requirements:

- Node.js 22.13 or newer
- PostgreSQL

```bash
cp .env.example .env.local
npm install
npm run db:migrate
npm run dev
```

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
```

## Deploying on Render

The included `render.yaml` provisions:

- a Node web service for the Next.js application;
- a Render PostgreSQL database;
- `DATABASE_URL` wiring;
- a health check at `/api/health`;
- automatic deployments from the connected branch.

Create a new Blueprint in Render and select the Git repository containing this
project. The start command runs the idempotent PostgreSQL schema migration before
starting Next.js on Render's assigned port.

The existing Sites deployment is separate and remains live until its DNS or URL
is intentionally replaced.
