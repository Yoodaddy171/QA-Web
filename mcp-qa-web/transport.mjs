// MIME hints come from content, never the extension. The web API validates again.
export function uploadMime(bytes) {
  if (bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return 'image/png';
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg';
  if (/^GIF8[79]a$/.test(bytes.subarray(0,6).toString())) return 'image/gif';
  if (bytes.subarray(0,4).toString() === 'RIFF' && bytes.subarray(8,12).toString() === 'WEBP') return 'image/webp';
  if (bytes.subarray(0,5).toString() === '%PDF-') return 'application/pdf';
  if (bytes.subarray(4,8).toString() === 'ftyp') return 'video/mp4';
  if (bytes.subarray(0,4).equals(Buffer.from([26,69,223,163]))) return 'video/webm';
  return 'application/octet-stream';
}

export function transportFailure(error, method, endpoint, service) {
  const code = error?.cause?.code || error?.code;
  const mutation = !['GET','HEAD','OPTIONS'].includes(method);
  const outcome = mutation ? ' Outcome UNKNOWN; reconcile persisted state before retrying.' : '';
  if (code === 'ECONNREFUSED') return `${service} is not running or is not listening (ECONNREFUSED): ${method} ${endpoint}.${outcome}`;
  if (error?.name === 'TimeoutError' || ['ETIMEDOUT','UND_ERR_CONNECT_TIMEOUT','UND_ERR_HEADERS_TIMEOUT'].includes(code)) return `${service} request timed out: ${method} ${endpoint}.${outcome}`;
  return `${service} connection failed${code && /^[A-Z_]+$/.test(code) ? ` (${code})` : ''}: ${method} ${endpoint}.${outcome}`;
}
