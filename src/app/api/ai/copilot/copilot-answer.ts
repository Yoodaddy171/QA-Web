import type { CopilotCitation } from '@/lib/ai-copilot-tools';
import { cleanText } from './copilot-intent';

type AnswerDecision = {
  intent?: string;
  needsConfirmation?: boolean;
};

export function fallbackAnswer(input: {
  question: string;
  citations: CopilotCitation[];
  usedTools: string[];
  providerError?: string;
}) {
  const hasMatches = input.citations.some(citation => citation.type === 'testcase' || citation.type === 'bugfix');
  const lines = [
    input.providerError
      ? `AI provider belum bisa menjawab penuh: ${input.providerError}`
      : 'Saya sudah membaca database lokal project ini.',
    '',
    hasMatches
      ? 'Sumber database yang relevan sudah ditemukan. Lihat citation chips di bawah untuk membuka detailnya.'
      : 'Saya belum menemukan testcase atau bugfix yang langsung cocok dari database lokal.',
    '',
    `Tools yang dipakai: ${input.usedTools.join(', ') || '-'}`,
  ];

  return lines.join('\n');
}

export function buildDeterministicAnswer(tools: Array<{ name: string; data: unknown; summary: string }>, decision?: AnswerDecision) {
  if (decision?.needsConfirmation) {
    return 'Saya tidak akan menyimpan atau mengubah data langsung dari chat ini. Untuk action seperti save/apply, review draft atau perubahan yang dimaksud dulu, lalu gunakan tombol aksi yang tersedia agar perubahan tetap terkontrol.';
  }

  const projectOverview = tools.find(tool => tool.name === 'getProjectOverview');
  if (decision?.intent === 'PROJECT_SUMMARY' && projectOverview?.data) {
    const data = projectOverview.data as any;
    const project = data.project;
    const statusGroups = Array.isArray(data.statusGroups) ? data.statusGroups : [];
    const bugGroups = Array.isArray(data.bugGroups) ? data.bugGroups : [];
    const modules = Array.isArray(data.modules) ? data.modules : [];
    const statusText = statusGroups.length
      ? statusGroups.map((row: any) => `${row.status}: ${row._count?.id || 0}`).join(', ')
      : 'belum ada breakdown status';
    const bugText = bugGroups.length
      ? bugGroups.map((row: any) => `${row.status}: ${row._count?.id || 0}`).join(', ')
      : 'belum ada breakdown bug';
    const biggestModules = modules
      .slice()
      .sort((a: any, b: any) => (b._count?.testCases || 0) - (a._count?.testCases || 0))
      .slice(0, 4)
      .map((module: any) => `${module.name} (${module._count?.testCases || 0} TC)`)
      .join(', ');

    return [
      `Project **${project?.name || '-'}** saat ini punya **${project?.counts?.testCases || 0} testcase**, **${project?.counts?.modules || 0} module**, dan **${project?.counts?.bugFixItems || 0} bugfix**.`,
      '',
      `Status testcase: ${statusText}.`,
      `Status bugfix: ${bugText}.`,
      biggestModules ? `Module dengan coverage terbesar: ${biggestModules}.` : '',
      '',
      'Untuk langkah berikutnya, paling berguna mengecek gap negative case, testcase dengan steps lemah, atau module paling berisiko.',
    ].filter(Boolean).join('\n');
  }

  const figmaCoverage = tools.find(tool => tool.name === 'getFigmaScreenCoverage');
  if (figmaCoverage) {
    const data = figmaCoverage.data as any;
    if (!data?.totals) {
      return figmaCoverage.summary;
    }

    const screens = Array.isArray(data.screens) ? data.screens : [];
    const topMissing = screens.filter((screen: any) => !screen.covered).slice(0, 12);
    const topCovered = screens.filter((screen: any) => screen.covered).slice(0, 10);
    const coveragePercent = data.totals.figmaScreens > 0
      ? Math.round((data.totals.covered / data.totals.figmaScreens) * 100)
      : 0;

    const lines = [
      `Saya bandingkan screen di Figma knowledge **${data.pageName || '-'}** dengan testcase di database.`,
      '',
      `Coverage kandidat: **${data.totals.covered}/${data.totals.figmaScreens} screen (${coveragePercent}%)**.`,
      '',
    ];

    if (topCovered.length > 0) {
      lines.push('| Screen Figma | Kandidat Testcase | Alasan |');
      lines.push('| --- | --- | --- |');
      lines.push(...topCovered.map((screen: any) => {
        const matches = (screen.matches || [])
          .slice(0, 3)
          .map((match: any) => `${match.testCaseId} (${match.status}, score ${match.score})`)
          .join(', ');
        const reason = screen.figmaText?.length
          ? `Teks Figma: ${screen.figmaText.slice(0, 2).join(' / ')}`
          : 'Nama screen mirip dengan page/submenu/test action.';
        return `| ${screen.screen} | ${matches || '-'} | ${reason} |`;
      }));
      lines.push('');
    }

    if (topMissing.length > 0) {
      lines.push('Screen yang belum punya kandidat testcase kuat:');
      lines.push(...topMissing.map((screen: any) => `- ${screen.screen}${screen.figmaText?.length ? ` (${screen.figmaText.slice(0, 2).join(' / ')})` : ''}`));
      lines.push('');
      lines.push('Catatan: ini matching berbasis nama screen dan teks Figma terhadap isi testcase. Kalau testcase memakai istilah berbeda, bisa saja sebenarnya sudah ter-cover tapi tidak terbaca kuat.');
    } else {
      lines.push('Semua screen yang terbaca dari Figma punya kandidat testcase di database.');
    }

    return lines.join('\n');
  }

  const coverageGap = tools.find(tool => tool.name === 'getCoverageGap');
  if (coverageGap) {
    const data = coverageGap.data as any;
    const topGaps = Array.isArray(data?.topGaps) ? data.topGaps : [];
    const missingNegative = topGaps
      .filter((gap: any) => Number(gap.total || 0) > 0 && Number(gap.negative || 0) === 0)
      .slice(0, 8);

    if (missingNegative.length > 0) {
      const lines = [
        'Area yang **belum punya negative case kuat** berdasarkan testcase database:',
        '',
        '| Area | Existing Positive/Other Cases | Rekomendasi Negative Case |',
        '| --- | --- | --- |',
        ...missingNegative.map((gap: any) => {
          const location = [gap.moduleName, gap.page, gap.subMenu].filter(Boolean).join(' > ');
          const samples = Array.isArray(gap.samples) && gap.samples.length
            ? gap.samples.map((sample: any) => sample.testCaseId).join(', ')
            : '-';
          const recommendation = `Tambahkan negative case untuk ${gap.subMenu || gap.page || gap.moduleName}, misalnya data kosong, input invalid, stok tidak cukup, atau aksi saat state belum valid.`;
          return `| ${location || '-'} | ${samples} | ${recommendation} |`;
        }),
        '',
        'Catatan: ID di kolom existing adalah testcase yang sudah ada sebagai referensi coverage, bukan ID testcase baru.',
      ];
      return lines.join('\n');
    }

    if (topGaps.length > 0) {
      return [
        'Saya belum menemukan area yang benar-benar kosong dari negative case pada scope ini.',
        '',
        'Namun beberapa area masih bisa diperkuat jika coverage negative-nya kurang dibanding positive case:',
        ...topGaps.slice(0, 6).map((gap: any) => {
          const location = [gap.moduleName, gap.page, gap.subMenu].filter(Boolean).join(' > ');
          return `- ${location || '-'}: ${gap.negative || 0} negative dari ${gap.total || 0} testcase.`;
        }),
      ].join('\n');
    }

    return 'Tidak ditemukan data testcase yang cukup untuk menganalisis missing negative case pada scope ini.';
  }

  const moduleRisk = tools.find(tool => tool.name === 'getModuleRisk');
  if (moduleRisk) {
    const rows = Array.isArray(moduleRisk.data) ? moduleRisk.data as Array<Record<string, any>> : [];
    if (rows.length > 0) {
      const top = rows[0];
      const lines = [
        `Module paling berisiko saat ini adalah **${top.moduleName}** dengan risk score **${top.riskScore}**.`,
        '',
        'Score ini dihitung dari kombinasi testcase failed, blocked, ready to retest, in progress, dan high/critical priority. Jadi bukan sekadar jumlah testcase, tapi bobot masalah yang masih aktif.',
        '',
        '| Module | Risk | Total TC | Failed | Blocked | Ready Retest | In Progress | High/Critical |',
        '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
        ...rows.slice(0, 6).map(row => (
          `| ${row.moduleName || '-'} | ${row.riskScore ?? 0} | ${row.total ?? 0} | ${row.failed ?? 0} | ${row.blocked ?? 0} | ${row.readyToRetest ?? 0} | ${row.inProgress ?? 0} | ${row.highPriority ?? 0} |`
        )),
        '',
        top.failed || top.blocked || top.readyToRetest
          ? `Prioritas pertama: buka module **${top.moduleName}**, selesaikan failed/blocked lebih dulu, lalu lanjutkan item ready to retest.`
          : `Prioritas pertama: pantau progress di **${top.moduleName}**, karena score utamanya datang dari item in progress atau prioritas tinggi.`,
      ];
      return lines.join('\n');
    }
  }

  const genericExpected = tools.find(tool => tool.name === 'getGenericExpectedResultCases');
  if (genericExpected) {
    const rows = Array.isArray(genericExpected.data) ? genericExpected.data as Array<Record<string, any>> : [];
    if (rows.length === 0) return 'Saya tidak menemukan expected result yang terindikasi terlalu generic di scope ini.';

    const lines = [
      `Saya menemukan **${rows.length} testcase** yang expected result-nya terlihat terlalu generic atau kurang measurable.`,
      '',
      'Yang perlu diperbaiki biasanya expected result yang hanya bilang “berjalan dengan baik”, “data sesuai”, atau terlalu pendek tanpa menyebut output yang harus diverifikasi.',
      '',
      '| TC | Area | Expected Saat Ini | Kenapa Lemah |',
      '| --- | --- | --- | --- |',
      ...rows.slice(0, 8).map(row => {
        const area = [row.module?.name, row.page, row.subMenu].filter(Boolean).join(' > ') || '-';
        const reason = Number(row.score || 0) >= 5
          ? 'Terlalu umum atau sangat pendek.'
          : 'Belum cukup menyebut output/state yang harus diverifikasi.';
        return `| ${row.testCaseId} | ${area} | ${String(row.expectedResult || '-').replace(/\|/g, '/')} | ${reason} |`;
      }),
      '',
      'Saran: refine expected result dengan menyebut kondisi layar, data yang berubah/tidak berubah, pesan validasi, status transaksi/order, dan output yang bisa dicek QA.',
    ];
    return lines.join('\n');
  }

  const weakSteps = tools.find(tool => tool.name === 'getWeakStepCases');
  if (weakSteps) {
    const rows = Array.isArray(weakSteps.data) ? weakSteps.data as Array<Record<string, any>> : [];
    if (rows.length === 0) return 'Saya tidak menemukan testcase dengan steps yang terlihat lemah di scope ini.';

    const lines = [
      `Saya menemukan **${rows.length} testcase** yang steps-nya kurang jelas untuk manual QA.`,
      '',
      'Indikasinya antara lain steps terlalu pendek, tidak numbered, atau memakai kalimat generic seperti “jalankan aksi utama” tanpa data uji dan tombol yang spesifik.',
      '',
      '| TC | Area | Masalah Steps | Potongan Steps Saat Ini |',
      '| --- | --- | --- | --- |',
      ...rows.slice(0, 8).map(row => {
        const area = [row.module?.name, row.page, row.subMenu].filter(Boolean).join(' > ') || '-';
        const issues = [
          Number(row.lineCount || 0) < 3 ? 'terlalu sedikit langkah' : '',
          Number(row.numberedSteps || 0) === 0 ? 'tidak numbered' : '',
          Number(row.score || 0) >= 8 ? 'terlalu generic' : '',
        ].filter(Boolean).join(', ') || 'perlu dibuat lebih spesifik';
        return `| ${row.testCaseId} | ${area} | ${issues} | ${String(row.steps || '-').replace(/\|/g, '/')} |`;
      }),
      '',
      'Saran: setiap step sebaiknya menyebut screen yang dibuka, data uji yang dipakai, action yang diklik, dan output yang harus dicek.',
    ];
    return lines.join('\n');
  }

  const latestErrors = tools.find(tool => tool.name === 'getLatestDevLogErrors');
  if (latestErrors) {
    const rows = Array.isArray(latestErrors.data) ? latestErrors.data as Array<Record<string, any>> : [];
    if (!rows.length) return 'Tidak ditemukan testcase dengan devlog terbaru yang memiliki indikasi error.';
    const lines = rows.slice(0, 8).map(row => {
      const location = [row.module, row.page, row.subMenu].filter(Boolean).join(' > ');
      const networkErrors = Number(row.uniqueNetworkErrorCount || 0);
      const consoleErrors = Number(row.uniqueConsoleErrorCount || 0);
      const detail = networkErrors > 0
        ? `${networkErrors} unique network error${consoleErrors ? `, ${consoleErrors} console/error log` : ''}`
        : `${consoleErrors || row.errorCount || 0} console/error log`;
      return `- **${row.testCaseId}** (${location || '-'}) - ${detail}, ${row.kind || 'log'}, update ${row.updatedAt || '-'}`;
    });
    return ['Testcase dengan devlog/error terbaru:', ...lines].join('\n');
  }

  return '';
}

export function isLowQualityAnswer(answer: string) {
  const text = cleanText(answer);
  if (!text) return true;
  const lower = text.toLowerCase();
  if (text.length < 90) return true;
  if (/^ditemukan\s+\d+\s+testcase/i.test(text) && !text.includes('|')) return true;
  return [
    'tidak ada data',
    'berdasarkan data yang ada',
    'saya dapat membantu',
    'review dulu sebelum disimpan',
  ].some(phrase => lower === phrase || (lower.includes(phrase) && text.length < 160));
}
