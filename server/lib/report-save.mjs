/**
 * report-save.mjs — the exclusive-create report save (v1.269 review follow-up).
 *
 * The auto-pipeline's report write must never clobber: the FIRST attempt uses
 * the kernel's exclusive `wx` flag (no existsSync-then-write TOCTOU — CodeQL
 * #752), and the epoch-suffix dedup path is exclusive TOO — two concurrent
 * pipelines saving the same slug each get their own file and their own name
 * back; neither can overwrite the other (the previous fallback write was a
 * plain `w` and could).
 *
 * Content is bounded (512 KB) at this boundary: a report beyond that is
 * pathological input and every report reader assumes bounded files.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const REPORT_MAX_BYTES = 512 * 1024;
const MAX_DEDUP_ATTEMPTS = 10; // unreachable in practice; keeps the loop bounded

export function saveReportExclusive(dir, slug, content) {
  const bounded = content.length > REPORT_MAX_BYTES ? content.slice(0, REPORT_MAX_BYTES) : content;
  try {
    writeFileSync(join(dir, `${slug}.md`), bounded, { flag: 'wx' });
    return slug;
  } catch (e) {
    if (e.code !== 'EEXIST') throw e;
    let attempt = 0;
    while (true) {
      const alt = `${slug}-${Date.now()}${attempt ? `-${attempt}` : ''}`;
      try {
        writeFileSync(join(dir, `${alt}.md`), bounded, { flag: 'wx' });
        return alt;
      } catch (e2) {
        if (e2.code !== 'EEXIST') throw e2;
        attempt += 1;
        if (attempt > MAX_DEDUP_ATTEMPTS) throw e2;
      }
    }
  }
}
