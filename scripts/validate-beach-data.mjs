import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const DATA_ROOT = path.join(process.cwd(), 'data');
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
// Map services identify a place but cannot support a dress-code claim, and
// shorteners hide whatever they point at.
const LOCATION_PIN_HOSTS = new Set([
  'maps.app.goo.gl',
  'goo.gl',
  'maps.apple.com',
  'osm.org',
]);
const LOCATION_PIN_HOST_PATTERNS = [
  /(^|\.)maps\.google\.[a-z.]+$/,
  /(^|\.)openstreetmap\.org$/,
];
// Hosts that are pins only when the path is their maps product.
const LOCATION_PIN_PATH_PREFIXES = [
  [/(^|\.)google\.[a-z.]+$/, '/maps'],
  [/(^|\.)bing\.com$/, '/maps'],
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

function isLocationPinUrl(value) {
  try {
    const url = new URL(value);
    if (LOCATION_PIN_HOSTS.has(url.hostname)) return true;
    if (LOCATION_PIN_HOST_PATTERNS.some((pattern) => pattern.test(url.hostname))) return true;
    return LOCATION_PIN_PATH_PREFIXES.some(
      ([pattern, prefix]) => pattern.test(url.hostname) && url.pathname.startsWith(prefix),
    );
  } catch {
    return false;
  }
}

async function findBeachFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await findBeachFiles(entryPath));
    } else if (entry.isFile() && entry.name === 'beaches.json') {
      files.push(entryPath);
    }
  }

  return files.sort();
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
  } else if (beach.sourceUrl !== null && isLocationPinUrl(beach.sourceUrl)) {
    addError(
      file,
      `${field}.sourceUrl`,
      'is a map pin; it locates the beach but cannot support the dress-code claim',
    );
  }
  if (beach.lastVerifiedAt !== null && !isIsoDate(beach.lastVerifiedAt)) {
    addError(file, `${field}.lastVerifiedAt`, 'must be null or an ISO date');
  }
  if (typeof beach.published !== 'boolean') {
    addError(file, `${field}.published`, 'must be a boolean');
  }

  const requiredForD1 = [
    ['latitude', beach.latitude],
    ['longitude', beach.longitude],
    ['dressCode', beach.dressCode],
    ['recognition', beach.recognition],
    ['confidence', beach.confidence],
  ];
  const missing = requiredForD1
    .filter(([, value]) => value === null || value === undefined)
    .map(([name]) => name);

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
