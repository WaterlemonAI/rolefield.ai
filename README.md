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
