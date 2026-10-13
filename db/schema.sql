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
ALTER TYPE app_module ADD VALUE IF NOT EXISTS 'CALENDAR';
ALTER TYPE app_module ADD VALUE IF NOT EXISTS 'MEETINGS';
DO $$ BEGIN CREATE TYPE mailbox_role AS ENUM ('OWNER','MEMBER'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE mailbox_type AS ENUM ('INDIVIDUAL','SHARED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE domain_state AS ENUM ('PENDING','DNS_PENDING','VERIFYING','VERIFIED','MAIL_READY','FAILED','SUSPENDED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE message_direction AS ENUM ('INBOUND','OUTBOUND'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE delivery_state AS ENUM ('DRAFT','QUEUED','SENDING','SENT','DELIVERED','BOUNCED','FAILED','COMPLAINED','RECEIVED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE participant_kind AS ENUM ('FROM','REPLY_TO','TO','CC','BCC'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE meeting_status AS ENUM ('SCHEDULED','IN_PROGRESS','COMPLETED','CANCELLED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE meeting_visibility AS ENUM ('PUBLIC_MEETING','ORGANIZATION_PRIVATE','USER_PRIVATE','ADMIN_PRIVATE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE preparation_status AS ENUM ('NOT_STARTED','IN_PROGRESS','READY'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE action_item_status AS ENUM ('OPEN','IN_PROGRESS','COMPLETED','CANCELLED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS organizations (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL CHECK(length(name) BETWEEN 2 AND 160), created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS users (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL, recovery_email TEXT NOT NULL UNIQUE, password_hash TEXT, activated_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
ALTER TABLE users ADD COLUMN IF NOT EXISTS status user_status NOT NULL DEFAULT 'INVITED';
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspension_reason TEXT;
UPDATE users SET status=CASE WHEN suspended_at IS NOT NULL THEN 'SUSPENDED'::user_status WHEN activated_at IS NOT NULL THEN 'ACTIVE'::user_status ELSE 'INVITED'::user_status END;
CREATE TABLE IF NOT EXISTS organization_members (organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, role org_role NOT NULL DEFAULT 'MEMBER', created_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY(organization_id,user_id));
CREATE TABLE IF NOT EXISTS user_module_entitlements (organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, module app_module NOT NULL, enabled BOOLEAN NOT NULL DEFAULT true, assigned_by UUID REFERENCES users(id) ON DELETE SET NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY(organization_id,user_id,module), FOREIGN KEY(organization_id,user_id) REFERENCES organization_members(organization_id,user_id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS calendar_events (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, title VARCHAR(200) NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 200), description TEXT, location VARCHAR(300), starts_at TIMESTAMPTZ NOT NULL, ends_at TIMESTAMPTZ NOT NULL, all_day BOOLEAN NOT NULL DEFAULT false, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), FOREIGN KEY(organization_id,owner_user_id) REFERENCES organization_members(organization_id,user_id) ON DELETE CASCADE, CHECK(ends_at > starts_at));
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
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

-- Meeting intelligence. Composite foreign keys make tenant boundaries database-enforced.
CREATE TABLE IF NOT EXISTS meetings (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT, calendar_event_id UUID NOT NULL, title VARCHAR(200) NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 200), description TEXT, starts_at TIMESTAMPTZ NOT NULL, ends_at TIMESTAMPTZ NOT NULL, timezone VARCHAR(80) NOT NULL DEFAULT 'UTC', location VARCHAR(300), status meeting_status NOT NULL DEFAULT 'SCHEDULED', recording_requested BOOLEAN NOT NULL DEFAULT false, transcription_requested BOOLEAN NOT NULL DEFAULT false, idempotency_key VARCHAR(200), created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), CHECK(ends_at>starts_at), UNIQUE(organization_id,idempotency_key), FOREIGN KEY(organization_id,created_by) REFERENCES organization_members(organization_id,user_id) ON DELETE RESTRICT);
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS calendar_event_id UUID;
DO $$ DECLARE item RECORD; linked_id UUID; BEGIN FOR item IN SELECT * FROM meetings WHERE calendar_event_id IS NULL LOOP INSERT INTO calendar_events(organization_id,owner_user_id,title,description,location,starts_at,ends_at) VALUES(item.organization_id,item.created_by,item.title,item.description,item.location,item.starts_at,item.ends_at) RETURNING id INTO linked_id; UPDATE meetings SET calendar_event_id=linked_id WHERE id=item.id AND organization_id=item.organization_id; END LOOP; END $$;
ALTER TABLE meetings ALTER COLUMN calendar_event_id SET NOT NULL;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS recording_requested BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS transcription_requested BOOLEAN NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS meeting_organizations (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), meeting_id UUID NOT NULL, organization_id UUID NOT NULL, represented_organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE, external_name VARCHAR(200), external_domain VARCHAR(255), created_at TIMESTAMPTZ NOT NULL DEFAULT now(), CHECK(represented_organization_id IS NOT NULL OR external_name IS NOT NULL));
CREATE UNIQUE INDEX IF NOT EXISTS idx_meeting_org_internal_unique ON meeting_organizations(meeting_id,organization_id,represented_organization_id) WHERE represented_organization_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_meeting_org_external_unique ON meeting_organizations(meeting_id,organization_id,lower(external_name)) WHERE represented_organization_id IS NULL;
CREATE TABLE IF NOT EXISTS meeting_participants (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), meeting_id UUID NOT NULL, organization_id UUID NOT NULL, user_id UUID REFERENCES users(id) ON DELETE SET NULL, email VARCHAR(320) NOT NULL, name VARCHAR(200), participant_organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL, organization_name VARCHAR(200), role VARCHAR(80) NOT NULL DEFAULT 'ATTENDEE', created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(meeting_id,organization_id,email));
CREATE TABLE IF NOT EXISTS meeting_preparations (meeting_id UUID NOT NULL, organization_id UUID NOT NULL, owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, status preparation_status NOT NULL DEFAULT 'NOT_STARTED', agenda TEXT NOT NULL DEFAULT '', objectives TEXT NOT NULL DEFAULT '', brief TEXT NOT NULL DEFAULT '', updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY(meeting_id,organization_id,owner_user_id));
CREATE TABLE IF NOT EXISTS meeting_evidence (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), meeting_id UUID NOT NULL, organization_id UUID NOT NULL, created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT, kind VARCHAR(60) NOT NULL CHECK(length(trim(kind))>0), content TEXT NOT NULL CHECK(length(trim(content))>0), source_uri TEXT, occurred_at TIMESTAMPTZ, visibility meeting_visibility NOT NULL DEFAULT 'ORGANIZATION_PRIVATE', owner_user_id UUID REFERENCES users(id) ON DELETE CASCADE, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), CHECK((visibility='USER_PRIVATE')=(owner_user_id IS NOT NULL)));
CREATE TABLE IF NOT EXISTS meeting_action_items (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), meeting_id UUID NOT NULL, organization_id UUID NOT NULL, created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT, assignee_user_id UUID REFERENCES users(id) ON DELETE SET NULL, title VARCHAR(300) NOT NULL CHECK(length(trim(title))>0), description TEXT, due_at TIMESTAMPTZ, status action_item_status NOT NULL DEFAULT 'OPEN', visibility meeting_visibility NOT NULL DEFAULT 'ORGANIZATION_PRIVATE', owner_user_id UUID REFERENCES users(id) ON DELETE CASCADE, evidence_id UUID, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), CHECK((visibility='USER_PRIVATE')=(owner_user_id IS NOT NULL)));
CREATE TABLE IF NOT EXISTS meeting_nudges (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), meeting_id UUID NOT NULL, organization_id UUID NOT NULL, recipient_organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT, message TEXT NOT NULL CHECK(length(trim(message)) BETWEEN 1 AND 2000), evidence_id UUID, idempotency_key VARCHAR(200) NOT NULL, visibility meeting_visibility NOT NULL DEFAULT 'ORGANIZATION_PRIVATE' CHECK(visibility='ORGANIZATION_PRIVATE'), created_at TIMESTAMPTZ NOT NULL DEFAULT now(), CHECK(organization_id=recipient_organization_id), UNIQUE(organization_id,meeting_id,idempotency_key));
CREATE TABLE IF NOT EXISTS meeting_invitations (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), meeting_id UUID NOT NULL, organization_id UUID NOT NULL, participant_id UUID NOT NULL, created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT, token_hash CHAR(64) NOT NULL UNIQUE, expires_at TIMESTAMPTZ NOT NULL, revoked_at TIMESTAMPTZ, delivery_status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK(delivery_status IN ('PENDING','SENT','FAILED')), delivered_at TIMESTAMPTZ, delivery_error TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), CHECK(expires_at>created_at));
CREATE TABLE IF NOT EXISTS meeting_invitation_outbox (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, invitation_id UUID NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','PROCESSING','SENT','FAILED')), attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts>=0), next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(), last_error TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(invitation_id));
ALTER TABLE meeting_invitation_outbox ADD COLUMN IF NOT EXISTS encrypted_join_url TEXT;
ALTER TABLE meeting_invitation_outbox ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;
ALTER TABLE meeting_invitation_outbox ADD COLUMN IF NOT EXISTS lease_token_hash CHAR(64);
UPDATE meeting_invitation_outbox SET status='FAILED',last_error='Legacy invitation requires manual reissue.' WHERE encrypted_join_url IS NULL AND status IN ('PENDING','PROCESSING');
ALTER TABLE meeting_nudges ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(200);
UPDATE meeting_nudges SET idempotency_key='legacy:'||id::text WHERE idempotency_key IS NULL;
ALTER TABLE meeting_nudges ALTER COLUMN idempotency_key SET NOT NULL;
DO $$ BEGIN ALTER TABLE meeting_nudges ADD CONSTRAINT meeting_nudges_idempotency_unique UNIQUE(organization_id,meeting_id,idempotency_key); EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_org_members_user ON organization_members(user_id,organization_id);
CREATE INDEX IF NOT EXISTS idx_entitlements_user ON user_module_entitlements(user_id,organization_id) WHERE enabled;
CREATE INDEX IF NOT EXISTS idx_calendar_events_owner_time ON calendar_events(organization_id,owner_user_id,starts_at,ends_at);
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
CREATE INDEX IF NOT EXISTS idx_meetings_org_time ON meetings(organization_id,starts_at DESC);
CREATE INDEX IF NOT EXISTS idx_meeting_participants_meeting ON meeting_participants(organization_id,meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_actions_meeting ON meeting_action_items(organization_id,meeting_id,status);
CREATE INDEX IF NOT EXISTS idx_meeting_evidence_meeting ON meeting_evidence(organization_id,meeting_id,created_at);
CREATE INDEX IF NOT EXISTS idx_meeting_nudges_recipient ON meeting_nudges(recipient_organization_id,meeting_id,created_at);
CREATE INDEX IF NOT EXISTS idx_meeting_invitations_participant ON meeting_invitations(organization_id,meeting_id,participant_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_meeting_invitation_outbox_pending ON meeting_invitation_outbox(status,next_attempt_at) WHERE status IN ('PENDING','FAILED');

-- Composite tenant keys prevent a valid row ID from being paired with the
-- wrong organization ID, even if application authorization regresses.
DO $$ BEGIN ALTER TABLE domains ADD CONSTRAINT domains_id_org_unique UNIQUE(id,organization_id); EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE departments ADD CONSTRAINT departments_id_org_unique UNIQUE(id,organization_id); EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE mailboxes ADD CONSTRAINT mailboxes_id_org_unique UNIQUE(id,organization_id); EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE threads ADD CONSTRAINT threads_id_org_unique UNIQUE(id,organization_id); EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE messages ADD CONSTRAINT messages_id_org_unique UNIQUE(id,organization_id); EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE drafts ADD CONSTRAINT drafts_id_org_unique UNIQUE(id,organization_id); EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE meetings ADD CONSTRAINT meetings_id_org_unique UNIQUE(id,organization_id); EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE calendar_events ADD CONSTRAINT calendar_events_id_org_unique UNIQUE(id,organization_id); EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE meeting_evidence ADD CONSTRAINT meeting_evidence_id_org_unique UNIQUE(id,organization_id); EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE meeting_evidence ADD CONSTRAINT meeting_evidence_id_meeting_org_unique UNIQUE(id,meeting_id,organization_id); EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE meeting_organizations ADD CONSTRAINT meeting_org_meeting_fk FOREIGN KEY(meeting_id,organization_id) REFERENCES meetings(id,organization_id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE meeting_participants ADD CONSTRAINT meeting_participant_meeting_fk FOREIGN KEY(meeting_id,organization_id) REFERENCES meetings(id,organization_id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE meeting_preparations ADD CONSTRAINT meeting_preparation_meeting_fk FOREIGN KEY(meeting_id,organization_id) REFERENCES meetings(id,organization_id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE meeting_action_items ADD CONSTRAINT meeting_action_meeting_fk FOREIGN KEY(meeting_id,organization_id) REFERENCES meetings(id,organization_id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE meeting_action_items DROP CONSTRAINT IF EXISTS meeting_action_evidence_fk;
DO $$ BEGIN ALTER TABLE meeting_action_items ADD CONSTRAINT meeting_action_evidence_fk FOREIGN KEY(evidence_id,meeting_id,organization_id) REFERENCES meeting_evidence(id,meeting_id,organization_id) ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE meeting_nudges ADD CONSTRAINT meeting_nudge_meeting_fk FOREIGN KEY(meeting_id,organization_id) REFERENCES meetings(id,organization_id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE meeting_nudges DROP CONSTRAINT IF EXISTS meeting_nudge_evidence_fk;
DO $$ BEGIN ALTER TABLE meeting_nudges ADD CONSTRAINT meeting_nudge_evidence_fk FOREIGN KEY(evidence_id,meeting_id,organization_id) REFERENCES meeting_evidence(id,meeting_id,organization_id) ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE meetings ADD CONSTRAINT meetings_calendar_event_fk FOREIGN KEY(calendar_event_id,organization_id) REFERENCES calendar_events(id,organization_id) ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE meeting_invitations ADD CONSTRAINT meeting_invitation_meeting_fk FOREIGN KEY(meeting_id,organization_id) REFERENCES meetings(id,organization_id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE meeting_participants ADD CONSTRAINT meeting_participants_id_meeting_org_unique UNIQUE(id,meeting_id,organization_id); EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
ALTER TABLE meeting_invitations DROP CONSTRAINT IF EXISTS meeting_invitation_participant_fk;
DO $$ BEGIN ALTER TABLE meeting_invitations ADD CONSTRAINT meeting_invitation_participant_fk FOREIGN KEY(participant_id,meeting_id,organization_id) REFERENCES meeting_participants(id,meeting_id,organization_id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE meeting_invitations ADD CONSTRAINT meeting_invitations_id_org_unique UNIQUE(id,organization_id); EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE meeting_invitation_outbox ADD CONSTRAINT meeting_invitation_outbox_invitation_fk FOREIGN KEY(invitation_id,organization_id) REFERENCES meeting_invitations(id,organization_id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE mailbox_members ADD CONSTRAINT mailbox_members_mailbox_org_fk FOREIGN KEY(mailbox_id,organization_id) REFERENCES mailboxes(id,organization_id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE mailbox_addresses ADD CONSTRAINT mailbox_addresses_mailbox_org_fk FOREIGN KEY(mailbox_id,organization_id) REFERENCES mailboxes(id,organization_id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE threads ADD CONSTRAINT threads_mailbox_org_fk FOREIGN KEY(mailbox_id,organization_id) REFERENCES mailboxes(id,organization_id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE messages ADD CONSTRAINT messages_thread_org_fk FOREIGN KEY(thread_id,organization_id) REFERENCES threads(id,organization_id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE messages ADD CONSTRAINT messages_mailbox_org_fk FOREIGN KEY(mailbox_id,organization_id) REFERENCES mailboxes(id,organization_id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE message_participants ADD CONSTRAINT participants_message_org_fk FOREIGN KEY(message_id,organization_id) REFERENCES messages(id,organization_id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE mailbox_message_state ADD CONSTRAINT state_message_org_fk FOREIGN KEY(message_id,organization_id) REFERENCES messages(id,organization_id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE mailbox_message_state ADD CONSTRAINT state_mailbox_org_fk FOREIGN KEY(mailbox_id,organization_id) REFERENCES mailboxes(id,organization_id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE drafts ADD CONSTRAINT drafts_mailbox_org_fk FOREIGN KEY(mailbox_id,organization_id) REFERENCES mailboxes(id,organization_id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
