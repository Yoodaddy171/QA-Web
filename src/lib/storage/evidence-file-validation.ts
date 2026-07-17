export const MAX_EVIDENCE_FILE_SIZE = 25 * 1024 * 1024;

const SUPPORTED = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'application/pdf']);
const ascii = (bytes: Uint8Array, start: number, end: number) => String.fromCharCode(...bytes.slice(start, end));

export function detectEvidenceMime(bytes: Uint8Array): string | null {
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length >= 8 && png.every((value, index) => bytes[index] === value)) return 'image/png';
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP') return 'image/webp';
  if (bytes.length >= 6 && ['GIF87a', 'GIF89a'].includes(ascii(bytes, 0, 6))) return 'image/gif';
  if (bytes.length >= 5 && ascii(bytes, 0, 5) === '%PDF-') return 'application/pdf';
  if (bytes.length >= 12 && ascii(bytes, 4, 8) === 'ftyp') return 'video/mp4';
  if (bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return 'video/webm';
  return null;
}
export async function validateEvidenceFile(file: File) {
  if (file.size <= 0 || file.size > MAX_EVIDENCE_FILE_SIZE) throw new Error('Ukuran file harus lebih dari 0 dan maksimal 25 MB.');
  const detectedMime = detectEvidenceMime(new Uint8Array(await file.slice(0, 32).arrayBuffer()));
  if (!detectedMime || !SUPPORTED.has(detectedMime)) throw new Error('Isi file tidak dikenali sebagai PNG, JPEG, WebP, GIF, MP4, WebM, atau PDF yang valid.');
  if (file.type && file.type !== detectedMime) throw new Error(`Tipe file tidak cocok: browser mengirim ${file.type}, tetapi isi file adalah ${detectedMime}.`);
  return detectedMime;
}
