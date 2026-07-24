CREATE TABLE IF NOT EXISTS beaches (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
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

CREATE TABLE IF NOT EXISTS corrections (
  id TEXT PRIMARY KEY,
  beach_slug TEXT NOT NULL REFERENCES beaches(slug) ON UPDATE CASCADE ON DELETE RESTRICT,
  email TEXT CHECK (email IS NULL OR length(email) <= 254),
  message TEXT NOT NULL CHECK (length(message) BETWEEN 10 AND 4000),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_beaches_country ON beaches(country_code);
CREATE INDEX IF NOT EXISTS idx_beaches_dress_code ON beaches(dress_code);
CREATE INDEX IF NOT EXISTS idx_corrections_status ON corrections(status);
