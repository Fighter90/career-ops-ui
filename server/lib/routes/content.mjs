/**
 * Content routes — read/write of the project's text artifacts:
 *   GET  /api/cv          → { markdown }
 *   PUT  /api/cv          → save (sanitized) markdown
 *   POST /api/cv/import   → convert uploaded docx/pdf/html/… to markdown
 *   GET  /api/profile     → { profile, raw }
 *   PUT  /api/profile     → write the YAML body (validated)
 *   GET  /api/portals     → { portals, raw }
 *   GET  /api/modes       → { modes: string[] }
 *   GET  /api/modes/:name → text/plain
 *
 * Writes are explicit user actions. CV ingress goes through
 * stripDangerousMarkdown; profile YAML is parsed before write so
 * malformed input fails fast with 400.
 */
import express from 'express';
import multer from 'multer';
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import yaml from 'js-yaml';
import { PATHS, path as projPath } from '../paths.mjs';
import { stripDangerousMarkdown, sanitizePathName } from '../security.mjs';
import { logActivity } from '../activity-log.mjs';
import { importDocumentToMarkdown, MAX_UPLOAD_BYTES } from '../cv-import.mjs';

// v1.13.0 (PR-4 full) — multer for proper multipart parsing. The
// v1.10.2 415-reject path was a stopgap; this is the real fix. Memory
// storage so we hand the same Buffer to importDocumentToMarkdown
// without writing to disk first. Size cap mirrors the octet-stream
// limit (10 MB).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
});

export function registerContentRoutes(app) {
  // ─── CV ───
  app.get('/api/cv', (_req, res) => {
    // NEW-D3-cache (v1.59.7) — `cv.md` is the user-edited primary
    // artifact; a stale browser cache served by an intermediary or
    // dev-tools "Disable cache" toggle could surface yesterday's text
    // and trick the editor into saving over it. Match the SPA-shell
    // policy (W-001 / v1.54.7) — always revalidate. No ETag dance:
    // the file is small and the GET is rare.
    res.setHeader('Cache-Control', 'no-store');
    if (!existsSync(PATHS.cv)) return res.json({ markdown: '' });
    res.json({ markdown: readFileSync(PATHS.cv, 'utf8') });
  });

  app.put('/api/cv', (req, res) => {
    const raw = (req.body?.markdown ?? req.body) || '';
    if (typeof raw !== 'string' || !raw.trim()) {
      return res.status(400).json({ error: 'markdown body required' });
    }
    if (raw.length > 1024 * 1024) {
      return res.status(413).json({ error: 'markdown too large (max 1MB)' });
    }
    const md = stripDangerousMarkdown(raw);
    writeFileSync(PATHS.cv, md);
    res.json({ ok: true, bytes: md.length, sanitized: md.length !== raw.length });
  });

  // ─── CV import ───
  // v1.13.0 (PR-4 full) — accepts BOTH:
  //   • Content-Type: application/octet-stream + X-Filename: <name>
  //     (the original SPA contract — preserved verbatim, no behavior
  //     change for existing clients).
  //   • Content-Type: multipart/form-data with a `file` field
  //     (curl -F file=@cv.docx, Postman default, any standard HTTP
  //     client). The previous v1.10.2 415-reject was a stopgap; multer
  //     now parses the multipart envelope properly and extracts the
  //     first file part regardless of field name.
  //
  // Both paths feed the same `importDocumentToMarkdown` converter and
  // the same `stripDangerousMarkdown` XSS pass — no behaviour drift.
  // Conversion errors come back as 422 with `{ ok:false, error, hint }`;
  // payload-too-large is caught by the global error handler from F-019
  // and returned as 413 JSON.
  app.post(
    '/api/cv/import',
    // Dispatch on Content-Type. multer's `.any()` accepts any field name;
    // express.raw handles the original octet-stream wire format. Both
    // run with the same `MAX_UPLOAD_BYTES` cap.
    (req, res, next) => {
      const ct = (req.headers['content-type'] || '').toLowerCase();
      if (ct.startsWith('multipart/')) return upload.any()(req, res, next);
      return express.raw({ type: '*/*', limit: MAX_UPLOAD_BYTES })(req, res, next);
    },
    async (req, res) => {
      let buf = null;
      let filename = 'upload.txt';

      const ct = (req.headers['content-type'] || '').toLowerCase();
      if (ct.startsWith('multipart/')) {
        // multer populated req.files with parsed parts.
        const file = (req.files && req.files[0]) || null;
        if (!file) {
          return res.status(400).json({
            ok: false,
            error: 'multipart body has no file part',
            hint: 'send a `file` field with the file bytes',
          });
        }
        buf = file.buffer;
        filename = file.originalname || 'upload.bin';
      } else {
        // Original octet-stream path. X-Filename gives the extension hint.
        filename = (req.headers['x-filename'] || 'upload.txt').toString();
        buf = Buffer.isBuffer(req.body) ? req.body : null;
        if (!buf || buf.length === 0) {
          return res.status(400).json({
            error: 'empty body — upload the file as the request body with X-Filename header',
          });
        }
        // Defense in depth: octet-stream with multipart bytes inside is
        // a misconfigured client. Still reject — this is unambiguously wrong.
        const preview = buf.slice(0, 256).toString('latin1');
        if (/Content-Disposition:\s*form-data/i.test(preview)) {
          return res.status(415).json({
            ok: false,
            error: 'request body looks like multipart/form-data under octet-stream Content-Type',
            hint: 'either switch to Content-Type: multipart/form-data, or POST raw bytes',
          });
        }
      }

      try {
        const result = await importDocumentToMarkdown(buf, filename);
        if (!result.ok) return res.status(422).json(result);
        result.markdown = stripDangerousMarkdown(result.markdown);
        res.json(result);
      } catch (e) {
        res.status(500).json({ ok: false, error: e.message });
      }
    },
  );

  // ─── Profile ───
  // G-009 (v1.15.0): summarizer accepts BOTH the legacy schema
  // (candidate:{full_name,email,linkedin}, target:{roles,
  // comp_total_min_usd, archetypes}) AND the canonical career-ops.org
  // schema (top-level full_name/email/location/narrative.headline,
  // target_roles.primary, compensation.target_range). Legacy fields
  // win when both are present so existing YAMLs continue to render
  // identically.
  function parseCompRange(s) {
    if (!s || typeof s !== 'string') return null;
    // Match shapes like "$120K-160K", "120000-160000 USD", "€100k–120k", "120K+"
    const norm = s.replace(/[€$£¥]/g, '').replace(/[,\s]/g, '');
    const m = norm.match(/(\d+)\s*[Kk]?\s*[-–~]\s*(\d+)\s*[Kk]?/);
    if (m) {
      const lo = Number(m[1]) * (norm.toLowerCase().includes('k') ? 1000 : 1);
      const hi = Number(m[2]) * (norm.toLowerCase().includes('k') ? 1000 : 1);
      return { min: Math.min(lo, hi), max: Math.max(lo, hi) };
    }
    const single = norm.match(/(\d+)\s*[Kk]?\+?$/);
    if (single) return { min: Number(single[1]) * (norm.toLowerCase().includes('k') ? 1000 : 1), max: null };
    return null;
  }

  function summarizeProfile(p) {
    if (!p || typeof p !== 'object') return null;
    const candidate = (p.candidate && typeof p.candidate === 'object') ? p.candidate : {};
    const target = (p.target && typeof p.target === 'object') ? p.target : {};
    const targetRoles = (p.target_roles && typeof p.target_roles === 'object') ? p.target_roles : {};
    const compensation = (p.compensation && typeof p.compensation === 'object') ? p.compensation : {};
    const narrative = (p.narrative && typeof p.narrative === 'object') ? p.narrative : {};
    return {
      full_name: candidate.full_name || p.full_name || null,
      email:     candidate.email     || p.email     || null,
      linkedin:  candidate.linkedin  || p.linkedin  || null,
      github:    candidate.github    || p.github    || null,
      location:  candidate.location  || p.location  || null,
      headline:  candidate.headline  || narrative.headline || null,
      target_roles: Array.isArray(target.roles) ? target.roles
                  : (Array.isArray(targetRoles.primary) ? targetRoles.primary : []),
      comp_min_usd: target.comp_total_min_usd
                    ?? parseCompRange(compensation.target_range)?.min
                    ?? null,
      archetypes: Array.isArray(target.archetypes) ? target.archetypes : [],
    };
  }

  app.get('/api/profile', (_req, res) => {
    if (!existsSync(PATHS.profile)) return res.json({ profile: null, summary: null });
    try {
      const text = readFileSync(PATHS.profile, 'utf8');
      const parsed = yaml.load(text);
      res.json({ profile: parsed, raw: text, summary: summarizeProfile(parsed) });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // v1.32.0 (WS1) — allow-list of scalar dotted paths the #/config
  // Profile field-form models. Editing any of these via the form does
  // a server-side MERGE: read → parse → set/delete only these leaves →
  // re-serialize. Every other key (target_roles, archetypes,
  // proof_points, superpowers, unknown keys) survives untouched —
  // tests/profile-field-form.test.mjs locks that invariant.
  const PROFILE_FIELD_PATHS = new Set([
    'candidate.full_name', 'candidate.email', 'candidate.phone',
    'candidate.location', 'candidate.linkedin', 'candidate.github',
    'candidate.portfolio_url', 'candidate.twitter',
    'narrative.headline', 'narrative.exit_story',
    'compensation.target_range', 'compensation.currency',
    'compensation.minimum', 'compensation.location_flexibility',
  ]);

  // v1.35.0 (WS6.4) — structured array editors. Each path maps to an
  // item shape: 'string' = a list of trimmed strings; otherwise an
  // allow-list of object sub-keys (every other key on an incoming row
  // is dropped — the form is the schema). Same merge-not-replace
  // contract as the scalar `fields` path: only these array leaves are
  // touched, everything else in profile.yml survives untouched.
  const PROFILE_ARRAY_SPECS = {
    'target_roles.primary':     'string',
    'narrative.superpowers':    'string',
    'target_roles.archetypes':  ['name', 'level', 'fit'],
    'narrative.proof_points':   ['name', 'url', 'hero_metric'],
  };

  // Reject prototype-pollution keys defensively. The dotted paths here come from
  // a fixed field spec (not raw request keys), so this is belt-and-braces — but
  // it makes the write provably safe against `__proto__`/`constructor`/`prototype`.
  const UNSAFE_KEY = (k) => k === '__proto__' || k === 'constructor' || k === 'prototype';

  function setArray(obj, path, rawValue, spec) {
    const parts = path.split('.');
    const leaf = parts.pop();
    if (parts.some(UNSAFE_KEY) || UNSAFE_KEY(leaf)) return;
    let node = obj;
    for (const p of parts) {
      if (node[p] == null || typeof node[p] !== 'object' || Array.isArray(node[p])) node[p] = {};
      node = node[p];
    }
    const arr = Array.isArray(rawValue) ? rawValue : [];
    let cleaned;
    if (spec === 'string') {
      cleaned = arr.map((v) => String(v ?? '').trim()).filter(Boolean);
    } else {
      cleaned = arr
        .map((row) => {
          if (!row || typeof row !== 'object' || Array.isArray(row)) return null;
          const out = {};
          for (const k of spec) {
            const v = String(row[k] ?? '').trim();
            if (v) out[k] = v;
          }
          return Object.keys(out).length ? out : null;
        })
        .filter(Boolean);
    }
    // Empty list → remove the leaf so a cleared editor round-trips
    // cleanly (no `superpowers: []` residue).
    if (cleaned.length === 0) delete node[leaf];
    else node[leaf] = cleaned;
  }

  function setDotted(obj, path, value) {
    const parts = path.split('.');
    const leaf = parts.pop();
    if (parts.some(UNSAFE_KEY) || UNSAFE_KEY(leaf)) return;
    let node = obj;
    for (const p of parts) {
      if (node[p] == null || typeof node[p] !== 'object' || Array.isArray(node[p])) node[p] = {};
      node = node[p];
    }
    const v = String(value ?? '').trim();
    if (v === '') {
      // Empty field → remove the leaf so a cleared input round-trips
      // cleanly instead of writing `phone: ''`.
      delete node[leaf];
    } else {
      node[leaf] = v;
    }
  }

  app.put('/api/profile', (req, res) => {
    // ── v1.32.0 — field-form merge path: { fields: { "candidate.full_name": … } } ──
    const hasFields = req.body && req.body.fields && typeof req.body.fields === 'object' && !Array.isArray(req.body.fields);
    const hasArrays = req.body && req.body.arrays && typeof req.body.arrays === 'object' && !Array.isArray(req.body.arrays);
    if (hasFields || hasArrays) {
      const incoming = hasFields ? req.body.fields : {};
      const incomingArrays = hasArrays ? req.body.arrays : {};
      const badPath = Object.keys(incoming).find((k) => !PROFILE_FIELD_PATHS.has(k));
      if (badPath) {
        return res.status(400).json({ error: `unknown profile field path: ${badPath}` });
      }
      const badArrayPath = Object.keys(incomingArrays).find((k) => !(k in PROFILE_ARRAY_SPECS));
      if (badArrayPath) {
        return res.status(400).json({ error: `unknown profile array path: ${badArrayPath}` });
      }
      let base = {};
      if (existsSync(PATHS.profile)) {
        try {
          const parsedBase = yaml.load(readFileSync(PATHS.profile, 'utf8'));
          if (parsedBase && typeof parsedBase === 'object' && !Array.isArray(parsedBase)) {
            base = parsedBase;
          }
        } catch {
          // Corrupt existing file → don't silently nuke it; force the
          // user through the raw editor to see the parse error first.
          return res.status(409).json({
            error: 'existing profile.yml is not valid YAML — fix it via the Raw YAML editor before using the field form',
          });
        }
      }
      for (const [path, value] of Object.entries(incoming)) setDotted(base, path, value);
      for (const [path, value] of Object.entries(incomingArrays)) {
        setArray(base, path, value, PROFILE_ARRAY_SPECS[path]);
      }
      // Same identity gate as the raw path.
      const okCandidate = base.candidate && typeof base.candidate === 'object'
        && typeof base.candidate.full_name === 'string' && base.candidate.full_name.trim();
      const okCanonical = typeof base.full_name === 'string' && base.full_name.trim();
      if (!okCandidate && !okCanonical) {
        return res.status(400).json({ error: 'full name is required (candidate.full_name)' });
      }
      let serialized;
      try {
        serialized = yaml.dump(base, { lineWidth: 100, noRefs: true });
      } catch (e) {
        return res.status(500).json({ error: 'failed to serialize profile: ' + e.message });
      }
      const hdr = '# Career-Ops Profile Configuration\n';
      const out = hdr + serialized;
      if (out.length > 256 * 1024) {
        return res.status(413).json({ error: 'profile too large (max 256 KB)' });
      }
      const d = dirname(PATHS.profile);
      if (!existsSync(d)) mkdirSync(d, { recursive: true });
      writeFileSync(PATHS.profile, out);
      const sum = summarizeProfile(base);
      return res.json({ ok: true, mode: 'fields', bytes: out.length, candidate: sum?.full_name || null, summary: sum });
    }

    // ── Raw-YAML escape-hatch path (unchanged — power users / comment preservation) ──
    const raw = (req.body?.yaml ?? '').toString();
    if (!raw.trim()) {
      return res.status(400).json({ error: 'yaml body required (string under "yaml" key)' });
    }
    if (raw.length > 256 * 1024) {
      return res.status(413).json({ error: 'profile yaml too large (max 256 KB)' });
    }
    let parsed;
    try {
      parsed = yaml.load(raw);
    } catch (e) {
      return res.status(400).json({ error: 'invalid YAML: ' + e.message });
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return res.status(400).json({ error: 'profile must be a YAML mapping' });
    }
    // G-009: accept EITHER legacy `candidate:` block OR canonical top-level `full_name:`.
    const hasCandidate = parsed.candidate && typeof parsed.candidate === 'object';
    const hasCanonical = typeof parsed.full_name === 'string' && parsed.full_name.trim();
    if (!hasCandidate && !hasCanonical) {
      return res.status(400).json({
        error: 'profile.candidate.full_name OR top-level full_name is required',
      });
    }
    // Stamp a header so the file remains identifiable when shared.
    const header = '# Career-Ops Profile Configuration\n';
    const body = raw.startsWith('#') ? raw : header + raw;
    const dir = dirname(PATHS.profile);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(PATHS.profile, body);
    const summary = summarizeProfile(parsed);
    res.json({ ok: true, bytes: body.length, candidate: summary?.full_name || null, summary });
  });

  // ─── Portals ───
  app.get('/api/portals', (_req, res) => {
    if (!existsSync(PATHS.portals)) return res.json({ portals: null });
    try {
      const text = readFileSync(PATHS.portals, 'utf8');
      res.json({ portals: yaml.load(text), raw: text });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // ─── Modes (prompt templates) ───
  app.get('/api/modes', (_req, res) => {
    if (!existsSync(PATHS.modesDir)) return res.json({ modes: [] });
    const list = readdirSync(PATHS.modesDir)
      .filter((f) => f.endsWith('.md'))
      .map((f) => f.replace(/\.md$/, ''));
    res.json({ modes: list });
  });

  // G-008 (v1.15.0) — modes/_profile.md as a first-class editable file.
  // MUST be registered BEFORE /api/modes/:name (next handler) so the
  // literal path wins. Returns JSON {markdown, bytes} (not text/plain
  // like the generic mode getter) because the editor needs metadata.
  // Scaffold from _profile.template.md if missing on first read.
  app.get('/api/modes/_profile', (_req, res) => {
    try {
      let markdown = '';
      if (existsSync(PATHS.modesProfile)) {
        markdown = readFileSync(PATHS.modesProfile, 'utf8');
      } else if (existsSync(PATHS.modesProfileTemplate)) {
        markdown = readFileSync(PATHS.modesProfileTemplate, 'utf8');
        // Don't persist on read — let the user opt in by hitting Save.
      } else {
        markdown = [
          '# Career framing (modes/_profile.md)',
          '',
          '> This file is the most-edited per career-ops.org Quick Start §Step-5.',
          '> Never committed. Fill in your target roles, framing, exit narrative,',
          '> comp targets, and location policy here.',
          '',
          '## Target Roles',
          '',
          '- ',
          '',
          '## Adaptive Framing',
          '',
          '- ',
          '',
          '## Exit Narrative',
          '',
          '',
          '',
          '## Comp Targets',
          '',
          '- ',
          '',
          '## Location Policy',
          '',
          '',
          '',
        ].join('\n');
      }
      // v1.36.0 (WS6.3) — also expose the parsed section structure so
      // the Modes tab can render a per-section editor without
      // re-parsing markdown client-side.
      const parsed = splitProfileSections(markdown);
      res.json({
        markdown,
        bytes: Buffer.byteLength(markdown),
        scaffolded: !existsSync(PATHS.modesProfile),
        preamble: parsed.preamble,
        sections: parsed.sections,
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // v1.36.0 (WS6.3) — split `_profile.md` into [preamble, ...sections]
  // where each section starts at a top-level `## ` heading. Preamble =
  // everything before the first `## `. Returns { preamble, sections:
  // [{ heading, body }] } preserving order. `_profile.md` is a
  // prompt-engineering doc (tables + prose), so section-level editing
  // (not field decomposition) is the right granularity.
  // Byte-exact split: a section spans from its `## ` heading LINE
  // through the char just before the next top-level `## ` (or EOF).
  // `headingLine` keeps the heading verbatim (incl. trailing newline);
  // `body` is everything after it. Round-trip = preamble +
  // Σ(headingLine + body) reproduces the input byte-for-byte, so
  // editing one body never perturbs another section's whitespace.
  function splitProfileSections(md) {
    const src = String(md ?? '');
    const re = /^##[ \t]+(.+?)[ \t]*\r?\n/gm;
    const marks = [];
    let m;
    while ((m = re.exec(src)) !== null) {
      marks.push({ heading: m[1], start: m.index, headingEnd: re.lastIndex });
    }
    if (marks.length === 0) return { preamble: src, sections: [] };
    const preamble = src.slice(0, marks[0].start);
    const sections = marks.map((mk, i) => {
      const end = i + 1 < marks.length ? marks[i + 1].start : src.length;
      return {
        heading: mk.heading,
        headingLine: src.slice(mk.start, mk.headingEnd),
        body: src.slice(mk.headingEnd, end),
      };
    });
    return { preamble, sections };
  }
  function joinProfileSections(preamble, sections) {
    return preamble + sections.map((s) =>
      (s.headingLine ?? `## ${s.heading}\n`) + s.body).join('');
  }

  app.put('/api/modes/_profile', (req, res) => {
    // ── v1.36.0 — section-merge path: { sections: { "<heading>": "<body>" } } ──
    if (req.body && req.body.sections && typeof req.body.sections === 'object' && !Array.isArray(req.body.sections)) {
      const incoming = req.body.sections;
      let baseMd = '';
      if (existsSync(PATHS.modesProfile)) baseMd = readFileSync(PATHS.modesProfile, 'utf8');
      else if (existsSync(PATHS.modesProfileTemplate)) baseMd = readFileSync(PATHS.modesProfileTemplate, 'utf8');
      const { preamble, sections } = splitProfileSections(baseMd);
      const known = new Set(sections.map((s) => s.heading));
      // Reject headings the current file doesn't have — the form only
      // edits existing sections; adding new ones goes through raw.
      const bad = Object.keys(incoming).find((h) => !known.has(h));
      if (bad) {
        return res.status(400).json({ error: `unknown _profile.md section: "${bad}" — add new sections via the raw editor` });
      }
      // Replace ONLY provided sections; every other section + the
      // preamble + ordering survive untouched (merge-not-replace).
      const merged = sections.map((s) =>
        (s.heading in incoming)
          ? { heading: s.heading, headingLine: s.headingLine, body: String(incoming[s.heading] ?? '') }
          : s);
      const rebuilt = joinProfileSections(preamble, merged);
      const cleaned = stripDangerousMarkdown(rebuilt);
      if (Buffer.byteLength(cleaned) > 256 * 1024) {
        return res.status(413).json({ error: 'modes/_profile.md too large (max 256 KB)' });
      }
      const d = dirname(PATHS.modesProfile);
      if (!existsSync(d)) mkdirSync(d, { recursive: true });
      writeFileSync(PATHS.modesProfile, cleaned);
      logActivity({ type: 'modes_profile.save', target: 'modes/_profile.md', bytes: Buffer.byteLength(cleaned) });
      return res.json({ ok: true, mode: 'sections', sanitized: cleaned !== rebuilt, bytes: Buffer.byteLength(cleaned) });
    }

    const md = req.body?.markdown;
    if (typeof md !== 'string') {
      return res.status(400).json({ error: 'markdown body required (string under "markdown" key)' });
    }
    if (Buffer.byteLength(md) > 256 * 1024) {
      return res.status(413).json({ error: 'modes/_profile.md too large (max 256 KB)' });
    }
    const sanitized = stripDangerousMarkdown(md);
    const dir = dirname(PATHS.modesProfile);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(PATHS.modesProfile, sanitized);
    logActivity({
      type: 'modes_profile.save',
      target: 'modes/_profile.md',
      bytes: Buffer.byteLength(sanitized),
    });
    res.json({
      ok: true,
      sanitized: sanitized !== md,
      bytes: Buffer.byteLength(sanitized),
    });
  });

  app.get('/api/modes/:name', (req, res) => {
    const name = sanitizePathName(req.params.name);
    if (!name) return res.status(400).json({ error: 'invalid mode name' });
    const file = projPath('modes', `${name}.md`);
    if (!existsSync(file)) return res.status(404).json({ error: 'not found' });
    res.type('text/plain').send(readFileSync(file, 'utf8'));
  });
}
