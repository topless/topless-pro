import { Hono } from 'hono';
import type { Context } from 'hono';
import {
  ABOUT_DESCRIPTION,
  ABOUT_TITLE,
  SITE_DESCRIPTION,
  SITE_TITLE,
  confidenceLabels,
  dressCodeLabels,
  formatBeachLocation,
  formatBeachTitle,
  recognitionLabels,
} from '../src/lib/labels';
import type { Beach, Confidence, DressCode, Recognition } from '../src/types';

type AppContext = Context<{ Bindings: Env }>;

const app = new Hono<{ Bindings: Env }>();

const BEACH_COLUMNS = `
  slug, name, country_code AS countryCode, country_name AS countryName,
  region, municipality, latitude, longitude, dress_code AS dressCode,
  recognition, confidence, summary, facilities_json AS facilitiesJson,
  source_url AS sourceUrl, last_verified_at AS lastVerifiedAt
`;
const MAX_CORRECTION_BODY_BYTES = 8_192;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
// Mirrored by data/beaches.schema.json (slug.maxLength) and the validator.
const MAX_SLUG_LENGTH = 120;
const CANONICAL_HOST = 'topless.pro';
const WWW_HOST = `www.${CANONICAL_HOST}`;
const CANONICAL_ORIGIN = `https://${CANONICAL_HOST}`;
const META_DESCRIPTION_LIMIT = 160;
const PUBLIC_CACHE_CONTROL = 'public, max-age=300, stale-while-revalidate=3600';
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
  return (
    hostname === 'localhost'
    || hostname.endsWith('.localhost')
    || hostname === '[::1]'
    || hostname === '0.0.0.0'
    || /^127\./.test(hostname)
    || /^10\./.test(hostname)
    || /^192\.168\./.test(hostname)
    || /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
  );
}

interface BeachRow {
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

  if (!beachSlug || beachSlug.length > MAX_SLUG_LENGTH || !SLUG_PATTERN.test(beachSlug)) {
    return { ok: false, error: 'We couldn’t tell which beach this report is about.' };
  }

  // SQLite's length() counts code points, so the CHECK constraint does too.
  const messageLength = [...message].length;
  if (messageLength < 10 || messageLength > 4_000) {
    return { ok: false, error: 'Please write between 10 and 4,000 characters.' };
  }

  if (value.website !== undefined && typeof value.website !== 'string') {
    return { ok: false, error: 'That report couldn’t be read.' };
  }

  if (value.email !== undefined && value.email !== null && typeof value.email !== 'string') {
    return { ok: false, error: 'That email address doesn’t look right.' };
  }

  const email = typeof value.email === 'string' ? value.email.trim() : '';
  if (email && (email.length > 254 || !EMAIL_PATTERN.test(email))) {
    return { ok: false, error: 'That email address doesn’t look right.' };
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
      throw new RequestBodyError(413, 'That report is too long. Please keep it under 4,000 characters.');
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
        throw new RequestBodyError(413, 'That report is too long. Please keep it under 4,000 characters.');
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

function isApiPath(path: string): boolean {
  return path === '/api' || path.startsWith('/api/');
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function describeBeach(beach: Beach): string {
  const guidance = `${beach.name}, ${formatBeachLocation(beach)} — ${dressCodeLabels[beach.dressCode]} (${recognitionLabels[beach.recognition].toLowerCase()}, ${confidenceLabels[beach.confidence].toLowerCase()}).`;
  if (!beach.summary) return guidance;

  const combined = `${guidance} ${beach.summary}`;
  const codePoints = [...combined];
  return codePoints.length <= META_DESCRIPTION_LIMIT
    ? combined
    : `${codePoints.slice(0, META_DESCRIPTION_LIMIT - 1).join('').trimEnd()}…`;
}

function beachJsonLd(beach: Beach, description: string): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Beach',
    name: beach.name,
    url: `${CANONICAL_ORIGIN}/beaches/${beach.slug}`,
    description,
    geo: {
      '@type': 'GeoCoordinates',
      latitude: beach.latitude,
      longitude: beach.longitude,
    },
    address: {
      '@type': 'PostalAddress',
      addressCountry: beach.countryCode,
      ...(beach.municipality ? { addressLocality: beach.municipality } : {}),
      ...(beach.region ? { addressRegion: beach.region } : {}),
    },
  };
}

interface PageMeta {
  title: string;
  description: string;
  canonicalPath?: string;
  noindex?: boolean;
  jsonLd?: Record<string, unknown>;
  /** One of the static cards in public/og/; the site card when absent. */
  ogImage?: { path: string; alt: string };
}

const DEFAULT_OG_IMAGE = { path: '/og/default.png', alt: 'topless.pro — beach dress-code reference' };

function fetchShell(c: AppContext): Promise<Response> {
  return c.env.ASSETS.fetch(new Request(new URL('/', c.req.url)));
}

async function renderShell(c: AppContext, meta: PageMeta, status = 200, prefetchedShell?: Response): Promise<Response> {
  const shell = prefetchedShell ?? await fetchShell(c);

  const headExtras: string[] = [
    '<meta property="og:site_name" content="topless.pro">',
    '<meta property="og:type" content="website">',
    `<meta property="og:title" content="${escapeHtml(meta.title)}">`,
    `<meta property="og:description" content="${escapeHtml(meta.description)}">`,
    `<meta property="og:image" content="${escapeHtml(`${CANONICAL_ORIGIN}${(meta.ogImage ?? DEFAULT_OG_IMAGE).path}`)}">`,
    '<meta property="og:image:width" content="1200">',
    '<meta property="og:image:height" content="630">',
    `<meta property="og:image:alt" content="${escapeHtml((meta.ogImage ?? DEFAULT_OG_IMAGE).alt)}">`,
    '<meta name="twitter:card" content="summary_large_image">',
  ];
  if (meta.canonicalPath !== undefined) {
    const canonicalUrl = `${CANONICAL_ORIGIN}${meta.canonicalPath}`;
    headExtras.push(`<link rel="canonical" href="${escapeHtml(canonicalUrl)}">`);
    headExtras.push(`<meta property="og:url" content="${escapeHtml(canonicalUrl)}">`);
  }
  if (meta.noindex) {
    headExtras.push('<meta name="robots" content="noindex">');
  }
  if (meta.jsonLd) {
    headExtras.push(
      `<script type="application/ld+json">${JSON.stringify(meta.jsonLd).replaceAll('<', '\\u003c')}</script>`,
    );
  }

  const transformed = new HTMLRewriter()
    .on('title', {
      element(element) {
        element.setInnerContent(meta.title);
      },
    })
    .on('meta[name="description"]', {
      element(element) {
        element.setAttribute('content', meta.description);
      },
    })
    .on('head', {
      element(element) {
        element.append(`    ${headExtras.join('\n    ')}\n  `, { html: true });
      },
    })
    .transform(shell);

  // Keep only the content type: the shell asset's caching metadata (ETag,
  // Cache-Control, Last-Modified) describes the static file, not the
  // transformed page, and a shared strong ETag across different pages and
  // statuses corrupts revalidation.
  const headers = new Headers({
    'content-type': transformed.headers.get('content-type') ?? 'text/html; charset=utf-8',
  });
  if (status === 200) {
    headers.set('Cache-Control', PUBLIC_CACHE_CONTROL);
  }
  return new Response(transformed.body, { status, headers });
}

async function getPublishedBeach(db: D1Database, slug: string): Promise<Beach | null> {
  if (!SLUG_PATTERN.test(slug) || slug.length > MAX_SLUG_LENGTH) return null;

  const row = await db.prepare(
    `SELECT ${BEACH_COLUMNS}
    FROM beaches
    WHERE published = 1 AND slug = ?`,
  ).bind(slug).first<BeachRow>();

  return row === null ? null : mapBeach(row);
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

  if (url.pathname.length > 1 && url.pathname.endsWith('/')) {
    url.pathname = url.pathname.replace(/\/+$/, '');
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

  c.header('Cache-Control', PUBLIC_CACHE_CONTROL);
  return c.json(result.results.map(mapBeach));
});

app.get('/api/beaches/:slug', async (c) => {
  const beach = await getPublishedBeach(c.env.DB, c.req.param('slug'));
  if (beach === null) {
    return c.json({ error: 'Beach not found' }, 404);
  }

  c.header('Cache-Control', PUBLIC_CACHE_CONTROL);
  return c.json(beach);
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
    return c.json({ error: 'That report couldn’t be read.' }, 400);
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
    INSERT INTO submissions (id, beach_slug, email, message)
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
    return c.json({ error: 'We couldn’t find that listing. It may have been removed or not published yet.' }, 404);
  }

  return c.json({ ok: true }, 201);
});

app.get('/', (c) =>
  renderShell(c, {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    canonicalPath: '/',
  }));

app.get('/about', (c) =>
  renderShell(c, {
    title: ABOUT_TITLE,
    description: ABOUT_DESCRIPTION,
    canonicalPath: '/about',
  }));

app.get('/beaches/:slug', async (c) => {
  const [beach, shell] = await Promise.all([
    getPublishedBeach(c.env.DB, c.req.param('slug')),
    fetchShell(c),
  ]);
  if (beach === null) {
    return renderShell(c, {
      title: 'No listing here — topless.pro',
      description: SITE_DESCRIPTION,
      noindex: true,
    }, 404, shell);
  }

  const description = describeBeach(beach);
  return renderShell(c, {
    title: formatBeachTitle(beach),
    description,
    canonicalPath: `/beaches/${beach.slug}`,
    jsonLd: beachJsonLd(beach, description),
    ogImage: { path: `/og/${beach.dressCode}.png`, alt: `${beach.name}: ${dressCodeLabels[beach.dressCode]}` },
  }, 200, shell);
});

app.get('/robots.txt', (c) => {
  c.header('Cache-Control', 'public, max-age=3600');
  return c.text(`User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${CANONICAL_ORIGIN}/sitemap.xml\n`);
});

app.get('/sitemap.xml', async (c) => {
  const result = await c.env.DB.prepare(
    `SELECT slug, updated_at AS updatedAt
    FROM beaches
    WHERE published = 1
    ORDER BY slug`,
  ).all<{ slug: string; updatedAt: string }>();

  const entries = [
    { path: '/' },
    { path: '/about' },
    ...result.results.map((row) => ({
      path: `/beaches/${row.slug}`,
      lastmod: row.updatedAt.slice(0, 10),
    })),
  ];

  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries.map((entry) => {
      const lastmod = 'lastmod' in entry && entry.lastmod ? `<lastmod>${entry.lastmod}</lastmod>` : '';
      return `  <url><loc>${escapeHtml(`${CANONICAL_ORIGIN}${entry.path}`)}</loc>${lastmod}</url>`;
    }),
    '</urlset>',
    '',
  ].join('\n');

  c.header('Cache-Control', 'public, max-age=3600');
  return c.body(body, 200, { 'content-type': 'application/xml; charset=utf-8' });
});

app.notFound(async (c) => {
  const path = requestPath(c.req.raw);
  if (isApiPath(path)) {
    return c.json({ error: 'Not found' }, 404);
  }

  const asset = await c.env.ASSETS.fetch(c.req.raw);
  if (asset.status !== 404) {
    return asset;
  }

  // No such asset and no known route: serve the shell so the client-side
  // not-found page renders, but answer crawlers with an honest 404.
  await asset.body?.cancel();
  return renderShell(c, {
    title: 'Page not found — topless.pro',
    description: SITE_DESCRIPTION,
    noindex: true,
  }, 404);
});

app.onError((error, c) => {
  const path = requestPath(c.req.raw);
  console.error(JSON.stringify({
    message: 'Unhandled request error',
    error: error.message,
    method: c.req.method,
    path,
  }));

  return isApiPath(path)
    ? c.json({ error: 'Internal server error' }, 500)
    : new Response('Internal Server Error', { status: 500 });
});

export default app;
