/**
 * A second job from the same SPA board must not vanish from the pipeline.
 *
 * `addPipelineUrl` dedups on the canonical URL key, and that key dropped every
 * fragment. On boards where the tenant path is shared and the posting id lives
 * only in `#/job/{id}` — MokaHR is the one in our registry — the second URL a
 * user pasted compared equal to the first and was silently swallowed: no error,
 * no line, nothing to notice. This is the user-visible half of the
 * `url-key.mjs` fragment-promotion fix (parent parity, career-ops @ 68e6b94).
 *
 * CI-isolated: pure string functions, no fs, no network.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addPipelineUrl } from '../server/lib/parsers.mjs';

/** The URLs inside the pipeline's fenced block, in order. */
function pipelineUrls(doc) {
  const fence = doc.match(/```([\s\S]*?)```/);
  return (fence ? fence[1] : '')
    .split('\n').map((l) => l.trim()).filter(Boolean)
    .map((l) => l.split(/\s+\|\s+/)[0].trim());
}

const TENANT = 'https://app.mokahr.com/social-recruitment/acme/123456';

test('two different MokaHR postings from one tenant both reach the pipeline', () => {
  let doc = addPipelineUrl('', `${TENANT}#/job/111`);
  doc = addPipelineUrl(doc, `${TENANT}#/job/222`);
  assert.deepEqual(pipelineUrls(doc), [`${TENANT}#/job/111`, `${TENANT}#/job/222`]);
});

test('the same MokaHR posting re-pasted is still recognised as a duplicate', () => {
  // The fix must not cost the dedup it was built for: a re-listing with a
  // tracking param, http↔https or a trailing slash still collapses.
  let doc = addPipelineUrl('', `${TENANT}#/job/111`);
  for (const spelling of [
    `${TENANT}#/job/111`,
    `${TENANT}/#/job/111`,
    `${TENANT.replace('https://', 'http://')}#/job/111`,
    `${TENANT}?utm_source=newsletter#/job/111`,
  ]) {
    doc = addPipelineUrl(doc, spelling);
  }
  assert.deepEqual(pipelineUrls(doc), [`${TENANT}#/job/111`]);
});

test('a generic hash-route board keeps its postings apart too', () => {
  let doc = addPipelineUrl('', 'https://jobs.example.com/careers#/jobs/1');
  doc = addPipelineUrl(doc, 'https://jobs.example.com/careers#/jobs/2');
  assert.equal(pipelineUrls(doc).length, 2);
});

test('a cosmetic fragment is still not an identity — the posting stays one line', () => {
  let doc = addPipelineUrl('', 'https://boards.example.com/jobs/42');
  doc = addPipelineUrl(doc, 'https://boards.example.com/jobs/42#apply');
  assert.deepEqual(pipelineUrls(doc), ['https://boards.example.com/jobs/42']);
});
