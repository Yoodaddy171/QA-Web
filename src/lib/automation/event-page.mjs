import fs from 'node:fs/promises';

// Cache byte checkpoints, not log contents. UUID run files are append-only.
const files = new Map();
export async function readEventPage(file, cursor = 0, limit = 500) {
  let handle;
  try { handle = await fs.open(file, 'r'); }
  catch (error) { if (error.code === 'ENOENT') return { events: [], nextCursor: 0, hasMore: false }; throw error; }
  try {
    const stat = await handle.stat();
    let cached = files.get(file);
    if (!cached || stat.size < cached.size || stat.ino !== cached.ino || (stat.size === cached.size && stat.mtimeMs !== cached.mtimeMs)) cached = { size: stat.size, ino: stat.ino, mtimeMs: stat.mtimeMs, points: new Map([[0, 0]]) };
    cached.size = stat.size; cached.mtimeMs = stat.mtimeMs;
    files.delete(file); files.set(file, cached);
    if (files.size > 32) files.delete(files.keys().next().value);
    let lineNumber = 0, position = 0;
    for (const [line, offset] of cached.points) if (line <= cursor && line >= lineNumber) { lineNumber = line; position = offset; }
    const events = [];
    let pending = Buffer.alloc(0);
    const stream = handle.createReadStream({ start: position, autoClose: false, highWaterMark: 64 * 1024 });
    let pageLines = 0;
    try {
      outer: for await (const chunk of stream) {
        pending = Buffer.concat([pending, chunk]);
        let start = 0;
        for (let end = pending.indexOf(10, start); end !== -1; end = pending.indexOf(10, start)) {
          const raw = pending.subarray(start, end).toString('utf8').trim();
          position += end + 1 - start; start = end + 1;
          if (!raw) continue;
          if (lineNumber++ >= cursor) {
            try { events.push(JSON.parse(raw)); } catch { /* A malformed line still advances the cursor. */ }
            if (++pageLines >= limit) break outer;
          }
        }
        pending = pending.subarray(start);
      }
    } finally { stream.destroy(); }
    cached.points.set(lineNumber, position);
    if (cached.points.size > 128) cached.points.delete([...cached.points.keys()].find(key => key !== 0));
    return { events, nextCursor: lineNumber, hasMore: pageLines === limit && position < stat.size };
  } finally { await handle.close(); }
}
