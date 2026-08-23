CREATE TABLE IF NOT EXISTS demo_bookings (
  id BIGSERIAL PRIMARY KEY,
  booking_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  company TEXT NOT NULL,
  phone TEXT NOT NULL,
  language TEXT NOT NULL,
  use_case TEXT NOT NULL,
  attendees TEXT,
  notes TEXT,
  demo_date TEXT NOT NULL,
  demo_time TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'Asia/Dubai',
  status TEXT NOT NULL DEFAULT 'confirmed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_demo_bookings_slot
ON demo_bookings(demo_date, demo_time);

CREATE TABLE IF NOT EXISTS callback_requests (
  id BIGSERIAL PRIMARY KEY,
  request_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  company TEXT NOT NULL,
  phone TEXT NOT NULL,
  language TEXT NOT NULL,
  use_case TEXT NOT NULL,
  callback_window TEXT NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_callback_requests_created_at
ON callback_requests(created_at DESC);

CREATE TABLE IF NOT EXISTS website_inquiries (
  id BIGSERIAL PRIMARY KEY,
  inquiry_id TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL CHECK (kind IN ('contact', 'partnership')),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  company TEXT NOT NULL,
  phone TEXT,
  topic TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_website_inquiries_created_at
ON website_inquiries(created_at DESC);

CREATE TABLE IF NOT EXISTS custom_agent_requests (
  id BIGSERIAL PRIMARY KEY,
  request_id TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  gender TEXT NOT NULL,
  language TEXT NOT NULL,
  use_case TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'requested',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_custom_agent_requests_created_at
ON custom_agent_requests(created_at DESC);

-- OLV secure multi-tenant mail schema. This file is an idempotent migration
-- entrypoint so a fresh PostgreSQL database can be created with one command.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN CREATE TYPE org_role AS ENUM ('ADMIN','MEMBER'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE user_status AS ENUM ('INVITED','ACTIVE','SUSPENDED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE app_module AS ENUM ('MAILBOX','VOICE','SOCIAL','DOCUMENTS'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE mailbox_role AS ENUM ('OWNER','MEMBER'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE mailbox_type AS ENUM ('INDIVIDUAL','SHARED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE domain_state AS ENUM ('PENDING','DNS_PENDING','VERIFYING','VERIFIED','MAIL_READY','FAILED','SUSPENDED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE message_direction AS ENUM ('INBOUND','OUTBOUND'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE delivery_state AS ENUM ('DRAFT','QUEUED','SENDING','SENT','DELIVERED','BOUNCED','FAILED','COMPLAINED','RECEIVED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE participant_kind AS ENUM ('FROM','REPLY_TO','TO','CC','BCC'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS organizations (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL CHECK(length(name) BETWEEN 2 AND 160), created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS users (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL, recovery_email TEXT NOT NULL UNIQUE, password_hash TEXT, activated_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
ALTER TABLE users ADD COLUMN IF NOT EXISTS status user_status NOT NULL DEFAULT 'INVITED';
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspension_reason TEXT;
UPDATE users SET status=CASE WHEN suspended_at IS NOT NULL THEN 'SUSPENDED'::user_status WHEN activated_at IS NOT NULL THEN 'ACTIVE'::user_status ELSE 'INVITED'::user_status END;
CREATE TABLE IF NOT EXISTS organization_members (organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, role org_role NOT NULL DEFAULT 'MEMBER', created_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY(organization_id,user_id));
CREATE TABLE IF NOT EXISTS user_module_entitlements (organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, module app_module NOT NULL, enabled BOOLEAN NOT NULL DEFAULT true, assigned_by UUID REFERENCES users(id) ON DELETE SET NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY(organization_id,user_id,module), FOREIGN KEY(organization_id,user_id) REFERENCES organization_members(organization_id,user_id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS domains (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, name TEXT NOT NULL, state domain_state NOT NULL DEFAULT 'PENDING', ses_identity_arn TEXT, last_checked_at TIMESTAMPTZ, failure_reason TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(organization_id,name), UNIQUE(name));
CREATE TABLE IF NOT EXISTS domain_dns_records (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, domain_id UUID NOT NULL REFERENCES domains(id) ON DELETE CASCADE, type TEXT NOT NULL CHECK(type IN ('TXT','CNAME','MX')), host TEXT NOT NULL, value TEXT NOT NULL, purpose TEXT NOT NULL, required BOOLEAN NOT NULL DEFAULT true, verified BOOLEAN NOT NULL DEFAULT false, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(domain_id,type,host,value));
CREATE TABLE IF NOT EXISTS domain_verification_events (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, domain_id UUID NOT NULL REFERENCES domains(id) ON DELETE CASCADE, previous_state domain_state, next_state domain_state NOT NULL, details JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS departments (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, name TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(organization_id,name));
CREATE TABLE IF NOT EXISTS mailboxes (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, department_id UUID REFERENCES departments(id) ON DELETE SET NULL, name TEXT NOT NULL, type mailbox_type NOT NULL, active BOOLEAN NOT NULL DEFAULT true, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS external_mail_accounts (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, mailbox_id UUID NOT NULL REFERENCES mailboxes(id) ON DELETE CASCADE, email TEXT NOT NULL, display_name TEXT NOT NULL, imap_host TEXT NOT NULL, imap_port INTEGER NOT NULL CHECK(imap_port BETWEEN 1 AND 65535), imap_secure BOOLEAN NOT NULL DEFAULT true, smtp_host TEXT NOT NULL, smtp_port INTEGER NOT NULL CHECK(smtp_port BETWEEN 1 AND 65535), smtp_secure BOOLEAN NOT NULL DEFAULT true, username TEXT NOT NULL, secret_encrypted TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'CONNECTED' CHECK(status IN ('CONNECTED','ERROR','DISCONNECTED')), last_synced_at TIMESTAMPTZ, last_error TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(organization_id,user_id,email), UNIQUE(mailbox_id));
CREATE TABLE IF NOT EXISTS mailbox_addresses (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, mailbox_id UUID NOT NULL REFERENCES mailboxes(id) ON DELETE CASCADE, domain_id UUID NOT NULL REFERENCES domains(id) ON DELETE RESTRICT, address TEXT NOT NULL UNIQUE, is_primary BOOLEAN NOT NULL DEFAULT true, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
ALTER TABLE mailbox_addresses ALTER COLUMN domain_id DROP NOT NULL;
CREATE TABLE IF NOT EXISTS mailbox_members (organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, mailbox_id UUID NOT NULL REFERENCES mailboxes(id) ON DELETE CASCADE, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, role mailbox_role NOT NULL DEFAULT 'MEMBER', created_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY(mailbox_id,user_id));
CREATE TABLE IF NOT EXISTS contacts (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, email TEXT NOT NULL, name TEXT, first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(), last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(organization_id,email));
CREATE TABLE IF NOT EXISTS external_organizations (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, domain TEXT NOT NULL, name TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(organization_id,domain));
CREATE TABLE IF NOT EXISTS threads (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, mailbox_id UUID NOT NULL REFERENCES mailboxes(id) ON DELETE CASCADE, subject TEXT NOT NULL, normalized_subject TEXT NOT NULL, latest_at TIMESTAMPTZ NOT NULL DEFAULT now(), created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS messages (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, thread_id UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE, mailbox_id UUID NOT NULL REFERENCES mailboxes(id) ON DELETE CASCADE, internet_message_id TEXT NOT NULL, direction message_direction NOT NULL, subject TEXT NOT NULL, text_body TEXT NOT NULL DEFAULT '', html_body TEXT, raw_mime_s3_key TEXT, in_reply_to TEXT, reference_ids TEXT[] NOT NULL DEFAULT '{}', sent_at TIMESTAMPTZ, received_at TIMESTAMPTZ, state delivery_state NOT NULL, idempotency_key TEXT NOT NULL, actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL, failure_reason TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(organization_id,internet_message_id), UNIQUE(organization_id,idempotency_key));
ALTER TABLE messages ADD COLUMN IF NOT EXISTS provider_message_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_provider_id ON messages(provider_message_id) WHERE provider_message_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS message_participants (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE, kind participant_kind NOT NULL, email TEXT NOT NULL, name TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS mailbox_message_state (organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, mailbox_id UUID NOT NULL REFERENCES mailboxes(id) ON DELETE CASCADE, message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE, unread BOOLEAN NOT NULL DEFAULT true, archived BOOLEAN NOT NULL DEFAULT false, trashed BOOLEAN NOT NULL DEFAULT false, updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY(mailbox_id,message_id));
CREATE TABLE IF NOT EXISTS attachments (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, message_id UUID REFERENCES messages(id) ON DELETE CASCADE, draft_id UUID, filename TEXT NOT NULL, content_type TEXT NOT NULL, size_bytes BIGINT NOT NULL CHECK(size_bytes>=0), s3_key TEXT NOT NULL UNIQUE, content_id TEXT, inline BOOLEAN NOT NULL DEFAULT false, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS drafts (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, mailbox_id UUID NOT NULL REFERENCES mailboxes(id) ON DELETE CASCADE, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, thread_id UUID REFERENCES threads(id) ON DELETE SET NULL, to_list JSONB NOT NULL DEFAULT '[]', cc_list JSONB NOT NULL DEFAULT '[]', bcc_list JSONB NOT NULL DEFAULT '[]', subject TEXT NOT NULL DEFAULT '', text_body TEXT NOT NULL DEFAULT '', in_reply_to TEXT, reference_ids TEXT[] NOT NULL DEFAULT '{}', version INTEGER NOT NULL DEFAULT 1, updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), created_at TIMESTAMPTZ NOT NULL DEFAULT now());
DO $$ BEGIN ALTER TABLE attachments ADD CONSTRAINT attachments_draft_fk FOREIGN KEY(draft_id) REFERENCES drafts(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE TABLE IF NOT EXISTS mail_delivery_events (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, message_id UUID REFERENCES messages(id) ON DELETE SET NULL, provider_event_id TEXT NOT NULL UNIQUE, event_type TEXT NOT NULL, payload JSONB NOT NULL, occurred_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS mail_bounces (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, message_id UUID REFERENCES messages(id) ON DELETE SET NULL, recipient TEXT NOT NULL, hard BOOLEAN NOT NULL, diagnostic TEXT, occurred_at TIMESTAMPTZ NOT NULL);
CREATE TABLE IF NOT EXISTS mail_complaints (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, message_id UUID REFERENCES messages(id) ON DELETE SET NULL, recipient TEXT NOT NULL, occurred_at TIMESTAMPTZ NOT NULL);
CREATE TABLE IF NOT EXISTS account_activation_tokens (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, token_hash TEXT NOT NULL UNIQUE, expires_at TIMESTAMPTZ NOT NULL, consumed_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
ALTER TABLE account_activation_tokens ADD COLUMN IF NOT EXISTS delivery_status TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE account_activation_tokens ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;
ALTER TABLE account_activation_tokens ADD COLUMN IF NOT EXISTS delivery_error TEXT;
CREATE TABLE IF NOT EXISTS password_reset_tokens (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, token_hash TEXT NOT NULL UNIQUE, expires_at TIMESTAMPTZ NOT NULL, consumed_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS sessions (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, token_hash TEXT NOT NULL UNIQUE, expires_at TIMESTAMPTZ NOT NULL, revoked_at TIMESTAMPTZ, ip_hash TEXT, user_agent TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS audit_logs (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL, action TEXT NOT NULL, target_type TEXT, target_id TEXT, request_metadata JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS processed_jobs (idempotency_key TEXT PRIMARY KEY, job_type TEXT NOT NULL, completed_at TIMESTAMPTZ NOT NULL DEFAULT now());

CREATE INDEX IF NOT EXISTS idx_org_members_user ON organization_members(user_id,organization_id);
CREATE INDEX IF NOT EXISTS idx_entitlements_user ON user_module_entitlements(user_id,organization_id) WHERE enabled;
CREATE INDEX IF NOT EXISTS idx_mailbox_members_user ON mailbox_members(user_id,mailbox_id);
CREATE INDEX IF NOT EXISTS idx_external_mail_accounts_user ON external_mail_accounts(organization_id,user_id,status);
CREATE INDEX IF NOT EXISTS idx_threads_mailbox_latest ON threads(organization_id,mailbox_id,latest_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_thread_time ON messages(organization_id,thread_id,COALESCE(received_at,sent_at,created_at));
CREATE INDEX IF NOT EXISTS idx_messages_reply ON messages(organization_id,internet_message_id,in_reply_to);
CREATE INDEX IF NOT EXISTS idx_participants_message ON message_participants(organization_id,message_id,kind);
CREATE INDEX IF NOT EXISTS idx_message_state_folder ON mailbox_message_state(organization_id,mailbox_id,trashed,archived,unread);
CREATE INDEX IF NOT EXISTS idx_drafts_owner ON drafts(organization_id,user_id,updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_messages ON messages USING GIN(to_tsvector('simple',coalesce(subject,'')||' '||coalesce(text_body,'')));
CREATE INDEX IF NOT EXISTS idx_audit_org_time ON audit_logs(organization_id,created_at DESC);

-- Composite tenant keys prevent a valid row ID from being paired with the
-- wrong organization ID, even if application authorization regresses.
DO $$ BEGIN ALTER TABLE domains ADD CONSTRAINT domains_id_org_unique UNIQUE(id,organization_id); EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE departments ADD CONSTRAINT departments_id_org_unique UNIQUE(id,organization_id); EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE mailboxes ADD CONSTRAINT mailboxes_id_org_unique UNIQUE(id,organization_id); EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE threads ADD CONSTRAINT threads_id_org_unique UNIQUE(id,organization_id); EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE messages ADD CONSTRAINT messages_id_org_unique UNIQUE(id,organization_id); EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE drafts ADD CONSTRAINT drafts_id_org_unique UNIQUE(id,organization_id); EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE mailbox_members ADD CONSTRAINT mailbox_members_mailbox_org_fk FOREIGN KEY(mailbox_id,organization_id) REFERENCES mailboxes(id,organization_id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE mailbox_addresses ADD CONSTRAINT mailbox_addresses_mailbox_org_fk FOREIGN KEY(mailbox_id,organization_id) REFERENCES mailboxes(id,organization_id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE threads ADD CONSTRAINT threads_mailbox_org_fk FOREIGN KEY(mailbox_id,organization_id) REFERENCES mailboxes(id,organization_id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE messages ADD CONSTRAINT messages_thread_org_fk FOREIGN KEY(thread_id,organization_id) REFERENCES threads(id,organization_id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE messages ADD CONSTRAINT messages_mailbox_org_fk FOREIGN KEY(mailbox_id,organization_id) REFERENCES mailboxes(id,organization_id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE message_participants ADD CONSTRAINT participants_message_org_fk FOREIGN KEY(message_id,organization_id) REFERENCES messages(id,organization_id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE mailbox_message_state ADD CONSTRAINT state_message_org_fk FOREIGN KEY(message_id,organization_id) REFERENCES messages(id,organization_id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE mailbox_message_state ADD CONSTRAINT state_mailbox_org_fk FOREIGN KEY(mailbox_id,organization_id) REFERENCES mailboxes(id,organization_id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE drafts ADD CONSTRAINT drafts_mailbox_org_fk FOREIGN KEY(mailbox_id,organization_id) REFERENCES mailboxes(id,organization_id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
