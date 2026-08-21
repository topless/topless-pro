-- Production D1 held no rows when this migration was written, so both tables are
-- recreated rather than altered: SQLite cannot drop a PRIMARY KEY column, and the
-- corrections table becomes submissions with the fields a review needs. Local and
-- test databases are rebuilt the same way; re-run the fixtures or the import after
-- applying it. Later schema changes must be additive (ALTER TABLE ... ADD COLUMN) so
-- that a previous Worker version can still be rolled back to.

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

-- Every public query starts with published = 1; country and region pages filter next.
CREATE INDEX idx_beaches_published_place ON beaches(published, country_code, region);

-- Public input. kind 'report' is a correction to a listed beach; 'suggest' (a new
-- beach) arrives with the structured form later and will add its columns additively.
-- No foreign key to beaches: a report must outlive a listing that is unpublished.
-- The email is the only personal field and never leaves this database.
CREATE TABLE submissions (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL DEFAULT 'report' CHECK (kind IN ('report','suggest')),
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
