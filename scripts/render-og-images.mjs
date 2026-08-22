import { execFileSync } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

// Renders the static OpenGraph cards in public/og/: one per dress code and a site default.
// Run by hand when the labels or palette change (needs rsvg-convert, e.g. brew install
// librsvg); the PNGs are committed. Colours and labels mirror src/styles.css and labels.ts.
const CARDS = {
  default: { label: null },
  'swimwear-required': { label: 'Swimwear expected', fill: '#dcecf4', ink: '#244f68' },
  'topless-permitted': { label: 'Topless accepted', fill: '#9fcbc2', ink: '#123d37' },
  'clothing-optional': { label: 'Clothing optional', fill: '#3f7f75', ink: '#ffffff' },
  'nudity-permitted': { label: 'Nudity accepted', fill: '#1f5f57', ink: '#ffffff' },
  unknown: { label: 'Dress code unknown', fill: '#f7f4ea', ink: '#4e514c', dashed: true },
};
const FONT = "'Helvetica Neue', Helvetica, Arial, sans-serif";

function svg({ label, fill, ink, dashed }) {
  const chip = label === null ? '' : `
  <rect x="80" y="292" width="${Math.round(label.length * 36 + 96)}" height="120" rx="14" fill="${fill}"
        stroke="${dashed ? '#6f7f7a' : 'none'}" stroke-width="4" stroke-dasharray="${dashed ? '14 10' : 'none'}"/>
  <text x="128" y="374" font-family="${FONT}" font-size="64" font-weight="700" fill="${ink}">${label}</text>`;
  const tagline = label === null
    ? '<text x="80" y="352" font-family="' + FONT + '" font-size="60" font-weight="700" fill="#17322f">Allowed, tolerated</text><text x="80" y="424" font-family="' + FONT + '" font-size="60" font-weight="700" fill="#17322f">or just hearsay?</text>'
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#f7f4ea"/>
  <rect width="1200" height="96" fill="#173f3a"/>
  <text x="80" y="62" font-family="${FONT}" font-size="40" font-weight="700" fill="#ffffff">topless<tspan font-weight="400">.pro</tspan></text>
  <text x="80" y="190" font-family="${FONT}" font-size="26" font-weight="700" letter-spacing="3" fill="#51625f">BEACH DRESS-CODE REFERENCE</text>${chip}${tagline}
  <text x="80" y="560" font-family="${FONT}" font-size="30" fill="#51625f">The official rule, the local custom and the source — kept apart.</text>
</svg>
`;
}

const outDir = path.join(process.cwd(), 'public', 'og');
const tmpDir = path.join(process.cwd(), '.wrangler', 'og');
await mkdir(outDir, { recursive: true });
await mkdir(tmpDir, { recursive: true });
for (const [name, card] of Object.entries(CARDS)) {
  const svgPath = path.join(tmpDir, `${name}.svg`);
  await writeFile(svgPath, svg(card), 'utf8');
  execFileSync('rsvg-convert', ['-w', '1200', '-h', '630', svgPath, '-o', path.join(outDir, `${name}.png`)]);
  console.log(`public/og/${name}.png`);
}
await rm(tmpDir, { recursive: true, force: true });
