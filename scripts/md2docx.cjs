// Regenerate the Word copies: node scripts/md2docx.cjs <in.md> <out.docx> "<subtitle>" (needs: npm i -g docx)
// Minimal Markdown -> DOCX for our planning docs: headings, paragraphs,
// bullets, numbered lists, tables, blockquotes, code/mermaid blocks, inline
// **bold**, `code`, [links](url). Usage: node md2docx.cjs in.md out.docx "Subtitle"
const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell,
  WidthType, ShadingType, BorderStyle, LevelFormat, AlignmentType, Footer, PageNumber, ExternalHyperlink,
} = require("docx");

const [, , input, output, subtitle] = process.argv;
const md = fs.readFileSync(input, "utf8").replace(/\r/g, "");
const lines = md.split("\n");
const ACCENT = "426337";
const FONT = "Arial";
const TABLE_W = 9360;

function inline(text, base = {}) {
  const runs = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\)|_[^_]+_|\*[^*\s][^*]*\*)/g;
  let last = 0, m;
  const plain = (t) => t && runs.push(new TextRun({ text: t, font: FONT, ...base }));
  while ((m = re.exec(text))) {
    plain(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("**")) runs.push(new TextRun({ text: tok.slice(2, -2), bold: true, font: FONT, ...base }));
    else if (tok.startsWith("`")) runs.push(new TextRun({ text: tok.slice(1, -1), font: "Consolas", ...base, size: (base.size ?? 21) - 2 }));
    else if (tok.startsWith("_") || (tok.startsWith("*") && !tok.startsWith("**"))) runs.push(new TextRun({ text: tok.slice(1, -1), italics: true, font: FONT, ...base }));
    else {
      const [, label, url] = tok.match(/\[([^\]]+)\]\(([^)]+)\)/);
      if (/^https?:/.test(url))
        runs.push(new ExternalHyperlink({ link: url, children: [new TextRun({ text: label, style: "Hyperlink", font: FONT, ...base })] }));
      else runs.push(new TextRun({ text: label, font: FONT, ...base, color: ACCENT }));
    }
    last = m.index + tok.length;
  }
  plain(text.slice(last));
  return runs;
}

const cellBorder = { style: BorderStyle.SINGLE, size: 4, color: "C9D1C0" };
function table(rows) {
  const cells = rows.map((r) => r.replace(/^\||\|$/g, "").split("|").map((c) => c.trim()));
  const header = cells[0];
  const body = cells.slice(2);
  const n = header.length;
  // Proportional widths from content length, with a floor.
  const len = header.map((_, i) => Math.max(...cells.filter((_, j) => j !== 1).map((r) => (r[i] ?? "").length), 4));
  const total = len.reduce((a, b) => a + Math.min(b, 60), 0);
  let widths = len.map((l) => Math.max(900, Math.round((Math.min(l, 60) / total) * TABLE_W)));
  const scale = TABLE_W / widths.reduce((a, b) => a + b, 0);
  widths = widths.map((w) => Math.floor(w * scale));
  widths[n - 1] += TABLE_W - widths.reduce((a, b) => a + b, 0);
  const mkRow = (r, head) =>
    new TableRow({
      tableHeader: head,
      children: header.map((_, i) =>
        new TableCell({
          width: { size: widths[i], type: WidthType.DXA },
          borders: { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder },
          shading: head ? { type: ShadingType.CLEAR, fill: "E4EDD6", color: "auto" } : undefined,
          margins: { top: 60, bottom: 60, left: 100, right: 100 },
          children: [new Paragraph({ children: inline(r[i] ?? "", { size: 18, bold: head || undefined }) })],
        }),
      ),
    });
  return new Table({
    width: { size: TABLE_W, type: WidthType.DXA },
    columnWidths: widths,
    // A Markdown table with an empty header (| | |) is a key/value block: no header row.
    rows: header.every((h) => !h) ? body.map((r) => mkRow(r, false)) : [mkRow(header, true), ...body.map((r) => mkRow(r, false))],
  });
}

const children = [];
let i = 0;
let first = true;
while (i < lines.length) {
  const line = lines[i];
  if (/^```/.test(line)) {
    const lang = line.slice(3).trim();
    const block = [];
    i++;
    while (i < lines.length && !/^```/.test(lines[i])) block.push(lines[i++]);
    i++;
    if (lang === "mermaid") {
      children.push(new Paragraph({ spacing: { before: 80, after: 120 }, children: [new TextRun({ text: "Diagram: shown in the Markdown version of this document (GitHub renders it).", italics: true, color: "63705F", font: FONT, size: 18 })] }));
    } else {
      for (const b of block)
        children.push(new Paragraph({ shading: { type: ShadingType.CLEAR, fill: "F1F3EE", color: "auto" }, children: [new TextRun({ text: b || " ", font: "Consolas", size: 18 })] }));
    }
    continue;
  }
  if (/^\|/.test(line)) {
    const rows = [];
    while (i < lines.length && /^\|/.test(lines[i])) rows.push(lines[i++]);
    children.push(table(rows));
    children.push(new Paragraph({ spacing: { after: 80 }, children: [] }));
    continue;
  }
  const h = line.match(/^(#{1,4}) (.*)/);
  if (h) {
    const level = h[1].length;
    if (level === 1 && first) {
      children.push(new Paragraph({ heading: HeadingLevel.TITLE, children: inline(h[2]) }));
      if (subtitle) children.push(new Paragraph({ spacing: { after: 240 }, children: [new TextRun({ text: subtitle, color: "63705F", font: FONT, size: 22 })] }));
      first = false;
    } else {
      const map = { 1: HeadingLevel.HEADING_1, 2: HeadingLevel.HEADING_1, 3: HeadingLevel.HEADING_2, 4: HeadingLevel.HEADING_3 };
      children.push(new Paragraph({ heading: map[level], children: inline(h[2].replace(/\*\*/g, "")) }));
    }
    i++;
    continue;
  }
  if (/^---\s*$/.test(line)) {
    children.push(new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "DDE3D5", space: 1 } }, children: [] }));
    i++;
    continue;
  }
  const b = line.match(/^(\s*)[-*] (?:\[( |x)\] )?(.*)/);
  if (b) {
    const level = Math.min(1, Math.floor(b[1].length / 2));
    const box = b[2] === undefined ? "" : b[2] === "x" ? "☑ " : "☐ ";
    children.push(new Paragraph({ numbering: { reference: "bullets", level }, children: inline(box + b[3]) }));
    i++;
    continue;
  }
  const n = line.match(/^(\d+)\. (.*)/);
  if (n) {
    children.push(new Paragraph({ numbering: { reference: "numbers", level: 0 }, children: inline(n[2]) }));
    i++;
    continue;
  }
  const q = line.match(/^> ?(.*)/);
  if (q) {
    children.push(new Paragraph({ indent: { left: 360 }, border: { left: { style: BorderStyle.SINGLE, size: 12, color: ACCENT, space: 8 } }, children: inline(q[1], { italics: true, color: "3D4A3B" }) }));
    i++;
    continue;
  }
  if (line.trim()) children.push(new Paragraph({ spacing: { after: 120 }, children: inline(line) }));
  i++;
}

const heading = (size, before, after, color = "243126") => ({
  run: { font: FONT, size, bold: true, color },
  paragraph: { spacing: { before, after }, keepNext: true, keepLines: true },
});
const doc = new Document({
  creator: "360 Fitness",
  title: subtitle || "360 Fitness",
  styles: {
    default: { document: { run: { font: FONT, size: 21 } } },
    paragraphStyles: [
      { id: "Title", name: "Title", basedOn: "Normal", run: { font: FONT, size: 44, bold: true, color: "243126" }, paragraph: { spacing: { before: 0, after: 80 } } },
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, ...heading(30, 320, 120, ACCENT), paragraph: { ...heading(30, 320, 120).paragraph, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, ...heading(25, 240, 100), paragraph: { ...heading(25, 240, 100).paragraph, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true, ...heading(22, 200, 80), paragraph: { ...heading(22, 200, 80).paragraph, outlineLevel: 2 } },
    ],
  },
  numbering: {
    config: [
      { reference: "bullets", levels: [0, 1].map((level) => ({ level, format: LevelFormat.BULLET, text: level ? "◦" : "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360 + level * 360, hanging: 260 } } } })) },
      { reference: "numbers", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 300 } } } }] },
    ],
  },
  sections: [
    {
      properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } } },
      footers: {
        default: new Footer({
          children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `${subtitle ?? "360 Fitness"} · page `, size: 16, color: "63705F", font: FONT }), new TextRun({ children: [PageNumber.CURRENT], size: 16, color: "63705F", font: FONT })] })],
        }),
      },
      children,
    },
  ],
});
Packer.toBuffer(doc).then((buf) => fs.writeFileSync(output, buf));
