-- Production D1 held no rows when this migration was written, so both tables are
-- recreated rather than altered: SQLite cannot drop a PRIMARY KEY column, and the
-- corrections table becomes submissions with the fields a review needs. Local and
-- test databases are rebuilt the same way; re-run the fixtures or the import after
-- applying it.
--
-- This migration is NOT compatible with the Worker deployed before it (which selects
-- the id column and writes to corrections): once applied, that Worker cannot be
-- rolled back to — roll forward instead. From 0003 on, schema changes are additive
-- (ALTER TABLE ... ADD COLUMN) so a previous Worker version can always be restored.

DROP TABLE IF EXISTS corrections;
DROP TABLE IF EXISTS beaches;

-- The slug is the only identity of a beach: it is the URL, the importer's key and
-- the value reports refer to. Slugs are permanent; a rename is a new beach.
CREATE TABLE beaches (
  slug TEXT PRIMARY KEY CHECK (length(slug) BETWEEN 1 AND 120),
  name TEXT NOT NULL,
  country_code TEXT NOT NULL,
  country_name TEXT NOT NULL,
  region TEXT,
  municipality TEXT,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  dress_code TEXT NOT NULL CHECK (dress_code IN ('swimwear-required','topless-permitted','clothing-optional','nudity-permitted','unknown')),
  recognition TEXT NOT NULL CHECK (recognition IN ('official','tolerated','community-reported','disputed')),
  confidence TEXT NOT NULL CHECK (confidence IN ('low','medium','high')),
  summary TEXT,
  facilities_json TEXT NOT NULL DEFAULT '[]',
  source_url TEXT,
  last_verified_at TEXT,
  published INTEGER NOT NULL DEFAULT 0 CHECK (published IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Every public query starts with published = 1; country_code and region are included
-- ahead of the planned country and region pages.
CREATE INDEX idx_beaches_published_place ON beaches(published, country_code, region);

-- Public input. kind 'report' is a correction to a listed beach; other kinds arrive
-- with the structured form later, which validates the value (no CHECK, so the set can
-- grow without a rebuild). No foreign key to beaches: a listing is unpublished by the
-- importer and later removed by hand, and its submissions stay behind as history.
-- The email is the only personal field and never leaves this database.
CREATE TABLE submissions (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL DEFAULT 'report',
  beach_slug TEXT CHECK (beach_slug IS NULL OR length(beach_slug) <= 120),
  email TEXT CHECK (email IS NULL OR length(email) <= 254),
  message TEXT NOT NULL CHECK (length(message) BETWEEN 10 AND 4000),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected')),
  reviewed_at TEXT,
  resolution TEXT,
  github_issue INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_submissions_status ON submissions(status);
CREATE INDEX idx_submissions_beach_slug ON submissions(beach_slug);
