/**
 * docx.mjs — a tiny, dependency-free .docx (Office Open XML) writer (v1.100.0).
 *
 * Our runtime deps are deliberately just `express` + `js-yaml` (see CLAUDE.md),
 * so rather than pull in the `docx` package we emit a minimal-but-valid .docx:
 * a STORED (uncompressed) ZIP of the four OOXML parts Word/Google Docs need
 * ([Content_Types].xml, _rels/.rels, word/document.xml, word/_rels/document.xml.rels).
 * Input is a list of blocks (headings + paragraphs + bullet lists) so callers
 * don't hand-write XML. Text is XML-escaped; no external images/fonts/links.
 *
 * A STORED zip needs a CRC-32 per entry — the standard IEEE table below.
 */
import { deflateRawSync } from 'node:zlib';

// ── CRC-32 (IEEE 802.3) ──
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

// ── minimal ZIP writer (DEFLATE entries) ──
function zip(entries) {
  const chunks = [];
  const central = [];
  let offset = 0;
  for (const { name, data } of entries) {
    const nameBuf = Buffer.from(name, 'utf8');
    const crc = crc32(data);
    const comp = deflateRawSync(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);   // local file header sig
    local.writeUInt16LE(20, 4);           // version needed
    local.writeUInt16LE(0, 6);            // flags
    local.writeUInt16LE(8, 8);            // method: 8 = deflate
    local.writeUInt16LE(0, 10);           // mod time
    local.writeUInt16LE(0x21, 12);        // mod date (1980-01-01)
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(comp.length, 18); // compressed size
    local.writeUInt32LE(data.length, 22); // uncompressed size
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);           // extra length
    chunks.push(local, nameBuf, comp);

    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);      // central dir header sig
    cd.writeUInt16LE(20, 4);              // version made by
    cd.writeUInt16LE(20, 6);              // version needed
    cd.writeUInt16LE(0, 8);
    cd.writeUInt16LE(8, 10);              // method
    cd.writeUInt16LE(0, 12);
    cd.writeUInt16LE(0x21, 14);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(comp.length, 20);
    cd.writeUInt32LE(data.length, 24);
    cd.writeUInt16LE(nameBuf.length, 28);
    cd.writeUInt16LE(0, 30);              // extra
    cd.writeUInt16LE(0, 32);              // comment
    cd.writeUInt16LE(0, 34);              // disk
    cd.writeUInt16LE(0, 36);              // internal attrs
    cd.writeUInt32LE(0, 38);              // external attrs
    cd.writeUInt32LE(offset, 42);         // local header offset
    central.push(cd, nameBuf);
    offset += local.length + nameBuf.length + comp.length;
  }
  const centralBuf = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);      // EOCD sig
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);         // central dir offset
  eocd.writeUInt16LE(0, 20);              // comment length
  return Buffer.concat([...chunks, centralBuf, eocd]);
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

// A run of text (optionally bold). `\n` inside a paragraph → line break.
function runXml(text, bold) {
  const parts = String(text).split('\n');
  const runs = parts.map((part, i) => {
    const br = i > 0 ? '<w:br/>' : '';
    return `<w:r>${bold ? '<w:rPr><w:b/></w:rPr>' : ''}${br}<w:t xml:space="preserve">${esc(part)}</w:t></w:r>`;
  });
  return runs.join('');
}

/**
 * Build a .docx Buffer from a title + blocks.
 * @param {string} title
 * @param {Array<{type:'h1'|'h2'|'p'|'bullet', text:string}>} blocks
 * @returns {Buffer}
 */
export function buildDocx(title, blocks) {
  const body = [];
  if (title) body.push(`<w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr>${runXml(title, true)}</w:p>`);
  for (const b of (Array.isArray(blocks) ? blocks : [])) {
    if (!b || !b.text) { body.push('<w:p/>'); continue; }
    if (b.type === 'h1') body.push(`<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr>${runXml(b.text, true)}</w:p>`);
    else if (b.type === 'h2') body.push(`<w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr>${runXml(b.text, true)}</w:p>`);
    else if (b.type === 'bullet') body.push(`<w:p><w:pPr><w:pStyle w:val="ListParagraph"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr>${runXml(b.text)}</w:p>`);
    else body.push(`<w:p>${runXml(b.text)}</w:p>`);
  }
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body.join('')}<w:sectPr/></w:body></w:document>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`;

  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;

  const docRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`;

  return zip([
    { name: '[Content_Types].xml', data: Buffer.from(contentTypes, 'utf8') },
    { name: '_rels/.rels', data: Buffer.from(rels, 'utf8') },
    { name: 'word/document.xml', data: Buffer.from(documentXml, 'utf8') },
    { name: 'word/_rels/document.xml.rels', data: Buffer.from(docRels, 'utf8') },
  ]);
}

/**
 * Convert lightweight Markdown (headings, bullets, blank-line paragraphs) into
 * docx blocks. Inline `**bold**`/`*em*`/`` `code` `` markers are stripped to plain
 * text (this is an export, not a fidelity converter).
 * @param {string} md @returns {Array<{type:string,text:string}>}
 */
export function markdownToBlocks(md) {
  const strip = (s) => String(s)
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/^#{1,6}\s+/, '')
    .trim();
  const blocks = [];
  for (const raw of String(md || '').split('\n')) {
    const line = raw.replace(/\s+$/, '');
    if (!line.trim()) { continue; }
    if (/^#\s+/.test(line)) blocks.push({ type: 'h1', text: strip(line) });
    else if (/^##\s+/.test(line)) blocks.push({ type: 'h2', text: strip(line) });
    else if (/^#{3,6}\s+/.test(line)) blocks.push({ type: 'h2', text: strip(line) });
    else if (/^\s*[-*+]\s+/.test(line)) blocks.push({ type: 'bullet', text: strip(line.replace(/^\s*[-*+]\s+/, '')) });
    else blocks.push({ type: 'p', text: strip(line) });
  }
  return blocks;
}
