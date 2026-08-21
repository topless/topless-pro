import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { DATA_ROOT, REQUIRED_D1_FIELDS, findBeachFiles } from './lib/beach-data.mjs';
const DRESS_CODES = new Set([
  'swimwear-required',
  'topless-permitted',
  'clothing-optional',
  'nudity-permitted',
  'unknown',
]);
const RECOGNITION_LEVELS = new Set([
  'official',
  'tolerated',
  'community-reported',
  'disputed',
]);
const CONFIDENCE_LEVELS = new Set(['low', 'medium', 'high']);
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

  if (!isNonEmptyString(beach.slug) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(beach.slug)) {
    addError(file, `${field}.slug`, 'must be a lowercase URL slug');
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
  if (data.schemaVersion !== 1) {
    addError(file, 'schemaVersion', 'must be 1');
  }
  if (!isRecord(data.scope)) {
    addError(file, 'scope', 'must be an object');
  } else {
    for (const property of ['countryCode', 'countryName', 'region', 'municipality']) {
      if (!isNonEmptyString(data.scope[property])) {
        addError(file, `scope.${property}`, 'must be a non-empty string');
      }
    }

    const countryFolder = path.relative(DATA_ROOT, file).split(path.sep)[0];
    if (isNonEmptyString(data.scope.countryCode)
      && countryFolder !== data.scope.countryCode.toLowerCase()) {
      addError(file, 'scope.countryCode', `does not match country folder "${countryFolder}"`);
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
