import { env, exports } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

const jsonHeaders = {
  'CF-Connecting-IP': '192.0.2.1',
  'content-type': 'application/json',
};

describe('topless.pro Worker', () => {
  it('applies security and cache headers to API responses', async () => {
    const health = await exports.default.fetch('https://topless.pro/api/health');
    expect(health.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(health.headers.get('Referrer-Policy')).toBe('no-referrer');
    expect(health.headers.get('X-Frame-Options')).toBe('DENY');
    expect(health.headers.get('Strict-Transport-Security')).toContain('max-age=31536000');
    expect(health.headers.get('Content-Security-Policy')).toContain("default-src 'self'");

    const directory = await exports.default.fetch('https://topless.pro/api/beaches');
    expect(directory.headers.get('Cache-Control')).toContain('max-age=300');

    const missing = await exports.default.fetch('https://topless.pro/api/beaches/not-a-real-beach');
    expect(missing.headers.get('Cache-Control')).toBeNull();
  });

  it('omits the CSP on local development hosts so Vite dev tooling works', async () => {
    const local = await exports.default.fetch('http://localhost/api/health');
    expect(local.headers.get('Content-Security-Policy')).toBeNull();
    expect(local.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });

  it('keeps security headers on the www redirect', async () => {
    const response = await exports.default.fetch(
      new Request('https://www.topless.pro/', { redirect: 'manual' }),
    );
    expect(response.status).toBe(308);
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });

  it('redirects www requests to the apex while preserving the path and query', async () => {
    const response = await exports.default.fetch(
      new Request('https://www.topless.pro/beaches/example?ref=www', {
        redirect: 'manual',
      }),
    );

    expect(response.status).toBe(308);
    expect(response.headers.get('Location')).toBe(
      'https://topless.pro/beaches/example?ref=www',
    );
  });

  it('serves the health check, directory, and one beach', async () => {
    const health = await exports.default.fetch('https://example.com/api/health');
    expect(health.status).toBe(200);
    await expect(health.json()).resolves.toEqual({ ok: true });

    const directory = await exports.default.fetch('https://example.com/api/beaches');
    expect(directory.status).toBe(200);
    const beaches: unknown = await directory.json();
    expect(Array.isArray(beaches)).toBe(true);
    expect(beaches).toHaveLength(4);

    const detail = await exports.default.fetch(
      'https://example.com/api/beaches/paradise-beach-mykonos',
    );
    expect(detail.status).toBe(200);
    await expect(detail.json()).resolves.toMatchObject({
      slug: 'paradise-beach-mykonos',
      dressCode: 'topless-permitted',
      facilities: ['Sunbeds', 'Food', 'Toilets'],
    });
  });

  it('injects per-beach metadata and structured data into the HTML shell', async () => {
    const response = await exports.default.fetch(
      'https://topless.pro/beaches/paradise-beach-mykonos',
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');

    const html = await response.text();
    expect(html).toContain('<title>Paradise Beach, Greece — topless.pro</title>');
    expect(html).toContain('Topless permitted (community reported, low confidence)');
    expect(html).toContain('<link rel="canonical" href="https://topless.pro/beaches/paradise-beach-mykonos">');
    expect(html).toContain('"@type":"Beach"');
    expect(html).toContain('<meta property="og:title"');
    expect(html).not.toContain('noindex');
  });

  it('injects canonical metadata on the home and about pages', async () => {
    const home = await exports.default.fetch('https://topless.pro/');
    expect(home.status).toBe(200);
    const homeHtml = await home.text();
    expect(homeHtml).toContain('<link rel="canonical" href="https://topless.pro/">');
    expect(homeHtml).toContain('<title>topless.pro — Know before you go</title>');

    const about = await exports.default.fetch('https://topless.pro/about');
    expect(about.status).toBe(200);
    await expect(about.text()).resolves.toContain(
      '<link rel="canonical" href="https://topless.pro/about">',
    );
  });

  it('returns real 404s with noindex for unknown pages and beaches', async () => {
    const junk = await exports.default.fetch('https://topless.pro/this-path-does-not-exist');
    expect(junk.status).toBe(404);
    const junkHtml = await junk.text();
    expect(junkHtml).toContain('<meta name="robots" content="noindex">');
    expect(junkHtml).toContain('<div id="root">');

    const unknownBeach = await exports.default.fetch('https://topless.pro/beaches/not-a-real-beach');
    expect(unknownBeach.status).toBe(404);
    await expect(unknownBeach.text()).resolves.toContain('<meta name="robots" content="noindex">');
  });

  it('redirects trailing-slash page URLs to their canonical form', async () => {
    const response = await exports.default.fetch(
      new Request('https://topless.pro/about/?ref=x', { redirect: 'manual' }),
    );
    expect(response.status).toBe(308);
    expect(response.headers.get('Location')).toBe('https://topless.pro/about?ref=x');
  });

  it('does not inherit the shell asset caching metadata on rendered pages', async () => {
    const page = await exports.default.fetch('https://topless.pro/beaches/paradise-beach-mykonos');
    expect(page.headers.get('ETag')).toBeNull();
    expect(page.headers.get('Cache-Control')).toContain('max-age=300');

    const notFound = await exports.default.fetch('https://topless.pro/no-such-page');
    expect(notFound.headers.get('ETag')).toBeNull();
    expect(notFound.headers.get('Cache-Control')).toBeNull();
  });

  it('lets the assets binding reject non-GET methods on page paths', async () => {
    const response = await exports.default.fetch(
      new Request('https://topless.pro/some-page', { method: 'POST' }),
    );
    expect(response.status).toBe(405);
  });

  it('counts correction message length in code points like the D1 constraint', async () => {
    const tooShort = await exports.default.fetch(
      new Request('https://topless.pro/api/corrections', {
        method: 'POST',
        headers: { ...jsonHeaders, 'CF-Connecting-IP': '192.0.2.6' },
        body: JSON.stringify({
          beachSlug: 'plage-des-eaux-vives',
          message: '😀😀😀😀😀', // 10 UTF-16 units but only 5 characters
        }),
      }),
    );
    expect(tooShort.status).toBe(400);

    const longEnough = await exports.default.fetch(
      new Request('https://topless.pro/api/corrections', {
        method: 'POST',
        headers: { ...jsonHeaders, 'CF-Connecting-IP': '192.0.2.6' },
        body: JSON.stringify({
          beachSlug: 'plage-des-eaux-vives',
          message: '😀😀😀😀😀😀😀😀😀😀',
        }),
      }),
    );
    expect(longEnough.status).toBe(201);
  });

  it('passes non-HTML assets through untouched', async () => {
    const asset = await exports.default.fetch('https://topless.pro/favicon.svg');
    expect(asset.status).toBe(200);
    expect(asset.headers.get('content-type')).toContain('image/svg+xml');
  });

  it('serves robots.txt pointing at the sitemap', async () => {
    const robots = await exports.default.fetch('https://topless.pro/robots.txt');
    expect(robots.status).toBe(200);
    expect(robots.headers.get('content-type')).toContain('text/plain');
    const body = await robots.text();
    expect(body).toContain('User-agent: *');
    expect(body).toContain('Sitemap: https://topless.pro/sitemap.xml');
  });

  it('serves a sitemap of the static pages and published beaches', async () => {
    const sitemap = await exports.default.fetch('https://topless.pro/sitemap.xml');
    expect(sitemap.status).toBe(200);
    expect(sitemap.headers.get('content-type')).toContain('application/xml');

    const body = await sitemap.text();
    expect(body).toContain('<loc>https://topless.pro/</loc>');
    expect(body).toContain('<loc>https://topless.pro/about</loc>');
    expect(body).toContain('<loc>https://topless.pro/beaches/paradise-beach-mykonos</loc>');
    expect(body).toContain('<loc>https://topless.pro/beaches/red-beach-matala</loc>');
    expect((body.match(/<url>/g) ?? []).length).toBe(6);
  });

  it('returns JSON 404 responses for missing API resources', async () => {
    const missingBeach = await exports.default.fetch(
      'https://example.com/api/beaches/not-a-real-beach',
    );
    expect(missingBeach.status).toBe(404);
    await expect(missingBeach.json()).resolves.toEqual({ error: 'Beach not found' });

    const missingRoute = await exports.default.fetch('https://example.com/api/not-found');
    expect(missingRoute.status).toBe(404);
    await expect(missingRoute.json()).resolves.toEqual({ error: 'Not found' });
  });

  it('validates correction requests and preserves beach integrity', async () => {
    const wrongType = await exports.default.fetch(
      new Request('https://example.com/api/corrections', {
        method: 'POST',
        body: '{}',
      }),
    );
    expect(wrongType.status).toBe(415);

    const malformed = await exports.default.fetch(
      new Request('https://example.com/api/corrections', {
        method: 'POST',
        headers: jsonHeaders,
        body: '{',
      }),
    );
    expect(malformed.status).toBe(400);

    const nonexistent = await exports.default.fetch(
      new Request('https://example.com/api/corrections', {
        method: 'POST',
        headers: {
          ...jsonHeaders,
          'CF-Connecting-IP': '192.0.2.2',
        },
        body: JSON.stringify({
          beachSlug: 'not-a-real-beach',
          message: 'This is long enough to be considered a correction.',
        }),
      }),
    );
    expect(nonexistent.status).toBe(404);

    const count = await env.DB.prepare(
      'SELECT count(*) AS count FROM corrections WHERE beach_slug = ?',
    ).bind('not-a-real-beach').first<number>('count');
    expect(count).toBe(0);
  });

  it('stores valid corrections and silently drops honeypot submissions', async () => {
    const valid = await exports.default.fetch(
      new Request('https://example.com/api/corrections', {
        method: 'POST',
        headers: {
          ...jsonHeaders,
          'CF-Connecting-IP': '192.0.2.3',
        },
        body: JSON.stringify({
          beachSlug: 'paradise-beach-mykonos',
          email: 'traveller@example.com',
          message: 'The signs at the entrance were updated this week.',
          website: '',
        }),
      }),
    );
    expect(valid.status).toBe(201);

    const stored = await env.DB.prepare(
      'SELECT count(*) AS count FROM corrections WHERE beach_slug = ?',
    ).bind('paradise-beach-mykonos').first<number>('count');
    expect(stored).toBe(1);

    const honeypot = await exports.default.fetch(
      new Request('https://example.com/api/corrections', {
        method: 'POST',
        headers: {
          ...jsonHeaders,
          'CF-Connecting-IP': '192.0.2.4',
        },
        body: JSON.stringify({
          beachSlug: 'paradise-beach-mykonos',
          message: 'A bot generated correction that should not be stored.',
          website: 'https://spam.example',
        }),
      }),
    );
    expect(honeypot.status).toBe(201);

    const afterHoneypot = await env.DB.prepare(
      'SELECT count(*) AS count FROM corrections WHERE beach_slug = ?',
    ).bind('paradise-beach-mykonos').first<number>('count');
    expect(afterHoneypot).toBe(1);
  });

  it('rate limits repeated corrections from the same client', async () => {
    const responses: Response[] = [];

    for (let attempt = 1; attempt <= 6; attempt += 1) {
      responses.push(await exports.default.fetch(
        new Request('https://example.com/api/corrections', {
          method: 'POST',
          headers: {
            ...jsonHeaders,
            'CF-Connecting-IP': '192.0.2.5',
          },
          body: JSON.stringify({
            beachSlug: 'red-beach-matala',
            message: `Repeated valid correction attempt number ${attempt}.`,
          }),
        }),
      ));
    }

    expect(responses.slice(0, 5).every((response) => response.status === 201)).toBe(true);
    expect(responses[5].status).toBe(429);
    expect(responses[5].headers.get('Retry-After')).toBe('60');
  });
});
