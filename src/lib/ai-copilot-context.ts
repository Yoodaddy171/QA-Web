import { db } from '@/lib/db';
import { extractKeywords, limitText } from '@/lib/ai-context';
import { cleanText, matchTokens, modulePrefix, normalizeForMatch, parseTestCaseId } from '@/lib/ai-copilot-utils';
import { chooseFigmaPage, extractFigmaPages, parseFigmaScreens } from './ai-copilot-figma';
import type { TestCaseDraft } from './ai-copilot-tools';

export async function getNextTestCaseIds(projectId: string, moduleId: string | null, count = 1, scope?: { page?: string; subMenu?: string }) {
  let prefix = 'A-';
  const moduleRecord = moduleId
    ? await db.module.findFirst({ where: { id: moduleId, projectId }, select: { name: true } })
    : null;
  if (moduleRecord?.name) prefix = modulePrefix(moduleRecord.name);

  const rows = await db.testCase.findMany({
    where: {
      projectId,
      ...(moduleId ? { moduleId } : {}),
      ...(scope?.page ? { page: scope.page } : {}),
      ...(scope?.subMenu ? { subMenu: scope.subMenu } : {}),
    },
    select: { testCaseId: true },
  });

  const allParsed = rows
    .map(row => parseTestCaseId(row.testCaseId))
    .filter((value): value is NonNullable<ReturnType<typeof parseTestCaseId>> => Boolean(value));
  if (allParsed.length > 0) {
    const prefixCounts = allParsed.reduce<Record<string, number>>((acc, item) => {
      acc[item.prefix] = (acc[item.prefix] || 0) + 1;
      return acc;
    }, {});
    prefix = Object.entries(prefixCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || prefix;
  }

  const parsed = allParsed
    .filter(value => value.prefix === prefix)
    .sort((a, b) => b.number - a.number);
  const latest = parsed[0];
  const width = latest?.width || 3;
  return Array.from({ length: count }, (_, index) => `${prefix}${String((latest?.number || 0) + index + 1).padStart(width, '0')}`);
}

export async function getNextTestCaseId(projectId: string, moduleId: string | null) {
  return (await getNextTestCaseIds(projectId, moduleId, 1))[0];
}

export function extractFollowUpTarget(question: string) {
  const match = cleanText(question).match(/(?:follow-up target|scope override)\s*:\s*([^\r\n]+)/i);
  return cleanText(match?.[1]);
}

export async function getProjectModules(projectId: string) {
  return db.module.findMany({
    where: { projectId },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
}

export function findModuleByHint<T extends { name: string }>(modules: T[], hint: string) {
  const normalizedHint = normalizeForMatch(hint);
  if (!normalizedHint) return null;

  return modules.find((module) => {
    const normalizedName = normalizeForMatch(module.name);
    return normalizedHint.includes(normalizedName) || normalizedName.includes(normalizedHint);
  }) || null;
}

export async function inferModule(projectId: string, question: string) {
  const modules = await getProjectModules(projectId);
  const followUpTarget = extractFollowUpTarget(question);
  const namedTarget = inferNamedTarget(followUpTarget || question);

  const explicitTarget = findModuleByHint(modules, followUpTarget)
    || findModuleByHint(modules, namedTarget);
  if (explicitTarget) return explicitTarget;

  const normalized = normalizeForMatch(question);
  return modules.find(module => normalized.includes(normalizeForMatch(module.name))) || null;
}

export function inferNamedTarget(question: string) {
  const text = cleanText(question);
  const match = text.match(/\b(?:module|modul|menu|page|halaman)\s+([a-z0-9][a-z0-9\s_-]{1,30})/i);
  if (!match?.[1]) return '';
  return match[1]
    .replace(/\b(tapi|jangan|tolong|buatkan|buat|generate|draft|missing|negative|cases?|testcase|simpan|dulu)\b.*$/i, '')
    .trim();
}

export async function readFeatureMapContext(projectId: string) {
  const rows = await db.projectKnowledge.findMany({
    where: { projectId, type: 'FEATURE_MAP' },
    select: { title: true, content: true },
    orderBy: { updatedAt: 'desc' },
    take: 6,
  });
  return rows;
}

export function inferFlowLine(featureMaps: Array<{ title: string; content: string }>, moduleName: string) {
  const normalizedModule = normalizeForMatch(moduleName);
  for (const item of featureMaps) {
    const lines = item.content.split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index].trim();
      if (!line.toLowerCase().endsWith('flow:')) continue;
      const label = normalizeForMatch(line.replace(/flow:\s*$/i, ''));
      if (!normalizedModule.includes(label) && !label.includes(normalizedModule)) continue;

      const nextLines: string[] = [];
      for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
        const candidate = lines[cursor].trim();
        if (!candidate) {
          if (nextLines.length > 0) break;
          continue;
        }
        if (/^[A-Za-z].*flow:\s*$/i.test(candidate)) break;
        nextLines.push(candidate);
        if (candidate.includes('->')) break;
      }
      const flow = nextLines.join(' ').trim();
      if (flow) return flow;
    }
  }
  return '';
}

export function inferFigmaScreenText(featureMaps: Array<{ title: string; content: string }>, moduleName: string, screenName: string) {
  const figma = featureMaps.find(item => /figma/i.test(`${item.title}\n${item.content}`));
  if (!figma) return [];
  const pages = extractFigmaPages(figma.content);
  const pageName = chooseFigmaPage(moduleName, Object.keys(pages));
  const screens = pageName ? parseFigmaScreens(pageName, pages[pageName] || []) : [];
  const screenTokens = matchTokens(screenName);
  const match = screens
    .map(screen => ({
      screen,
      score: screenTokens.reduce((total, token) => total + (normalizeForMatch(screen.name).includes(token) ? 2 : 0), 0)
        + (normalizeForMatch(screen.name) === normalizeForMatch(screenName) ? 8 : 0),
    }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)[0];
  return match?.screen.text.slice(0, 5) || [];
}

export function flowPathToTarget(flowLine: string, target: string) {
  const parts = flowLine
    .split(/\s*->\s*/)
    .map(part => part.trim())
    .filter(Boolean);
  if (!parts.length) return [];
  const targetTokens = matchTokens(target);
  const targetIndex = parts.findIndex(part => {
    const normalized = normalizeForMatch(part);
    return targetTokens.some(token => normalized.includes(token));
  });
  const endIndex = targetIndex >= 0 ? targetIndex : Math.min(parts.length - 1, 3);
  return parts.slice(0, endIndex + 1);
}

export function buildDraftStepsFromContext(input: {
  location: string;
  feature: string;
  scenario: { invalidData: string; action?: string; expected: string };
  flowLine: string;
  figmaText: string[];
}) {
  const pathParts = flowPathToTarget(input.flowLine, input.feature || input.location);
  const steps: string[] = [];

  if (pathParts.length > 0) {
    steps.push(`1. Buka aplikasi dan ikuti flow: ${pathParts.join(' -> ')}`);
  } else {
    steps.push(`1. Buka ${input.location}`);
  }

  const visibleText = input.figmaText.filter(Boolean).slice(0, 3);
  if (visibleText.length > 0) {
    steps.push(`2. Pastikan screen menampilkan elemen sesuai Figma: ${visibleText.join(', ')}`);
  } else {
    steps.push(`2. Pastikan area ${input.feature} tampil dan siap digunakan`);
  }

  steps.push(`3. Buat kondisi negatif dengan cara ${input.scenario.invalidData}`);
  steps.push(`4. ${input.scenario.action || 'Klik tombol aksi utama atau lanjutkan proses'}`);
  steps.push(`5. Pastikan hasilnya sesuai: ${input.scenario.expected}`);

  return steps.join('\n');
}

export function negativeScenarioForFeature(feature: string, index: number) {
  const normalized = normalizeForMatch(feature);

  if (/passcode|pin/.test(normalized)) {
    return {
      name: 'passcode salah atau kosong',
      invalidData: 'kosongkan passcode atau masukkan passcode kurang dari 4 digit/salah',
      action: 'Tekan tombol submit/login setelah passcode invalid dimasukkan',
      expected: 'Sistem menolak login, menampilkan pesan passcode tidak valid, dan user tetap berada di halaman passcode tanpa masuk ke POS.',
    };
  }

  if (/select user|change user|logged in|login/.test(normalized)) {
    return {
      name: 'user belum dipilih atau pergantian user dibatalkan',
      invalidData: 'lanjutkan proses tanpa memilih user, atau buka konfirmasi change user lalu batalkan',
      action: 'Coba lanjutkan login/change user dari state tersebut',
      expected: 'Sistem tidak mengganti sesi user, tidak membuka akses POS untuk user yang tidak valid, dan menampilkan state/konfirmasi sesuai desain.',
    };
  }

  if (/lock screen|system control|turn off|restart/.test(normalized)) {
    return {
      name: 'aksi sistem tanpa konfirmasi valid',
      invalidData: 'pilih aksi lock/change user/restart/turn off lalu batalkan pada modal konfirmasi',
      action: 'Klik Cancel/No pada modal konfirmasi dan ulangi aksi saat device masih dalam state terkunci',
      expected: 'Sistem membatalkan aksi, device tetap pada state sebelumnya, dan tidak terjadi logout/restart/change user tanpa konfirmasi.',
    };
  }

  if (/table|open table|guest|reserve/.test(normalized)) {
    return {
      name: 'open table tanpa data meja valid',
      invalidData: 'pilih meja tanpa mengisi jumlah guest, atau gunakan meja yang sudah active/reserved',
      action: 'Klik Start Order/Open Table/Order QR pada kondisi meja yang belum valid',
      expected: 'Sistem menolak membuka sesi meja, menampilkan validasi yang jelas, dan status meja tidak berubah menjadi active/reserved.',
    };
  }

  if (/menu|item|customize|cart|order/.test(normalized)) {
    return {
      name: 'order item dengan kondisi tidak valid',
      invalidData: 'pilih item sold out/low stock melebihi stok, atau hapus semua item lalu lanjutkan ke cart/payment',
      action: 'Klik Add to Cart/Payment/Send to Kitchen pada kondisi cart atau item yang tidak valid',
      expected: 'Sistem menolak proses order, menampilkan pesan stok/cart kosong yang spesifik, dan tidak mengirim pesanan ke kitchen.',
    };
  }

  if (/promo/.test(normalized)) {
    return {
      name: 'promo invalid atau expired',
      invalidData: 'masukkan kode promo salah, expired, atau tidak memenuhi syarat transaksi',
      action: 'Klik Apply Promo setelah kode invalid dimasukkan',
      expected: 'Sistem menampilkan pesan promo tidak valid/expired, tidak mengubah total pembayaran, dan promo tidak tersimpan pada order.',
    };
  }

  if (/payment|pay|cash|card|qris|va|bayar/.test(normalized)) {
    return {
      name: 'payment gagal atau data pembayaran tidak valid',
      invalidData: 'lanjutkan payment tanpa metode valid, nominal cash kurang dari total, atau simulasikan QRIS/VA gagal',
      action: 'Klik Pay/Confirm Payment lalu jalankan simulator payment gagal jika diperlukan',
      expected: 'Sistem menampilkan status payment gagal/pending sesuai kondisi, order tidak ditandai paid, dan user masih bisa mengganti metode pembayaran.',
    };
  }

  const genericScenarios = [
    {
      name: 'data wajib kosong',
      invalidData: 'kosongkan field wajib atau data utama pada form/flow tersebut',
      action: 'Klik tombol aksi utama setelah data wajib dikosongkan',
      expected: 'Sistem menolak proses, menampilkan pesan validasi pada field yang bermasalah, dan tidak membuat atau mengubah data transaksi.',
    },
    {
      name: 'format atau nilai tidak valid',
      invalidData: 'isi field dengan format/nilai yang tidak valid, di luar batas, atau tidak sesuai aturan bisnis',
      action: 'Klik tombol aksi utama setelah input invalid dimasukkan',
      expected: 'Sistem menampilkan error yang spesifik, mempertahankan input yang perlu dikoreksi, dan tidak melanjutkan proses ke tahap berikutnya.',
    },
    {
      name: 'aksi berulang atau kondisi tidak valid',
      invalidData: 'jalankan aksi utama dua kali atau saat kondisi data belum memenuhi syarat',
      action: 'Klik aksi utama dua kali saat loading atau sebelum data memenuhi syarat',
      expected: 'Sistem mencegah proses ganda atau proses tidak valid, tidak membuat duplikasi data, dan state UI tetap konsisten.',
    },
  ];

  return genericScenarios[index % genericScenarios.length];
}

