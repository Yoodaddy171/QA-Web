import { test as base, expect } from '@playwright/test';

// Browser smoke uses an empty capture relay, never a user's running relay.
// Application APIs/authentication and the dedicated fixture database remain real.
export const test = base.extend({
  context: async ({ context }, runFixture) => {
    await context.route('http://127.0.0.1:3001/**', route => route.fulfill({
      contentType: 'application/json',
      body: route.request().url().includes('/logs/') ? '' : '{"recording":null}',
    }));
    await context.routeWebSocket('ws://127.0.0.1:3001/**', ws => ws.onMessage(() => {}));
    await runFixture(context);
  },
});
export { expect };
