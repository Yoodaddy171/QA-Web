# AI governance

Semua fitur AI QA-DESK melewati satu provider gateway dan governance service. Request tanpa `projectId`, operation, dan prompt version ditolak.

## Kebijakan project

- External AI (`Groq`/`Gemini`) nonaktif secara default per project.
- Admin dapat mengaktifkannya di Settings setelah memahami bahwa context project akan keluar dari host.
- Ollama hanya menerima alamat loopback dan menjadi pilihan local-only.
- UI menampilkan preview data yang sudah disanitasi sebelum generation dijalankan.
- Hasil testcase AI selalu menjadi draft dan baru masuk inventory setelah `Approve & Save`.

## Proteksi request

- Scrubber menyamarkan email, credential, bearer token, pola secret, dan nomor pembayaran.
- Output JSON divalidasi menggunakan Zod; response tidak valid diperbaiki sekali dan divalidasi ulang.
- Timeout, rate limit per user/project, batas output token, dan budget bulanan dikendalikan melalui environment dan project settings.
- Token usage direservasi secara atomik sebelum request, lalu direkonsiliasi setelah sukses atau dilepas setelah gagal.

## Audit

`AIRequestAudit` menyimpan actor, operation, prompt version, provider, model, context IDs, kategori data, estimasi token, status, dan SHA-256 output. Prompt dan output mentah tidak disimpan di audit untuk mengurangi risiko data sensitif.

Konfigurasi host:

```env
AI_REQUEST_TIMEOUT_MS=30000
AI_REQUESTS_PER_MINUTE=20
AI_MAX_OUTPUT_TOKENS=4000
```
