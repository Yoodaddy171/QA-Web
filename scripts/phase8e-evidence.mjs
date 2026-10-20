import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url), sharp = require('sharp'), { PrismaClient } = require('@prisma/client');
const root = path.join(os.tmpdir(), 'qadesk-phase8e-20261019');
const f = JSON.parse(await fs.readFile(path.join(root, 'fixture.json'), 'utf8'));
if (!f.databaseUrl.startsWith(`file:${root.replaceAll('\\', '/')}/`)) throw Error('Synthetic fixture only');
if (process.argv[2] === 'health') {
  const { chromium, expect } = require('@playwright/test');
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    await context.addCookies([{ name: 'qa_session', value: f.actors.owner.token, url: f.origin }]);
    await context.addInitScript(() => localStorage.setItem('web-qa:theme', 'dark'));
    await context.route(/https?:\/\/(127\.0\.0\.1|localhost):3001\//, r => r.abort());
    await context.routeWebSocket(/ws:\/\/(127\.0\.0\.1|localhost):3001/, ws => ws.close());
    const page = await context.newPage(), consoleMessages = [], pageErrors = [];
    page.on('console', message => { if (['error', 'warning'].includes(message.type())) consoleMessages.push({ level: message.type(), text: message.text() }); });
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.goto(`${f.origin}/projects/${f.project.id}/traceability`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Graph View', exact: true }).click();
    await page.getByLabel('Cari nama atau ID').fill('AUTH-001'); await page.getByRole('button', { name: /^AUTH-001 —/ }).click();
    await expect(page.getByRole('region', { name: /Canvas graph/ }).locator('[data-graph-node]')).not.toHaveCount(0);
    const status = await (await context.request.get(`${f.origin}/api/auth/status`)).json();
    expect(status.user.id).toBe(f.actors.owner.id);
    expect(pageErrors).toEqual([]); expect(consoleMessages.filter(m => m.level === 'error')).toEqual([]);
    await fs.writeFile(path.join(root, 'browser-health.json'), JSON.stringify({ url: page.url(), title: await page.title(), browser: browser.version(), actor: 'owner / workspace A', consoleMessages, pageErrors }, null, 2));
    console.log('Production Graph View browser console/identity check passed.');
  } finally { await browser.close(); }
  process.exit(0);
}
if (process.argv[2] === 'cleanup') {
  const db = new PrismaClient({ datasourceUrl: f.databaseUrl });
  try { await db.session.deleteMany({}); for (const actor of Object.values(f.actors)) delete actor.token; await fs.writeFile(path.join(root, 'fixture.json'), JSON.stringify(f, null, 2)); console.log('Synthetic sessions revoked and fixture credentials removed.'); }
  finally { await db.$disconnect(); }
  process.exit(0);
}
const run = process.env.QA_PHASE8E_RUN || 'production';
const variants = [[1440, 'dark'], [1440, 'light'], [1366, 'dark'], [390, 'dark']];
const tiles = [];
for (let row = 0; row < 4; row++) for (let col = 0; col < 2; col++) {
  const [width, theme] = variants[row];
  const name = `graph-${width}-${theme}.png`;
  const file = path.join(root, col ? `after/${run}` : 'before', name);
  const thumb = await sharp(file).resize({ width: 520, height: 350, fit: 'contain', background: '#171717' }).toBuffer();
  const title = Buffer.from(`<svg width="540" height="30"><text x="12" y="21" fill="white" font-family="sans-serif" font-size="14">${col ? 'AFTER' : 'BEFORE'} | ${width}px ${theme} | thumbnail</text></svg>`);
  tiles.push({ input: title, left: col * 540, top: row * 390 }, { input: thumb, left: col * 540 + 10, top: row * 390 + 32 });
}
await sharp({ create: { width: 1080, height: 1560, channels: 3, background: '#171717' } }).composite(tiles).png().toFile(path.join(root, 'before-after-contact-sheet.png'));
const safety = JSON.parse(await fs.readFile(path.join(root, 'primary-safety.json'), 'utf8'));
const manifest = JSON.parse(await fs.readFile(path.join(root, 'source-sync.json'), 'utf8'));
const differences = [];
for (const { file } of manifest.filter(v => /^(src\/|prisma\/|public\/|next.config|package)/.test(v.file))) {
  const hashes = await Promise.all([safety.root, f.checkout].map(async base => crypto.createHash('sha256').update(await fs.readFile(path.join(base, file))).digest('hex')));
  if (hashes[0] !== hashes[1]) differences.push(file);
}
const db = new PrismaClient({ datasourceUrl: f.databaseUrl });
try {
  const current = await db.testCase.findMany({ select: { id: true, status: true, updatedAt: true } });
  const initial = [...f.cases, f.foreignCase];
  const unchanged = current.length === initial.length && current.every(c => initial.some(i => i.id === c.id && i.status === c.status && i.updatedAt === c.updatedAt.toISOString()));
  const summary = { run, productionSourceDifferences: differences, primaryBuildUnchanged: (await fs.readFile(path.join(safety.root, '.next/BUILD_ID'), 'utf8')) === safety.buildId, primaryBuildId: safety.buildId.trim(), syntheticCasesUnchanged: unchanged, integrity: await db.$queryRawUnsafe('PRAGMA integrity_check'), foreignKeys: await db.$queryRawUnsafe('PRAGMA foreign_key_check') };
  await fs.writeFile(path.join(root, 'final-safety.json'), JSON.stringify(summary, null, 2));
  if (differences.length || !summary.primaryBuildUnchanged || !unchanged) throw Error('Final parity/state guard failed');
  console.log(JSON.stringify(summary));
} finally { await db.$disconnect(); }
