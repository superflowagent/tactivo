-- migration/migrate.sql

-- Companies
CREATE TABLE IF NOT EXISTS companies (
  id TEXT PRIMARY KEY,
  name TEXT,
  max_class_assistants NUMERIC,
  class_block_mins NUMERIC,
  class_unenroll_mins NUMERIC,
  logo TEXT,
  open_time TEXT,
  close_time TEXT,
  default_appointment_duration NUMERIC,
  default_class_duration NUMERIC,
  domain TEXT,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Profiles (linked to auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  last_name TEXT,
  dni TEXT,
  phone TEXT,
  birth_date DATE,
  role TEXT,
  company_id TEXT REFERENCES companies(id),
  session_credits NUMERIC,
  class_credits NUMERIC,
  history TEXT,
  diagnosis TEXT,
  notes TEXT,
  allergies TEXT,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Anatomy
CREATE TABLE IF NOT EXISTS anatomy (
  id TEXT PRIMARY KEY,
  name TEXT,
  description TEXT,
  company_id TEXT REFERENCES companies(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Equipment
CREATE TABLE IF NOT EXISTS equipment (
  id TEXT PRIMARY KEY,
  name TEXT,
  description TEXT,
  company_id TEXT REFERENCES companies(id),
  file_url TEXT,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Exercises
CREATE TABLE IF NOT EXISTS exercises (
  id TEXT PRIMARY KEY,
  name TEXT,
  description TEXT,
  company_id TEXT REFERENCES companies(id),
  file_url TEXT,
  equipment_ids TEXT[],
  anatomy_ids TEXT[],
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Classes template
CREATE TABLE IF NOT EXISTS classes_template (
  id TEXT PRIMARY KEY,
  type TEXT,
  datetime timestamptz,
  duration NUMERIC,
  client_ids TEXT[],
  professional_ids TEXT[],
  company_id TEXT REFERENCES companies(id),
  notes TEXT,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Events
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  type TEXT,
  datetime timestamptz,
  duration NUMERIC,
  client_ids TEXT[],
  professional_ids TEXT[],
  company_id TEXT REFERENCES companies(id),
  cost NUMERIC,
  paid BOOLEAN DEFAULT false,
  notes TEXT,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- User cards
CREATE TABLE IF NOT EXISTS user_cards (
  id TEXT PRIMARY KEY,
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  name TEXT,
  last_name TEXT,
  company_id TEXT REFERENCES companies(id),
  role TEXT,
  photo TEXT
);

-- Indexes (keep uniqueness similar to PocketBase)
CREATE UNIQUE INDEX IF NOT EXISTS idx_companies_domain ON companies(domain) WHERE domain IS NOT NULL AND domain != '';
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_email ON auth.users(email) WHERE email IS NOT NULL AND email != '';
