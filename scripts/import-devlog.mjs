import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { PrismaClient } from '@prisma/devlog-client';

const require = createRequire(import.meta.url);
const { normalizeAutomationEvent } = require('../mini-services/automation-event');
const { createDevlogStore } = require('../mini-services/devlog-store');
const db = new PrismaClient({ datasourceUrl: process.env.POSTGRES_DATABASE_URL || process.env.DATABASE_URL });
const store = createDevlogStore(db, { allowOrphans: true });
const root = path.resolve('.');
const logsDir = path.join(root, 'mini-services', 'logs');
const recordingRoots = [
  path.join(process.env.QA_RUNTIME_DIR || path.join(process.env.LOCALAPPDATA || os.tmpdir(), 'web-qa-runtime'), 'recordings'),
  path.join(root, 'mini-services', 'recordings'),
];

const stableId = value => crypto.createHash('sha256').update(value).digest('hex');
const validTimestamp = value => {
  const date = new Date(value);
  const year = date.getUTCFullYear();
  return !Number.isNaN(date.getTime()) && year >= 2000 && year <= 2100;
};

async function importLogs() {
  let names = [];
  try {
    names = await fs.readdir(logsDir);
  } catch {
    return 0;
  }
  let processed = 0;
  const skipped = [];
  for (const name of names.filter(item => item.endsWith('.jsonl'))) {
    const filePath = path.join(logsDir, name);
    const lines = (await fs.readFile(filePath, 'utf8')).split('\n').filter(Boolean);
    const fileTime = (await fs.stat(filePath)).mtimeMs;
    for (let index = 0; index < lines.length; index++) {
      try {
        const parsed = JSON.parse(lines[index]);
        const event = parsed.automationEvent || normalizeAutomationEvent({
          ...parsed,
          eventId: `legacy-${stableId(`${name}:${index}:${lines[index]}`)}`,
        });
        if (!validTimestamp(event.timestamp)) {
          event.timestamp = new Date(fileTime - (lines.length - index) * 1000).toISOString();
        }
        if (await store.persistEvent(event)) processed++;
        else skipped.push(`${name}:${index + 1}: entity not found`);
      } catch (error) {
        skipped.push(`${name}:${index + 1}: ${error.message}`);
      }
    }
  }
  if (skipped.length) throw new Error(`DevLog import skipped ${skipped.length} rows:\n${skipped.join('\n')}`);
  return processed;
}

async function findMetadataFiles(dir) {
  const output = [];
  let entries = [];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return output;
  }
  for (const entry of entries) {
    const candidate = path.join(dir, entry.name);
    if (entry.isDirectory()) output.push(...await findMetadataFiles(candidate));
    else if (entry.name === 'metadata.json') output.push(candidate);
  }
  return output;
}

async function importRecordings() {
  let imported = 0;
  for (const recordingRoot of recordingRoots) {
    for (const metadataPath of await findMetadataFiles(recordingRoot)) {
      try {
        const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
        metadata.recordingId ||= `legacy-${stableId(metadataPath)}`;
        metadata.runId ||= metadata.sessionId;
        if (await store.persistRecording(metadata, path.dirname(metadataPath))) imported++;
      } catch (error) {
        console.warn(`Skipped ${metadataPath}: ${error.message}`);
      }
    }
  }
  return imported;
}

try {
  const events = await importLogs();
  const recordings = await importRecordings();
  const counts = {
    runs: await db.automationRun.count(),
    events: await db.automationEvent.count(),
    recordings: await db.recording.count(),
  };
  console.log(JSON.stringify({ imported: { events, recordings }, counts }));
} finally {
  await db.$disconnect();
}
