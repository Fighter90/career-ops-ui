/**
 * pipe.hint second sentence (BACKLOG v1.243.0).
 *
 * The hint teaches two things: where the URL lands (data/pipeline.md) and
 * that `/career-ops pipeline` batch-processes it from Claude Code. Six
 * locales (es, pt-BR, ko, ja, zh-CN, zh-TW) dropped the second sentence,
 * leaving those users with a dead-end hint. The command name is
 * language-neutral, so the guard is script-agnostic: the sentence *before*
 * the `/career-ops pipeline` mention must end a sentence — i.e. carry a
 * sentence terminator (Latin . ! ? or CJK 。！ or Devanagari । or ellipsis).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { I18N_LANGS, loadAssembledDict } from './helpers/i18n-vm.mjs';

const DICT = loadAssembledDict();

test('pipe.hint keeps both sentences in every locale', () => {
  for (const lang of I18N_LANGS) {
    const v = DICT['pipe.hint'][lang];
    assert.ok(v, `pipe.hint missing for ${lang}`);
    const idx = v.indexOf('/career-ops pipeline');
    assert.ok(idx > 0, `pipe.hint[${lang}] lost the "/career-ops pipeline" command mention`);
    // Sentence terminators OUTSIDE the filename/command literals — the dot in
    // data/pipeline.md must not count as sentence #1. Two real sentences
    // ⇒ ≥2 terminators remain; the six locales that dropped sentence 2
    // collapse to exactly 1.
    const stripped = v.split('data/pipeline.md').join(' ').split('/career-ops pipeline').join(' ');
    const terminators = (stripped.match(/[.!?。！?…।]/g) || []).length;
    assert.ok(terminators >= 2,
      `pipe.hint[${lang}] lost its 2nd sentence (${terminators} sentence terminator outside the literals): "${v}"`);
  }
});
