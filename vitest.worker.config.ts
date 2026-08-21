import { readFileSync } from 'node:fs';
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';

const shellHtml = readFileSync('./index.html', 'utf8');

export default defineConfig({
  plugins: [
    cloudflareTest(async () => ({
      wrangler: { configPath: './wrangler.jsonc' },
      miniflare: {
        bindings: {
          TEST_MIGRATIONS: await readD1Migrations('./migrations'),
          TEST_FIXTURES: await readD1Migrations('./fixtures'),
        },
        serviceBindings: {
          // Stand-in for the Static Assets binding: serves the SPA shell for
          // page paths and a small SVG for asset-like paths, mirroring
          // production single-page-application fallback behaviour.
          ASSETS(request: Request) {
            // Mirror the production asset-worker with not_found_handling
            // "none" (verified against vite preview): missing paths are 404
            // for any method; existing assets reject non-GET/HEAD with 405.
            const url = new URL(request.url);
            const isShell = url.pathname === '/' || url.pathname === '/index.html';
            if (!isShell && !url.pathname.endsWith('.svg')) {
              return new Response('Not Found', {
                status: 404,
                headers: { 'content-type': 'text/plain; charset=utf-8' },
              });
            }
            if (request.method !== 'GET' && request.method !== 'HEAD') {
              return new Response('Method Not Allowed', { status: 405 });
            }
            if (isShell) {
              // Production emits a strong ETag for the shell; include one so
              // tests can assert the Worker strips it from transformed pages.
              return new Response(shellHtml, {
                headers: { 'content-type': 'text/html; charset=utf-8', etag: '"test-shell-etag"' },
              });
            }
            return new Response('<svg xmlns="http://www.w3.org/2000/svg"/>', {
              headers: { 'content-type': 'image/svg+xml', etag: '"test-asset-etag"' },
            });
          },
        },
      },
    })),
  ],
  test: {
    include: ['test/**/*.test.ts'],
    setupFiles: ['./test/apply-migrations.ts'],
  },
});
