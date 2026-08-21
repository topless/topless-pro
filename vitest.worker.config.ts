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
            const url = new URL(request.url);
            if (url.pathname.endsWith('.svg')) {
              return new Response('<svg xmlns="http://www.w3.org/2000/svg"/>', {
                headers: { 'content-type': 'image/svg+xml' },
              });
            }
            return new Response(shellHtml, {
              headers: { 'content-type': 'text/html; charset=utf-8' },
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
