-- Better Auth manages: user, session, account, verification tables
-- This file creates the app-specific tables

CREATE TABLE IF NOT EXISTS people (
  id TEXT PRIMARY KEY,
  given_name TEXT NOT NULL,
  middle_name TEXT,
  surname TEXT,
  maiden_name TEXT,
  sex TEXT CHECK(sex IN ('M','F','other','unknown')) DEFAULT 'unknown',
  birth_date TEXT,
  birth_place TEXT,
  birth_country TEXT,
  birth_city TEXT,
  birth_state TEXT,
  death_date TEXT,
  death_place TEXT,
  death_country TEXT,
  death_city TEXT,
  death_state TEXT,
  death_cause TEXT,
  notes TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS relationships (
  id TEXT PRIMARY KEY,
  person1_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  person2_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK(type IN ('parent_child','spouse')),
  -- parent_child: person1=parent, person2=child
  -- spouse: bidirectional
  start_date TEXT,
  end_date TEXT,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS residences (
  id TEXT PRIMARY KEY,
  person_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  place TEXT NOT NULL,
  start_date TEXT,
  end_date TEXT,
  type TEXT CHECK(type IN ('residence','immigration','emigration')) DEFAULT 'residence',
  notes TEXT
);

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  person_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  doc_type TEXT CHECK(doc_type IN ('birth_certificate','death_certificate','marriage_certificate','photo','other')) DEFAULT 'other',
  cloudinary_public_id TEXT NOT NULL,
  cloudinary_url TEXT NOT NULL,
  notes TEXT,
  crop_data TEXT,
  uploaded_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Full-text search (populated via app logic on insert/update)
CREATE VIRTUAL TABLE IF NOT EXISTS people_fts USING fts5(
  id UNINDEXED,
  given_name,
  surname,
  birth_place,
  death_place,
  notes,
  content=people,
  content_rowid=rowid
);
