# OLV security model

## Identity and sessions

- Passwords are Argon2id hashes with a separate server-side pepper.
- Activation and reset links use 256-bit random values; PostgreSQL stores only
  SHA-256 hashes. Tokens are expiring and consumed in locking transactions.
- Sessions use 256-bit random tokens stored as hashes. Cookies are HttpOnly,
  SameSite=Lax, Secure in production, and revocable. Password reset revokes all
  active sessions.
- Login, activation, reset, setup and webhooks are rate limited. Login and reset
  responses avoid account enumeration.
- Authenticated mutations require an exact same-origin header.

## Tenant and mailbox authorization

Every tenant-owned query includes the organization ID derived from the session.
Mailbox access is resolved through `mailbox_members`; shared addresses have no
password. Composite `(id, organization_id)` foreign keys also reject cross-
tenant relationships at the database layer. Outbound From addresses are derived
from an owned, active mailbox and revalidated by the worker.

## Email and object safety

- Raw MIME and attachments are private S3 objects with server-side encryption.
- Attachment downloads are authorized and return five-minute signed URLs.
- Filenames are stripped of traversal/control characters; size limits are
  checked before and after upload. Browser MIME types are metadata, never trust.
- Inbound HTML is allow-list sanitized; scripts, event handlers, iframes and
  dangerous protocols are removed. Remote images are not allowed.
- BCC participants remain server-side and are not exposed as recipients in
  generated visible headers by Nodemailer.

## Secrets and logs

Production startup fails if critical configuration is absent. Render generates
application secrets and prompts for AWS values. No secret is prefixed
`NEXT_PUBLIC_`. Audit metadata is reduced to safe fields; tokens, passwords,
authorization headers and email bodies are never logged. AWS errors are logged
by name only in web paths.

## Operational assumptions

Use a least-privilege IAM role restricted to the OLV SES identity,
configuration set and S3 prefix. Enable S3 Block Public Access, versioning,
default encryption, lifecycle retention and CloudTrail data events. Rotate all
webhook/session/pepper secrets after suspected exposure.
