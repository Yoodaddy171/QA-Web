/* eslint-disable @typescript-eslint/no-require-imports -- Playwright's reporter bridge uses CommonJS. */
const { emit } = require('./script-telemetry.cjs');
const path = require('node:path');
class TracevaReporter {
  onBegin(_config, suite) { emit('execution', `Menjalankan ${suite.allTests().length} pengujian Playwright`); }
  onTestBegin(test) { emit('execution', `Mulai: ${test.title}`); }
  onStepEnd(_test, _result, step) {
    if (['test.step', 'pw:api', 'expect'].includes(step.category)) emit('execution', step.title, { level: step.error ? 'SEVERE' : 'INFO' });
  }
  onTestEnd(test, result) {
    result.attachments.filter(item => item.contentType === 'video/webm' && item.path).forEach((item, videoIndex) => emit('execution', 'Video tersimpan', { event: 'video.saved', metadata: { testId: test.id, videoIndex, file: path.relative(path.join(path.dirname(process.env.TRACEVA_RUN_EVENTS), 'artifacts'), item.path) } }));
    emit('execution', `${test.title}: ${result.status}`, { level: result.status === 'passed' ? 'INFO' : 'SEVERE' });
    for (const error of result.errors) emit('console', error.message || error.value || 'Assertion gagal', { level: 'SEVERE' });
  }
  onStdOut(chunk) { emit('console', chunk.toString(), { level: 'INFO' }); }
  onStdErr(chunk) { emit('console', chunk.toString(), { level: 'SEVERE' }); }
  onError(error) { emit('console', error.message || 'Runner error', { level: 'SEVERE' }); }
}
module.exports = TracevaReporter;
