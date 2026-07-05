/**
 * Document export routes (v1.100.0).
 *
 *   POST /api/export/docx   { title?, markdown } → a .docx download
 *
 * Stateless: takes Markdown the client already has (two-pager, career plan,
 * orientation, a report) and returns a Word document built by the dependency-free
 * `server/lib/docx.mjs`. No file writes, no LLM, no user-supplied URL fetched.
 * The Markdown is a body the user assembled/reviewed in-browser; it never touches
 * cv.md / profile / disk. Bounded so a runaway paste can't OOM the process.
 */
import { buildDocx, markdownToBlocks } from '../docx.mjs';

const MAX_MD = 200_000; // 200 KB of markdown is plenty for a two-pager / report

function safeName(s) {
  return String(s || 'document').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'document';
}

export function registerExportRoutes(app) {
  app.post('/api/export/docx', (req, res) => {
    const body = (req.body && typeof req.body === 'object') ? req.body : {};
    const md = (typeof body.markdown === 'string' ? body.markdown : '').slice(0, MAX_MD);
    if (!md.trim()) return res.status(400).json({ error: 'markdown is required' });
    const title = (typeof body.title === 'string' ? body.title : '').slice(0, 200).trim();
    try {
      const buf = buildDocx(title, markdownToBlocks(md));
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${safeName(title || 'document')}.docx"`);
      res.setHeader('Content-Length', String(buf.length));
      res.end(buf);
    } catch (e) {
      res.status(500).json({ error: String((e && e.message) || e).slice(0, 200) });
    }
  });
}
