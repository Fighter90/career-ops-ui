import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { resolve } from 'node:path';
import { normalizeUrl as serverKey } from '../server/lib/url-key.mjs';

const src = readFileSync(resolve('public/js/lib/url-key.js'), 'utf8');
const window = {};
vm.runInNewContext(src, { window, URL, Set });
const clientKey = window.PostingUrlKey.normalizeUrl;

test('browser and server posting URL keys stay identical for identity-bearing forms', () => {
  const urls = [
    'http://Example.com/jobs/1/?utm_source=x&gh_jid=2',
    'https://example.com/jobs/1?gh_jid=3&ref=board',
    'https://app.mokahr.com/social-recruitment/x/y#/job/987',
    'https://example.com/jobs#apply',
    'javascript:alert(1)',
    '—',
  ];
  for (const url of urls) assert.equal(clientKey(url), serverKey(url), url);
});
