import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { expect, it } from 'vitest';
import { renderHtml } from './evidence-renderer';
import type { EvidenceLog, EvidenceRecord } from './route';

const record: EvidenceRecord = {
  id: 'synthetic-case', projectId: 'synthetic-project', testCaseId: 'CHECKOUT-014',
  page: 'Checkout', subMenu: 'Pembayaran', testType: 'Negative', priority: 'High',
  testAction: 'Pembayaran ditolak tanpa menghapus pesanan pengguna',
  steps: '1. Buka keranjang dan lanjutkan ke checkout.\n2. Pilih metode pembayaran kartu.\n3. Gunakan kartu uji yang ditolak oleh penyedia.\n4. Kirim pembayaran dan periksa pesanan.',
  expectedResult: 'Pesan penolakan ditampilkan. Pesanan tetap tersimpan dan pengguna dapat memilih metode pembayaran lain.',
  status: 'FAILED', actualResult: 'Not As Expected', remarks: 'Data contoh sintetis untuk pemeriksaan template, bukan hasil pengujian produk.\nPesanan seharusnya tetap tersedia setelah pembayaran ditolak.',
  project: { name: 'Contoh pengujian (data sintetis)' }, module: { name: 'Transaksi & Pembayaran' },
  createdAt: new Date('2026-11-01T03:00:00Z'), updatedAt: new Date('2026-11-04T03:30:00Z'),
};
const logs: EvidenceLog[] = Array.from({ length: 24 }, (_, i) => ({
  id: `synthetic-event-${i}`, tab: i % 4 === 3 ? 'console' : 'network', order: i,
  relativeMs: i * 120, method: i % 4 === 3 ? undefined : i % 2 ? 'POST' : 'GET',
  level: i % 4 === 3 ? 'ERROR' : undefined, status: i === 17 ? 422 : i % 4 === 3 ? undefined : 200,
  category: 'business', host: 'app.example.test', url: i % 4 === 3 ? undefined : `https://app.example.test/api/${i % 2 ? 'payments' : 'orders'}/${i}`,
  message: i % 4 === 3 ? 'Synthetic payment provider: declined' : `Synthetic request ${i}`,
  detail: { headers: { 'Content-Type': 'application/json', 'X-Test-Data': 'synthetic' }, data: { requestBody: { paymentMethod: 'synthetic-declined-card' }, responseBody: { accepted: i !== 17, message: i === 17 ? 'Synthetic decline' : 'Synthetic response' } } },
}));

it('renders synthetic presentation fixtures without external assets', async () => {
  const basic = renderHtml({ record, type: 'TestCase', logs, recording: null, frames: [], video: null });
  expect(basic).toContain('data sintetis');
  expect(basic).not.toContain('<script src=');
  const requested = process.env.TRACEVA_EVIDENCE_PREVIEW_DIR;
  if (!requested) return;
  const directory = path.resolve(requested);
  if (directory !== path.resolve('artifacts/evidence-template-preview')) throw new Error('Owned preview directory required');
  await fs.mkdir(directory, { recursive: true });
  const require = createRequire(import.meta.url);
  const videoPath = path.join(directory, 'synthetic.webm');
  execFileSync(require('@ffmpeg-installer/ffmpeg').path, ['-y', '-f', 'lavfi', '-i', 'testsrc2=size=640x360:rate=10', '-t', '3', '-an', '-c:v', 'libvpx', '-b:v', '150k', videoPath], { stdio: 'pipe', windowsHide: true });
  const framePath = path.join(directory, 'synthetic.png');
  execFileSync(require('@ffmpeg-installer/ffmpeg').path, ['-y', '-i', videoPath, '-frames:v', '1', framePath], { stdio: 'pipe', windowsHide: true });
  const frameSrc = `data:image/png;base64,${(await fs.readFile(framePath)).toString('base64')}`;
  const frame = { time: '0:00', relativeMs: 0, src: frameSrc };
  const recording = { metadata: { mode: 'hybrid', frames: [frame, { ...frame, relativeMs: 2000 }], targetUrl: 'https://app.example.test/checkout (synthetic)', video: { durationMs: 3000 } } };
  const html = renderHtml({ record, type: 'TestCase', logs, recording, frames: [frame, { ...frame, time: '0:02', relativeMs: 2000 }], video: { src: `data:video/webm;base64,${(await fs.readFile(videoPath)).toString('base64')}`, sizeBytes: 1, mimeType: 'video/webm' } });
  await fs.writeFile(path.join(directory, 'video.html'), html);
  await fs.writeFile(path.join(directory, 'logs.html'), basic);
  await fs.writeFile(path.join(directory, 'empty.html'), renderHtml({ record: { ...record, status: 'NOT DONE', actualResult: null }, type: 'TestCase', logs: [], recording: null, frames: [], video: null }));
});
