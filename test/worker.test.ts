import { env, exports } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

const jsonHeaders = {
  'CF-Connecting-IP': '192.0.2.1',
  'content-type': 'application/json',
};

describe('topless.pro Worker', () => {
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
