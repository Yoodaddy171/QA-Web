import crypto from 'node:crypto';
import {
  test as base,
  expect,
  type BrowserContext,
  type Page,
  type Request,
  type Response,
} from '@playwright/test';
import type { DevLogLevel } from '../../src/lib/devlog-contract';
import {
  redactHeaders,
  sanitizeBody,
  sendDevLog,
} from './devlog-client';

type QaOptions = {
  /**
   * Internal Database ID / UUID dari test case QA Desk.
   * BUKAN display ID seperti E-124.
   */
  qaTestCaseId: string;
};

type QaDevLogSession = {
  id: string;
  startedAtMs: number;
};

type QaLogOptions = {
  level?: DevLogLevel;
  data?: unknown;
};

type QaFixtures = {
  qaDevLogSession: QaDevLogSession;
  qaLog: (message: string, options?: QaLogOptions) => Promise<void>;
  _qaDevLogAuto: void;
};

const MAX_RESPONSE_BODY_BYTES = Number(
  process.env.QA_DEVLOG_MAX_RESPONSE_BODY_BYTES || String(1024 * 1024),
);

function isTextualContentType(contentType: string) {
  const normalized = contentType.toLowerCase();

  return normalized.includes('application/json')
    || normalized.includes('application/problem+json')
    || normalized.includes('application/graphql-response+json')
    || normalized.includes('application/xml')
    || normalized.includes('text/')
    || normalized.includes('application/javascript')
    || normalized.includes('application/x-www-form-urlencoded');
}

function shouldIgnoreUrl(url: string) {
  const lower = url.toLowerCase();

  return lower.startsWith('data:')
    || lower.startsWith('blob:')
    || lower.includes('127.0.0.1:3001/log');
}

async function readResponseBodySafely(response: Response) {
  try {
    const headers = await response.allHeaders();
    const contentType = headers['content-type'] || '';
    const contentLength = Number(headers['content-length'] || '0');

    if (!isTextualContentType(contentType)) return undefined;
    if (Number.isFinite(contentLength) && contentLength > MAX_RESPONSE_BODY_BYTES) {
      return `[body skipped: content-length ${contentLength} bytes]`;
    }

    return sanitizeBody(await response.text());
  } catch {
    return undefined;
  }
}

function attachPageErrorCapture(
  page: Page,
  testCaseId: string,
  session: QaDevLogSession,
) {
  page.on('pageerror', async error => {
    await sendDevLog({
      category: 'console',
      event: 'console',
      testCaseId,
      sessionId: session.id,
      relativeMs: Date.now() - session.startedAtMs,
      level: 'SEVERE',
      console: true,
      log: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
    });
  });
}

export const test = base.extend<QaOptions & QaFixtures>({
  qaTestCaseId: ['', { option: true }],

  qaDevLogSession: async ({}, use) => {
    await use({
      id: `pw-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
      startedAtMs: Date.now(),
    });
  },

  qaLog: async ({ qaTestCaseId, qaDevLogSession }, use) => {
    await use(async (message: string, options: QaLogOptions = {}) => {
      if (!qaTestCaseId) return;

      await sendDevLog({
        category: 'execution',
        event: 'step',
        testCaseId: qaTestCaseId,
        sessionId: qaDevLogSession.id,
        relativeMs: Date.now() - qaDevLogSession.startedAtMs,

        // Deliberately no `level` field on execution messages.
        // This preserves compatibility with older QA Desk consumers where
        // any message containing `level` is classified as Console.
        log: options.data === undefined
          ? message
          : {
              message,
              data: sanitizeBody(options.data),
            },
      });
    });
  },

  _qaDevLogAuto: [
    async ({ context, qaTestCaseId, qaDevLogSession }, use, testInfo) => {
      if (!qaTestCaseId) {
        await use();
        return;
      }

      const requestStartedAt = new WeakMap<Request, number>();
      const attachedPages = new WeakSet<Page>();

      const attachPage = (page: Page) => {
        if (attachedPages.has(page)) return;
        attachedPages.add(page);
        attachPageErrorCapture(page, qaTestCaseId, qaDevLogSession);
      };

      context.pages().forEach(attachPage);
      context.on('page', attachPage);

      context.on('console', async message => {
        const type = message.type();
        const level: DevLogLevel =
          type === 'error'
            ? 'SEVERE'
            : type === 'warning'
              ? 'WARNING'
              : type === 'debug'
                ? 'DEBUG'
                : 'INFO';

        await sendDevLog({
          category: 'console',
          event: 'console',
          testCaseId: qaTestCaseId,
          sessionId: qaDevLogSession.id,
          relativeMs: Date.now() - qaDevLogSession.startedAtMs,
          level,
          console: true,
          log: message.text(),
        });
      });

      context.on('request', request => {
        if (shouldIgnoreUrl(request.url())) return;
        requestStartedAt.set(request, Date.now());
      });

      context.on('response', async response => {
        const request = response.request();
        const url = response.url();

        if (shouldIgnoreUrl(url)) return;

        let requestHeaders: Record<string, string> = {};
        let responseHeaders: Record<string, string> = {};

        try {
          requestHeaders = redactHeaders(await request.allHeaders());
        } catch {
          // Best effort.
        }

        try {
          responseHeaders = redactHeaders(await response.allHeaders());
        } catch {
          // Best effort.
        }

        const startedAt = requestStartedAt.get(request);
        const responseBody = await readResponseBodySafely(response);

        await sendDevLog({
          category: 'network',
          event: 'network.response',
          testCaseId: qaTestCaseId,
          sessionId: qaDevLogSession.id,
          relativeMs: Date.now() - qaDevLogSession.startedAtMs,
          log: 'Network Trace',
          network: {
            event: 'Response',
            method: request.method(),
            url,
            status: response.status(),
            success: response.ok(),
            duration: startedAt ? Date.now() - startedAt : undefined,
            headers: responseHeaders,
            data: {
              resourceType: request.resourceType(),
              requestHeaders,
              requestBody: sanitizeBody(request.postData()),
              responseBody,
            },
          },
        });
      });

      context.on('requestfailed', async request => {
        if (shouldIgnoreUrl(request.url())) return;

        const startedAt = requestStartedAt.get(request);

        await sendDevLog({
          category: 'network',
          event: 'network.error',
          testCaseId: qaTestCaseId,
          sessionId: qaDevLogSession.id,
          relativeMs: Date.now() - qaDevLogSession.startedAtMs,
          log: 'Network Trace',
          network: {
            event: 'Error',
            method: request.method(),
            url: request.url(),
            status: 0,
            success: false,
            duration: startedAt ? Date.now() - startedAt : undefined,
            data: {
              resourceType: request.resourceType(),
              requestBody: sanitizeBody(request.postData()),
              error: request.failure()?.errorText,
            },
          },
        });
      });

      // This exact text intentionally matches the existing QA-Web
      // ws-server.js run-rotation regex: /Starting\s+.*Automation/i.
      await sendDevLog({
        category: 'execution',
        event: 'run.started',
        testCaseId: qaTestCaseId,
        sessionId: qaDevLogSession.id,
        relativeMs: 0,
        log: `Starting Playwright Automation: ${testInfo.title}`,
      });

      try {
        await use();
      } finally {
        const status = testInfo.status || 'unknown';
        const durationMs = Date.now() - qaDevLogSession.startedAtMs;

        await sendDevLog({
          category: 'execution',
          event: 'run.finished',
          testCaseId: qaTestCaseId,
          sessionId: qaDevLogSession.id,
          relativeMs: durationMs,
          log: {
            message: `Finished Playwright Automation: ${status}`,
            title: testInfo.title,
            status,
            expectedStatus: testInfo.expectedStatus,
            durationMs,
            retry: testInfo.retry,
            project: testInfo.project.name,
          },
        });
      }
    },
    { auto: true },
  ],
});

export { expect };
