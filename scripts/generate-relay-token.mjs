import crypto from 'node:crypto';

const token = crypto.randomBytes(32).toString('hex');
process.stdout.write([
  `QA_RELAY_TOKEN=${token}`,
  `NEXT_PUBLIC_QA_RELAY_TOKEN=${token}`,
  'QA_RELAY_ALLOW_BROWSER_LAUNCH=1',
  '',
].join('\n'));
