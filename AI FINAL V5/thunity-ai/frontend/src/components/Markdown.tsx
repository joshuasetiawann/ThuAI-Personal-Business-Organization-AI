import type { ReactNode } from "react";

// Lightweight, dependency-free Markdown → React renderer for assistant answers.
// Handles headings, bold/italic, inline + fenced code, links, blockquotes, and
// ordered/unordered lists. Builds React nodes (no dangerouslySetInnerHTML), so
// model output is escaped safely.

const INLINE: [RegExp, (m: RegExpMatchArray, k: string) => ReactNode][] = [
  [/^`([^`]+)`/, (m, k) => <code key={k} className="md-code">{m[1]}</code>],
  [/^\*\*([^*]+)\*\*/, (m, k) => <strong key={k}>{parseInline(m[1], k)}</strong>],
  [/^__([^_]+)__/, (m, k) => <strong key={k}>{parseInline(m[1], k)}</strong>],
  [/^\*([^*\n]+)\*/, (m, k) => <em key={k}>{parseInline(m[1], k)}</em>],
  [/^\[([^\]]+)\]\(([^)\s]+)\)/, (m, k) => (
    <a key={k} href={m[2]} target="_blank" rel="noreferrer noopener">{m[1]}</a>
  )],
];

function parseInline(text: string, prefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let rest = text;
  let buf = "";
  let n = 0;
  while (rest.length) {
    let matched = false;
    for (const [re, render] of INLINE) {
      const m = rest.match(re);
      if (m) {
        if (buf) { nodes.push(buf); buf = ""; }
        nodes.push(render(m, `${prefix}-${n++}`));
        rest = rest.slice(m[0].length);
        matched = true;
        break;
      }
    }
    if (!matched) { buf += rest[0]; rest = rest.slice(1); }
  }
  if (buf) nodes.push(buf);
  return nodes;
}

const BLOCK_START = /^(#{1,3}\s|```|>\s?|\s*[-*+]\s+|\s*\d+\.\s+)/;
const HR = /^(\*\*\*|---|___)\s*$/;

export default function Markdown({ text }: { text: string }) {
  const lines = (text || "").replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let bk = 0;
  const k = () => bk++;                                              // one unique id per block
  while (i < lines.length) {
    const line = lines[i];

    if (/^```/.test(line.trim())) {                                  // fenced code
      i++;
      const code: string[] = [];
      while (i < lines.length && !/^```/.test(lines[i].trim())) { code.push(lines[i]); i++; }
      i++;
      blocks.push(<pre key={k()} className="md-pre"><code>{code.join("\n")}</code></pre>);
      continue;
    }

    const h = line.match(/^(#{1,3})\s+(.*)$/);                       // headings
    if (h) {
      const id = k();
      const Tag = (`h${h[1].length + 2}`) as keyof JSX.IntrinsicElements;
      blocks.push(<Tag key={id} className="md-h">{parseInline(h[2], `h${id}`)}</Tag>);
      i++; continue;
    }

    if (HR.test(line.trim())) { blocks.push(<hr key={k()} className="md-hr" />); i++; continue; }

    if (/^>\s?/.test(line)) {                                        // blockquote
      const id = k();
      const q: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) { q.push(lines[i].replace(/^>\s?/, "")); i++; }
      blocks.push(<blockquote key={id} className="md-quote">{parseInline(q.join(" "), `q${id}`)}</blockquote>);
      continue;
    }

    if (/^\s*[-*+]\s+/.test(line)) {                                 // unordered list
      const id = k();
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*[-*+]\s+/, "")); i++; }
      blocks.push(<ul key={id} className="md-ul">{items.map((it, ix) => <li key={ix}>{parseInline(it, `ul${id}-${ix}`)}</li>)}</ul>);
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {                                 // ordered list
      const id = k();
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*\d+\.\s+/, "")); i++; }
      blocks.push(<ol key={id} className="md-ol">{items.map((it, ix) => <li key={ix}>{parseInline(it, `ol${id}-${ix}`)}</li>)}</ol>);
      continue;
    }

    if (line.trim() === "") { i++; continue; }                       // blank

    const id = k();                                                 // paragraph
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() !== "" && !BLOCK_START.test(lines[i]) && !HR.test(lines[i].trim())) {
      para.push(lines[i]); i++;
    }
    blocks.push(<p key={id} className="md-p">{parseInline(para.join("\n"), `p${id}`)}</p>);
  }
  return <div className="md">{blocks}</div>;
}
