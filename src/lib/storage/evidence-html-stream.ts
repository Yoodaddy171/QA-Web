import { open } from 'node:fs/promises';
import { Readable } from 'node:stream';

/** Preserve a standalone HTML video without buffering the video/Base64 document in RAM. */
export async function evidenceHtmlStream(html: string, marker: string, videoPath: string, signal?: AbortSignal): Promise<ReadableStream<Uint8Array>> {
  const position = html.indexOf(marker);
  if (position < 0 || html.indexOf(marker, position + marker.length) >= 0) throw new Error('Invalid evidence video placeholder');
  const file = await open(videoPath, 'r');
  const stat = await file.stat().catch(async error => { await file.close(); throw error; });
  if (!stat.isFile()) { await file.close(); throw new Error('Evidence video is not a file'); }
  const video = stat.size ? file.createReadStream({ start: 0, end: stat.size - 1, highWaterMark: 48 * 1024, autoClose: true }) : null;
  if (!video) await file.close();
  async function* chunks() {
    try {
      yield Buffer.from(html.slice(0, position));
      let carry = Buffer.alloc(0);
      if (video) for await (const part of video) {
        const bytes = carry.length ? Buffer.concat([carry, part as Buffer]) : part as Buffer;
        const end = bytes.length - bytes.length % 3;
        if (end) yield Buffer.from(bytes.subarray(0, end).toString('base64'));
        carry = Buffer.from(bytes.subarray(end));
      }
      if (carry.length) yield Buffer.from(carry.toString('base64'));
      yield Buffer.from(html.slice(position + marker.length));
    } finally { video?.destroy(); }
  }
  const stream = Readable.from(chunks(), { objectMode: false, highWaterMark: 64 * 1024 });
  const abort = () => stream.destroy(new Error('Evidence export aborted'));
  video?.on('error', error => stream.destroy(error));
  stream.once('close', () => { video?.destroy(); signal?.removeEventListener('abort', abort); });
  signal?.addEventListener('abort', abort, { once: true });
  const body = Readable.toWeb(stream, { strategy: { highWaterMark: 64 * 1024, size: chunk => chunk.byteLength } }) as ReadableStream<Uint8Array>;
  if (signal?.aborted) abort();
  return body;
}
