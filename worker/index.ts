import { Hono } from 'hono';
import type { Beach, Confidence, DressCode, Recognition } from '../src/types';

const app = new Hono<{ Bindings: Env }>();

const BEACH_COLUMNS = `
  id, slug, name, country_code AS countryCode, country_name AS countryName,
  region, municipality, latitude, longitude, dress_code AS dressCode,
  recognition, confidence, summary, facilities_json AS facilitiesJson,
  source_url AS sourceUrl, last_verified_at AS lastVerifiedAt
`;
const MAX_CORRECTION_BODY_BYTES = 8_192;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CANONICAL_HOST = 'topless.pro';
const WWW_HOST = `www.${CANONICAL_HOST}`;
const API_CACHE_CONTROL = 'public, max-age=300, stale-while-revalidate=3600';
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  'upgrade-insecure-requests',
].join('; ');

function isLocalHostname(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.localhost');
}

interface BeachRow {
  id: string;
  slug: string;
  name: string;
  countryCode: string;
  countryName: string;
  region: string | null;
  municipality: string | null;
  latitude: number;
  longitude: number;
  dressCode: DressCode;
  recognition: Recognition;
  confidence: Confidence;
  summary: string | null;
  facilitiesJson: string;
  sourceUrl: string | null;
  lastVerifiedAt: string | null;
}

interface Correction {
  beachSlug: string;
  email: string | null;
  message: string;
}

type CorrectionValidation =
  | { ok: true; value: Correction }
  | { ok: false; error: string };

class RequestBodyError extends Error {
  constructor(
    readonly status: 400 | 413 | 415,
    message: string,
  ) {
    super(message);
  }
}

function parseFacilities(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) && parsed.every((item) => typeof item === 'string') ? parsed : [];
  } catch {
    return [];
  }
}

function mapBeach(row: BeachRow): Beach {
  const beach: Beach = {
    id: row.id,
    slug: row.slug,
    name: row.name,
    countryCode: row.countryCode,
    countryName: row.countryName,
    latitude: row.latitude,
    longitude: row.longitude,
    dressCode: row.dressCode,
    recognition: row.recognition,
    confidence: row.confidence,
    facilities: parseFacilities(row.facilitiesJson),
  };

  if (row.region !== null) beach.region = row.region;
  if (row.municipality !== null) beach.municipality = row.municipality;
  if (row.summary !== null) beach.summary = row.summary;
  if (row.sourceUrl !== null) beach.sourceUrl = row.sourceUrl;
  if (row.lastVerifiedAt !== null) beach.lastVerifiedAt = row.lastVerifiedAt;

  return beach;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateCorrection(value: Record<string, unknown>): CorrectionValidation {
  const beachSlug = typeof value.beachSlug === 'string' ? value.beachSlug.trim() : '';
  const message = typeof value.message === 'string' ? value.message.trim() : '';

  if (!beachSlug || beachSlug.length > 120 || !SLUG_PATTERN.test(beachSlug)) {
    return { ok: false, error: 'Invalid beach' };
  }

  if (message.length < 10 || message.length > 4_000) {
    return { ok: false, error: 'Message must be between 10 and 4000 characters' };
  }

  if (value.website !== undefined && typeof value.website !== 'string') {
    return { ok: false, error: 'Invalid correction' };
  }

  if (value.email !== undefined && value.email !== null && typeof value.email !== 'string') {
    return { ok: false, error: 'Invalid email' };
  }

  const email = typeof value.email === 'string' ? value.email.trim() : '';
  if (email && (email.length > 254 || !EMAIL_PATTERN.test(email))) {
    return { ok: false, error: 'Invalid email' };
  }

  return {
    ok: true,
    value: {
      beachSlug,
      email: email || null,
      message,
    },
  };
}

async function readBoundedJson(request: Request): Promise<unknown> {
  const contentType = request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase();
  if (contentType !== 'application/json') {
    throw new RequestBodyError(415, 'Content-Type must be application/json');
  }

  const declaredLength = request.headers.get('content-length');
  if (declaredLength !== null) {
    const size = Number(declaredLength);
    if (!Number.isSafeInteger(size) || size < 0) {
      throw new RequestBodyError(400, 'Invalid Content-Length');
    }
    if (size > MAX_CORRECTION_BODY_BYTES) {
      throw new RequestBodyError(413, 'Correction is too large');
    }
  }

  if (request.body === null) {
    throw new RequestBodyError(400, 'Invalid JSON');
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      size += value.byteLength;
      if (size > MAX_CORRECTION_BODY_BYTES) {
        await reader.cancel();
        throw new RequestBodyError(413, 'Correction is too large');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(bytes));
  } catch {
    throw new RequestBodyError(400, 'Invalid JSON');
  }
}

function requestPath(request: Request): string {
  return new URL(request.url).pathname;
}

app.use('*', async (c, next) => {
  await next();

  // 101 responses carry a live WebSocket (Vite HMR in dev); reconstructing
  // them would break the upgrade, and headers are irrelevant there anyway.
  if (c.res.status === 101) return;

  // Redirect and asset responses can carry immutable headers, so rebuild.
  const res = new Response(c.res.body, c.res);
  res.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('Referrer-Policy', 'no-referrer');
  res.headers.set('Permissions-Policy', 'camera=(), geolocation=(), microphone=()');
  res.headers.set('Cross-Origin-Opener-Policy', 'same-origin');

  // Vite dev mode injects an inline bootstrap script that a strict CSP
  // would block, so the policy applies everywhere except local hosts.
  if (!isLocalHostname(new URL(c.req.url).hostname)) {
    res.headers.set('Content-Security-Policy', CONTENT_SECURITY_POLICY);
  }

  c.res = res;
});

app.use('*', async (c, next) => {
  const url = new URL(c.req.url);
  if (url.hostname === WWW_HOST) {
    url.hostname = CANONICAL_HOST;
    return Response.redirect(url.toString(), 308);
  }

  await next();
});

app.get('/api/health', (c) => c.json({ ok: true }));

app.get('/api/beaches', async (c) => {
  const result = await c.env.DB.prepare(
    `SELECT ${BEACH_COLUMNS}
    FROM beaches
    WHERE published = 1
    ORDER BY country_name, name`,
  ).all<BeachRow>();

  c.header('Cache-Control', API_CACHE_CONTROL);
  return c.json(result.results.map(mapBeach));
});

app.get('/api/beaches/:slug', async (c) => {
  const slug = c.req.param('slug');
  if (!SLUG_PATTERN.test(slug) || slug.length > 120) {
    return c.json({ error: 'Beach not found' }, 404);
  }

  const row = await c.env.DB.prepare(
    `SELECT ${BEACH_COLUMNS}
    FROM beaches
    WHERE published = 1 AND slug = ?`,
  ).bind(slug).first<BeachRow>();

  if (row === null) {
    return c.json({ error: 'Beach not found' }, 404);
  }

  c.header('Cache-Control', API_CACHE_CONTROL);
  return c.json(mapBeach(row));
});

app.post('/api/corrections', async (c) => {
  const origin = c.req.header('origin');
  if (origin && origin !== new URL(c.req.url).origin) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  let body: unknown;
  try {
    body = await readBoundedJson(c.req.raw);
  } catch (error) {
    if (error instanceof RequestBodyError) {
      return c.json({ error: error.message }, error.status);
    }
    throw error;
  }

  if (!isRecord(body)) {
    return c.json({ error: 'Invalid correction' }, 400);
  }

  if (typeof body.website === 'string' && body.website.trim()) {
    return c.json({ ok: true }, 201);
  }

  const correction = validateCorrection(body);
  if (!correction.ok) {
    return c.json({ error: correction.error }, 400);
  }

  const clientKey = c.req.header('CF-Connecting-IP') ?? 'local-development';
  const rateLimit = await c.env.CORRECTION_RATE_LIMITER.limit({
    key: `correction:${clientKey}`,
  });
  if (!rateLimit.success) {
    c.header('Retry-After', '60');
    return c.json({ error: 'Too many corrections. Please try again later.' }, 429);
  }

  const result = await c.env.DB.prepare(`
    INSERT INTO corrections (id, beach_slug, email, message)
    SELECT ?, slug, ?, ?
    FROM beaches
    WHERE slug = ? AND published = 1
  `)
    .bind(
      crypto.randomUUID(),
      correction.value.email,
      correction.value.message,
      correction.value.beachSlug,
    )
    .run();

  if (result.meta.changes === 0) {
    return c.json({ error: 'Beach not found' }, 404);
  }

  return c.json({ ok: true }, 201);
});

app.notFound((c) => {
  const path = requestPath(c.req.raw);
  return path === '/api' || path.startsWith('/api/')
    ? c.json({ error: 'Not found' }, 404)
    : c.env.ASSETS.fetch(c.req.raw);
});

app.onError((error, c) => {
  const path = requestPath(c.req.raw);
  console.error(JSON.stringify({
    message: 'Unhandled request error',
    error: error.message,
    method: c.req.method,
    path,
  }));

  return path === '/api' || path.startsWith('/api/')
    ? c.json({ error: 'Internal server error' }, 500)
    : new Response('Internal Server Error', { status: 500 });
});

export default app;
