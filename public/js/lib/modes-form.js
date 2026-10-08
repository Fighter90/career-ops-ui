/* global UI, I18n */
/**
 * v1.54.3 → v1.54.8 — structured field-form for the #/config "Modes"
 * tab. The user asked for real fields derived from the documented
 * schema, not raw markdown, AND for the fields to appear even when the
 * parent `modes/_profile.md` is empty / a non-schema stub:
 *   "разбей по полям … описание полей возьми из career-ops.org/docs"
 *
 * `modes/_profile.md` is the canonical "Career framing" file
 * (career-ops.org Quick Start §Step-5). Documented schema + the
 * per-field guidance shown to the user (paraphrased from §Step-5):
 *
 *   Target Roles      list   role types you're applying for
 *   Adaptive Framing  list   which projects/experience to highlight
 *   Exit Narrative    prose  your career story (CV summary / letters)
 *   Comp Targets      list   salary-range notes (above/below market)
 *   Location Policy   prose  remote / hybrid / on-site + strictness
 *
 * v1.54.8 changes:
 *   - The 5 canonical fields are ALWAYS rendered, in canonical order,
 *     even when the file has none of them (fresh / stub / garbage
 *     file) — so "разбей по полям" works on a brand-new profile.
 *   - Heading variants tolerated: `Target Roles` and the template's
 *     `Your Target Roles` (etc.) map to the same canonical field.
 *   - Each field shows a doc-sourced description (career-ops.org).
 *   - collect() returns a tagged payload:
 *       { mode:'sections', sections:{…} }  — non-destructive merge,
 *         used when the rendered headings exactly match the file's
 *         existing headings (nothing structurally new).
 *       { mode:'markdown', markdown:'…' }  — full-file rebuild that
 *         bootstraps/normalises a schema-conformant document
 *         (preamble preserved, canonical order, non-canonical
 *         sections kept verbatim). config.js confirm-gates this
 *         because it replaces the whole parent file (WS2 #4).
 *
 * Data-safety invariants (never lose the user's parent file):
 *   1. A canonical LIST section whose body isn't a pure bullet list
 *      falls back to a labelled verbatim <textarea>.
 *   2. Non-canonical `##` sections render as labelled verbatim
 *      <textarea>s and are preserved on save (merge OR rebuild).
 *   3. The preamble is always preserved (default doc preamble only
 *      when the file had none).
 *   4. Round-trip stable: serialise(parse(body)) re-parses identically.
 *
 * Browser-only (global script). Pure logic mirrored + proven in
 * tests/modes-form.test.mjs.
 */
(function () {
  // Canonical schema, in canonical document order. `labelKey` /
  // `descKey` are i18n keys; fallbacks keep an untranslated locale
  // sensible. `descKey` text is paraphrased from career-ops.org Quick
  // Start §Step-5 so the field guidance matches the canonical docs.
  const CANON = [
    { key: 'Target Roles',     kind: 'list',
      labelKey: 'config.modesTargetRoles',
      descKey: 'config.modesDescTargetRoles' },
    { key: 'Adaptive Framing', kind: 'list',
      labelKey: 'config.modesAdaptiveFraming',
      descKey: 'config.modesDescAdaptiveFraming' },
    { key: 'Exit Narrative',   kind: 'prose',
      labelKey: 'config.modesExitNarrative',
      descKey: 'config.modesDescExitNarrative' },
    { key: 'Comp Targets',     kind: 'list',
      labelKey: 'config.modesCompTargets',
      descKey: 'config.modesDescCompTargets' },
    { key: 'Location Policy',  kind: 'prose',
      labelKey: 'config.modesLocationPolicy',
      descKey: 'config.modesDescLocationPolicy' },
  ];
  const SCHEMA = CANON.reduce((m, f) => { m[f.key] = f; return m; }, {});

  // Default preamble used ONLY when the file had none — mirrors the
  // server inline scaffold (content.mjs) so a fresh field-form save
  // produces the same shape the parent project documents.
  const DEFAULT_PREAMBLE =
    '# Career framing (modes/_profile.md)\n\n' +
    '> This file is the most-edited per career-ops.org Quick Start §Step-5.\n' +
    '> Never committed. Fill in your target roles, framing, exit narrative,\n' +
    '> comp targets, and location policy here.\n\n';

  // Map any heading to its canonical key, tolerating the template's
  // "Your <X>" variant and surrounding whitespace.
  function canonicalKey(heading) {
    const h = String(heading || '').trim();
    if (SCHEMA[h]) return h;
    const stripped = h.replace(/^your\s+/i, '').trim();
    return SCHEMA[stripped] ? stripped : null;
  }

  const BULLET_RE = /^[ \t]*[-*+][ \t]+(.*)$/;
  // A nested bullet (an indented "- b" under "- a") must NOT enter the flat
  // list editor: parseListItems() would flatten the level away and a save
  // would silently lose the structure (v1.243.0). Such a body falls back to
  // the labelled verbatim textarea (data-safety invariant 1).
  const NESTED_BULLET_RE = /^[ \t]+[-*+][ \t]+/;

  // A body is a "pure list" iff every non-blank line is a top-level bullet
  // line. Empty bodies count as a pure (empty) list.
  function isPureList(body) {
    const lines = String(body || '').split('\n');
    let sawBullet = false;
    for (const ln of lines) {
      if (ln.trim() === '') continue;
      if (NESTED_BULLET_RE.test(ln)) return false;
      if (!ln.match(BULLET_RE)) return false;
      sawBullet = true;
    }
    return sawBullet || String(body || '').trim() === '';
  }

  function parseListItems(body) {
    return String(body || '')
      .split('\n')
      .map((ln) => { const m = ln.match(BULLET_RE); return m ? m[1].trim() : null; })
      .filter((v) => v && v.length);
  }

  function serialiseList(items) {
    const clean = (items || []).map((s) => String(s).trim()).filter(Boolean);
    if (!clean.length) return '\n\n';
    return '\n' + clean.map((s) => `- ${s}`).join('\n') + '\n\n';
  }

  function proseDisplay(body) { return String(body || '').replace(/^\n+|\n+$/g, ''); }
  function serialiseProse(value) {
    const v = String(value || '').replace(/^\n+|\n+$/g, '');
    return v ? `\n\n${v}\n\n` : '\n\n';
  }

  // A rebuilt body must carry its own separators: collect() writes
  // "## H" + body, so a body not starting with a newline glues its first
  // line onto the heading, and one not ending with a blank line glues the
  // NEXT heading onto the last body line (v1.243.0). Canonical
  // serialisers already emit this shape; verbatim textareas may not.
  function normaliseBody(body) {
    const b = String(body || '').replace(/^\n+/, '').replace(/\s+$/, '');
    return b ? '\n' + b + '\n\n' : '\n\n';
  }

  function tLabel(spec) { return I18n.t(spec.labelKey, spec.key); }

  /**
   * Build the field-form.
   * @param {{ sections?: {heading:string, body:string}[], preamble?: string }} data
   *   GET /api/modes/_profile payload (sections may be []).
   * @returns {{ host: HTMLElement, collect: () => ({mode:'sections',sections:Object}|{mode:'markdown',markdown:string}) }}
   */
  function build(data) {
    const c = UI.el;
    const host = c('div');
    const incoming = (data && Array.isArray(data.sections)) ? data.sections : [];
    const preamble = (data && typeof data.preamble === 'string' && data.preamble) || '';

    // Index existing sections by canonical key; collect non-canonical
    // ones (preserved verbatim, in original order).
    const byCanon = {};
    const nonCanon = [];
    for (const s of incoming) {
      const ck = canonicalKey(s.heading);
      if (ck && !(ck in byCanon)) byCanon[ck] = s;
      else nonCanon.push(s);
    }
    const existingHeadings = new Set(incoming.map((s) => s.heading));

    // canonical collectors: () => { heading, body }
    const canonCollectors = [];

    CANON.forEach((spec, idx) => {
      const existing = byCanon[spec.key];
      // Reuse the file's actual heading variant if it had one, so a
      // pure merge doesn't rename "Your Target Roles" → "Target Roles".
      const heading = existing ? existing.heading : spec.key;
      const body = existing ? (existing.body || '') : '';
      const fieldId = 'modesf-' + idx + '-' + spec.key.toLowerCase().replace(/[^a-z0-9]+/g, '-');

      const card = c('div', { className: 'card', style: { padding: '14px 16px', marginBottom: '12px' } });
      card.appendChild(c('label', {
        htmlFor: fieldId,
        style: { display: 'block', fontWeight: 600, fontSize: '14px', marginBottom: '4px' },
      }, tLabel(spec)));
      // Doc-sourced field guidance (career-ops.org §Step-5).
      card.appendChild(c('p', {
        id: fieldId + '-desc',
        style: { color: 'var(--foggy)', fontSize: '12px', margin: '0 0 8px' },
      }, I18n.t(spec.descKey, '')));

      if (spec.kind === 'list' && isPureList(body)) {
        const rows = c('div', { id: fieldId, style: { display: 'flex', flexDirection: 'column', gap: '6px' } });
        const inputs = [];
        const addRow = (val) => {
          const inp = c('input', {
            type: 'text', className: 'input', value: val || '',
            'aria-label': tLabel(spec) + ' — ' + I18n.t('config.modesItemAria', 'line') + ' ' + (inputs.length + 1),
            'aria-describedby': fieldId + '-desc',
            style: { flex: '1' },
          });
          const rm = c('button', {
            type: 'button', className: 'btn btn-ghost btn-sm',
            'aria-label': I18n.t('config.modesRemoveItem', 'Remove line'),
            onClick: () => {
              const i = inputs.indexOf(inp);
              if (i >= 0) inputs.splice(i, 1);
              row.remove();
            },
          }, '✕');
          const row = c('div', { className: 'flex gap-3', style: { alignItems: 'center' } }, [inp, rm]);
          inputs.push(inp);
          rows.appendChild(row);
        };
        const items = parseListItems(body);
        if (items.length) items.forEach(addRow); else addRow('');
        card.appendChild(rows);
        card.appendChild(c('button', {
          type: 'button', className: 'btn btn-ghost btn-sm', style: { marginTop: '8px' },
          onClick: () => addRow(''),
        }, '＋ ' + I18n.t('config.modesAddItem', 'Add line')));
        canonCollectors.push(() => ({ heading, body: serialiseList(inputs.map((i) => i.value)) }));
      } else if (spec.kind === 'prose') {
        const ta = c('textarea', {
          id: fieldId, className: 'textarea', rows: 6,
          'aria-describedby': fieldId + '-desc',
          style: { width: '100%', fontSize: '13px' },
        });
        ta.value = proseDisplay(body);
        card.appendChild(ta);
        canonCollectors.push(() => ({ heading, body: serialiseProse(ta.value) }));
      } else {
        // canonical LIST with non-list content → verbatim fallback.
        card.appendChild(c('p', {
          style: { color: 'var(--foggy)', fontSize: '12px', margin: '0 0 8px' },
        }, I18n.t('config.modesNonListNote',
          'This section isn\'t a simple list — editing as raw text to avoid data loss.')));
        const ta = c('textarea', {
          id: fieldId, className: 'textarea', rows: 8,
          'aria-describedby': fieldId + '-desc',
          style: { width: '100%', fontFamily: 'ui-monospace,monospace', fontSize: '13px' },
        });
        ta.value = body;
        card.appendChild(ta);
        canonCollectors.push(() => ({ heading, body: ta.value }));
      }
      host.appendChild(card);
    });

    // Non-canonical sections — labelled verbatim textareas (data-safety).
    const nonCanonCollectors = [];
    nonCanon.forEach((s, i) => {
      const fieldId = 'modesf-x-' + i;
      const card = c('div', { className: 'card', style: { padding: '14px 16px', marginBottom: '12px' } });
      card.appendChild(c('label', {
        htmlFor: fieldId,
        style: { display: 'block', fontWeight: 600, fontSize: '14px', marginBottom: '4px' },
      }, s.heading));
      card.appendChild(c('p', {
        style: { color: 'var(--foggy)', fontSize: '12px', margin: '0 0 8px' },
      }, I18n.t('config.modesUnknownNote',
        'Custom section (not in the standard schema) — editing as raw text.')));
      const ta = c('textarea', {
        id: fieldId, className: 'textarea', rows: 6,
        style: { width: '100%', fontFamily: 'ui-monospace,monospace', fontSize: '13px' },
      });
      ta.value = s.body || '';
      card.appendChild(ta);
      nonCanonCollectors.push(() => ({ heading: s.heading, body: ta.value }));
      host.appendChild(card);
    });

    function collect() {
      const canon = canonCollectors.map((fn) => fn());
      const extra = nonCanonCollectors.map((fn) => fn());
      const rendered = [...canon, ...extra];
      const renderedHeadings = new Set(rendered.map((r) => r.heading));

      // Non-destructive merge is valid ONLY when we'd write exactly the
      // headings the file already has (same membership) — i.e. nothing
      // structurally new. The server's { sections } path rejects
      // unknown headings, so anything else must be a full rebuild.
      const sameMembership =
        renderedHeadings.size === existingHeadings.size &&
        [...renderedHeadings].every((h) => existingHeadings.has(h));

      if (sameMembership && existingHeadings.size > 0) {
        const sections = {};
        for (const r of rendered) sections[r.heading] = r.body;
        return { mode: 'sections', sections };
      }
      // Full-file rebuild: preamble + canonical (in order) + extras.
      const pre = preamble || DEFAULT_PREAMBLE;
      const md = pre + rendered.map((r) =>
        `## ${r.heading}${normaliseBody(r.body)}`).join('');
      return { mode: 'markdown', markdown: md };
    }

    return { host, collect };
  }

  window.ModesForm = {
    build,
    _schema: SCHEMA,
    _canon: CANON,
    _canonicalKey: canonicalKey,
    _isPureList: isPureList,
    _parseListItems: parseListItems,
    _serialiseList: serialiseList,
    _proseDisplay: proseDisplay,
    _serialiseProse: serialiseProse,
    _normaliseBody: normaliseBody,
    _defaultPreamble: DEFAULT_PREAMBLE,
  };
})();
