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
