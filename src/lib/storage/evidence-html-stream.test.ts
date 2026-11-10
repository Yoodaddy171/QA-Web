import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { evidenceHtmlStream } from './evidence-html-stream';

let root: string;
beforeEach(async () => { root = await fs.mkdtemp(path.join(os.tmpdir(), 'traceva-export-stream-')); });
afterEach(async () => { await fs.rm(root, { recursive: true, force: true }); });

describe('EVIDENCE-MEMORY: standalone video export', () => {
  it.each([0, 1, 2, 3, 49151, 49152, 49153, 150001])('retains exact Base64 bytes across %i byte boundaries', async size => {
    const video = Buffer.alloc(size, 173);
    const file = path.join(root, 'video.webm');
    await fs.writeFile(file, video);
    const body = await evidenceHtmlStream('<video src="data:video/webm;base64,MARKER"></video>fin', 'MARKER', file);
    expect(await new Response(body).text()).toBe(`<video src="data:video/webm;base64,${video.toString('base64')}"></video>fin`);
  });
  it('closes the source on cancellation and supports a second export', async () => {
    const file = path.join(root, 'video.webm');
    await fs.writeFile(file, Buffer.alloc(2 * 1024 * 1024));
    const reader = (await evidenceHtmlStream('start MARKER end', 'MARKER', file)).getReader();
    await reader.read(); await reader.cancel();
    expect(await new Response(await evidenceHtmlStream('MARKER', 'MARKER', file)).text()).toHaveLength(Math.ceil(2 * 1024 * 1024 / 3) * 4);
  });
  it('rejects missing files and ambiguous placeholders before returning a response', async () => {
    await expect(evidenceHtmlStream('MARKER', 'MARKER', path.join(root, 'missing'))).rejects.toThrow();
    await expect(evidenceHtmlStream('MARKERMARKER', 'MARKER', path.join(root, 'missing'))).rejects.toThrow('placeholder');
  });
  it('propagates request abort instead of continuing to read', async () => {
    const file = path.join(root, 'video.webm');
    await fs.writeFile(file, Buffer.alloc(150001));
    const controller = new AbortController();
    const body = await evidenceHtmlStream('MARKER', 'MARKER', file, controller.signal);
    controller.abort();
    await expect(new Response(body).text()).rejects.toThrow('aborted');
  });
  it('emits bounded chunks for a large standalone export without collecting the document', async () => {
    const size = 8 * 1024 * 1024 + 1;
    const file = path.join(root, 'large.webm');
    const handle = await fs.open(file, 'w'); await handle.truncate(size); await handle.close();
    const body = await evidenceHtmlStream('startMARKERend', 'MARKER', file);
    const reader = body.getReader();
    let total = 0; let largest = 0;
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      total += value.byteLength; largest = Math.max(largest, value.byteLength);
    }
    expect(total).toBe('startend'.length + Math.ceil(size / 3) * 4);
    expect(largest).toBeLessThanOrEqual(64 * 1024);
  });
});
