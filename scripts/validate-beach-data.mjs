import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import schema from '../data/beaches.schema.json' with { type: 'json' };
import { dataFilePath } from '../shared/place.mjs';
import { DATA_ROOT, REQUIRED_D1_FIELDS, SCHEMA_FILE, findBeachFiles } from './lib/beach-data.mjs';

// The JSON Schema is the one place the enums, the slug rule and the field lists are
// written down; editors get them as autocomplete, this script enforces them in CI,
// together with the cross-field policy rules a schema cannot express.
const BEACH_PROPERTIES = schema.definitions.beach.properties;
const enumValues = (name) => new Set(BEACH_PROPERTIES[name].enum.filter((value) => value !== null));
const DRESS_CODES = enumValues('dressCode');
const RECOGNITION_LEVELS = enumValues('recognition');
const CONFIDENCE_LEVELS = enumValues('confidence');
const SLUG_PATTERN = new RegExp(BEACH_PROPERTIES.slug.pattern);
// Mirrors MAX_SLUG_LENGTH in worker/index.ts: a longer slug would be a silent 404.
const MAX_SLUG_LENGTH = BEACH_PROPERTIES.slug.maxLength;
const COUNTRY_CODE_PATTERN = new RegExp(schema.properties.scope.properties.countryCode.pattern);
const KNOWN_FILE_KEYS = new Set(Object.keys(schema.properties));
const KNOWN_SCOPE_KEYS = new Set(Object.keys(schema.properties.scope.properties));
const KNOWN_BEACH_KEYS = new Set(Object.keys(BEACH_PROPERTIES));
// One day of slack: "today" east of UTC is still yesterday in UTC.
const DAY_MS = 24 * 60 * 60 * 1000;
// sourceUrl must support the dress-code claim. These services locate a place
// or hide the destination, so they never can. host is an exact hostname or a
// pattern; pathPrefix limits the rule to that product's URL space.
const MAP_PIN = 'is a map pin; it locates the beach but cannot support the dress-code claim';
const REJECTED_SOURCE_RULES = [
  { host: 'maps.app.goo.gl', reason: MAP_PIN },
  { host: 'maps.apple.com', reason: MAP_PIN },
  { host: 'osm.org', reason: MAP_PIN },
  { host: /(^|\.)maps\.google\.[a-z.]+$/, reason: MAP_PIN },
  { host: /(^|\.)openstreetmap\.org$/, reason: MAP_PIN },
  { host: /(^|\.)google\.[a-z.]+$/, pathPrefix: '/maps', reason: MAP_PIN },
  { host: /(^|\.)bing\.com$/, pathPrefix: '/maps', reason: MAP_PIN },
  { host: 'goo.gl', reason: 'is a link shortener; cite the destination it points at instead' },
];

const errors = [];
const drafts = [];
const seenSlugs = new Map();

function addError(file, field, message) {
  errors.push(`${path.relative(process.cwd(), file)}:${field}: ${message}`);
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isIsoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function isHttpUrl(value) {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function rejectedSourceReason(value) {
  try {
    const url = new URL(value);
    const rule = REJECTED_SOURCE_RULES.find(({ host, pathPrefix }) => {
      const hostMatches = typeof host === 'string' ? url.hostname === host : host.test(url.hostname);
      return hostMatches && (pathPrefix === undefined || url.pathname.startsWith(pathPrefix));
    });
    return rule ? rule.reason : null;
  } catch {
    return null;
  }
}

function validateKnownKeys(file, field, value, known) {
  for (const key of Object.keys(value)) {
    if (!known.has(key)) {
      addError(file, `${field}.${key}`, 'is not a known field');
    }
  }
}

function validateNullableEnum(file, field, value, allowedValues) {
  if (value !== null && !allowedValues.has(value)) {
    addError(file, field, 'must be null or a supported value');
  }
}

function validateCoordinate(file, field, value, minimum, maximum) {
  if (value !== null && (typeof value !== 'number' || value < minimum || value > maximum)) {
    addError(file, field, `must be null or a number between ${minimum} and ${maximum}`);
  }
}

function validateBeach(file, beach, index) {
  const field = `beaches[${index}]`;
  if (!isRecord(beach)) {
    addError(file, field, 'must be an object');
    return;
  }
  validateKnownKeys(file, field, beach, KNOWN_BEACH_KEYS);

  if (!isNonEmptyString(beach.slug) || !SLUG_PATTERN.test(beach.slug)) {
    addError(file, `${field}.slug`, 'must be a lowercase URL slug');
  } else if (beach.slug.length > MAX_SLUG_LENGTH) {
    addError(file, `${field}.slug`, `must be at most ${MAX_SLUG_LENGTH} characters`);
  } else if (seenSlugs.has(beach.slug)) {
    addError(file, `${field}.slug`, `duplicates ${seenSlugs.get(beach.slug)}`);
  } else {
    seenSlugs.set(beach.slug, path.relative(process.cwd(), file));
  }

  if (!isNonEmptyString(beach.name)) {
    addError(file, `${field}.name`, 'must be a non-empty string');
  }

  validateCoordinate(file, `${field}.latitude`, beach.latitude, -90, 90);
  validateCoordinate(file, `${field}.longitude`, beach.longitude, -180, 180);
  validateNullableEnum(file, `${field}.dressCode`, beach.dressCode, DRESS_CODES);
  validateNullableEnum(file, `${field}.recognition`, beach.recognition, RECOGNITION_LEVELS);
  validateNullableEnum(file, `${field}.confidence`, beach.confidence, CONFIDENCE_LEVELS);

  if (beach.municipality !== null && !isNonEmptyString(beach.municipality)) {
    addError(file, `${field}.municipality`, 'must be null or a non-empty string');
  }
  if (beach.summary !== null && typeof beach.summary !== 'string') {
    addError(file, `${field}.summary`, 'must be null or a string');
  }
  if (!Array.isArray(beach.facilities)
    || !beach.facilities.every((facility) => isNonEmptyString(facility))) {
    addError(file, `${field}.facilities`, 'must be an array of non-empty strings');
  }
  if (beach.sourceUrl !== null && !isHttpUrl(beach.sourceUrl)) {
    addError(file, `${field}.sourceUrl`, 'must be null or an HTTP(S) URL');
  } else if (beach.sourceUrl !== null) {
    const reason = rejectedSourceReason(beach.sourceUrl);
    if (reason !== null) {
      addError(file, `${field}.sourceUrl`, reason);
    }
  }
  if (beach.lastVerifiedAt !== null && !isIsoDate(beach.lastVerifiedAt)) {
    addError(file, `${field}.lastVerifiedAt`, 'must be null or an ISO date');
  } else if (beach.lastVerifiedAt !== null && Date.parse(`${beach.lastVerifiedAt}T00:00:00Z`) > Date.now() + DAY_MS) {
    addError(file, `${field}.lastVerifiedAt`, 'cannot be in the future');
  }
  if (typeof beach.published !== 'boolean') {
    addError(file, `${field}.published`, 'must be a boolean');
  }

  const missing = REQUIRED_D1_FIELDS
    .filter((name) => beach[name] === null || beach[name] === undefined);

  if (missing.length > 0) {
    drafts.push({ slug: beach.slug, missing });
    if (beach.published === true) {
      addError(file, `${field}.published`, 'cannot be true while required D1 fields are missing');
    }
  }

  if (beach.confidence === 'high' && !isNonEmptyString(beach.sourceUrl)) {
    addError(
      file,
      `${field}.confidence`,
      'high confidence requires a sourceUrl that supports the dress-code claim',
    );
  }

  if (beach.published === true) {
    const requiredToPublish = [
      ['sourceUrl', isNonEmptyString(beach.sourceUrl)],
      ['summary', isNonEmptyString(beach.summary)],
      ['lastVerifiedAt', isNonEmptyString(beach.lastVerifiedAt)],
    ];
    for (const [name, present] of requiredToPublish) {
      if (!present) {
        addError(
          file,
          `${field}.${name}`,
          `is required before a beach can be published`,
        );
      }
    }
  }
}

function validateFile(file, data) {
  if (!isRecord(data)) {
    addError(file, '$', 'must contain a JSON object');
    return;
  }
  validateKnownKeys(file, '$', data, KNOWN_FILE_KEYS);
  if (data.schemaVersion !== 1) {
    addError(file, 'schemaVersion', 'must be 1');
  }
  // Optional, but when present it must point at the repo's schema so editors get the
  // autocomplete the file promises.
  if (data.$schema !== undefined) {
    const expected = path.relative(path.dirname(file), SCHEMA_FILE).split(path.sep).join('/');
    if (data.$schema !== expected) {
      addError(file, '$schema', `must be "${expected}"`);
    }
  }
  if (!isRecord(data.scope)) {
    addError(file, 'scope', 'must be an object');
  } else {
    validateKnownKeys(file, 'scope', data.scope, KNOWN_SCOPE_KEYS);
    for (const property of ['countryCode', 'countryName', 'region']) {
      if (!isNonEmptyString(data.scope[property])) {
        addError(file, `scope.${property}`, 'must be a non-empty string');
      }
    }
    if (isNonEmptyString(data.scope.countryCode) && !COUNTRY_CODE_PATTERN.test(data.scope.countryCode)) {
      addError(file, 'scope.countryCode', 'must be an upper-case ISO 3166-1 alpha-2 code');
    }

    // The folder is derived from the scope (shared/place.mjs), which is how the site links
    // a listing to this file's history on GitHub.
    if (['countryCode', 'region'].every((property) => isNonEmptyString(data.scope[property]))) {
      const expected = dataFilePath(data.scope);
      const actual = path.relative(process.cwd(), file).split(path.sep).join('/');
      if (actual !== expected) {
        addError(file, 'scope', `belongs at ${expected} (derived from countryCode and region)`);
      }
    }
  }

  if (!Array.isArray(data.beaches)) {
    addError(file, 'beaches', 'must be an array');
    return;
  }
  data.beaches.forEach((beach, index) => validateBeach(file, beach, index));
}

const files = await findBeachFiles(DATA_ROOT);
if (files.length === 0) {
  console.error('No data/**/beaches.json files found.');
  process.exit(1);
}

for (const file of files) {
  try {
    const data = JSON.parse(await readFile(file, 'utf8'));
    validateFile(file, data);
  } catch (error) {
    addError(file, '$', error instanceof Error ? error.message : String(error));
  }
}

if (errors.length > 0) {
  console.error(`Beach data validation failed with ${errors.length} error(s):`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

const readyCount = seenSlugs.size - drafts.length;
console.log(
  `Validated ${files.length} beach data file(s): `
  + `${readyCount} D1-ready, ${drafts.length} incomplete.`,
);
for (const draft of drafts) {
  console.log(`- ${draft.slug}: missing ${draft.missing.join(', ')}`);
}
