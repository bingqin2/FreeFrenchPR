// Renders the tiny markdown subset used in content: paragraphs, "- " bullets,
// **bold**, *italic*, `code`. Builds React nodes (no innerHTML).
import { Fragment, type ReactNode } from 'react';

/** Index of the `*` closing an italic span that starts at `from`, skipping nested **bold**. */
function italicEnd(t: string, from: number): number {
  for (let j = from; j < t.length; j++) {
    if (t.startsWith('**', j)) {
      const e = t.indexOf('**', j + 2);
      if (e < 0) return -1;
      // "***" right after a bold span: the bold closes first, then the italic.
      j = e + 1;
      continue;
    }
    if (t[j] === '*') return j;
  }
  return -1;
}

function inline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  let buf = '';
  let n = 0;
  const flush = () => {
    if (buf) out.push(buf);
    buf = '';
  };
  for (let i = 0; i < text.length; ) {
    const k = `${keyBase}-${n++}`;
    if (text[i] === '`') {
      const end = text.indexOf('`', i + 1);
      if (end > i + 1) {
        flush();
        out.push(<code key={k}>{text.slice(i + 1, end)}</code>);
        i = end + 1;
        continue;
      }
    } else if (text.startsWith('***', i)) {
      const end = text.indexOf('***', i + 3);
      if (end > i + 3) {
        flush();
        out.push(
          <strong key={k}>
            <em>{inline(text.slice(i + 3, end), k)}</em>
          </strong>,
        );
        i = end + 3;
        continue;
      }
    } else if (text.startsWith('**', i)) {
      const end = text.indexOf('**', i + 2);
      if (end > i + 2) {
        flush();
        out.push(<strong key={k}>{inline(text.slice(i + 2, end), k)}</strong>);
        i = end + 2;
        continue;
      }
    } else if (text[i] === '*' && text[i + 1] && text[i + 1] !== ' ') {
      const end = italicEnd(text, i + 1);
      if (end > i + 1) {
        flush();
        out.push(<em key={k}>{inline(text.slice(i + 1, end), k)}</em>);
        i = end + 1;
        continue;
      }
    }
    buf += text[i++];
  }
  flush();
  return out;
}

export function Inline({ text }: { text: string }) {
  return <>{inline(text, 'i')}</>;
}

export default function Md({ text, className }: { text: string; className?: string }) {
  const blocks = text.replace(/\r/g, '').split(/\n{2,}/);
  return (
    <div className={`md ${className ?? ''}`}>
      {blocks.map((block, b) => {
        const lines = block.split('\n');
        const isList = lines.every((l) => /^\s*[-•]\s+/.test(l) || !l.trim());
        if (isList)
          return (
            <ul key={b}>
              {lines.filter((l) => l.trim()).map((l, i) => (
                <li key={i}>{inline(l.replace(/^\s*[-•]\s+/, ''), `${b}-${i}`)}</li>
              ))}
            </ul>
          );
        // Mixed block: render bullets as a list and other lines as paragraphs.
        const nodes: ReactNode[] = [];
        let list: string[] = [];
        const flush = (k: string) => {
          if (list.length) nodes.push(<ul key={k}>{list.map((l, i) => <li key={i}>{inline(l, `${k}-${i}`)}</li>)}</ul>);
          list = [];
        };
        let para: string[] = [];
        const flushPara = (k: string) => {
          if (para.length)
            nodes.push(
              <p key={k}>
                {para.map((l, i) => (
                  <Fragment key={i}>
                    {i > 0 && <br />}
                    {inline(l, `${k}-${i}`)}
                  </Fragment>
                ))}
              </p>,
            );
          para = [];
        };
        lines.forEach((l, i) => {
          if (/^\s*[-•]\s+/.test(l)) {
            flushPara(`${b}-p${i}`);
            list.push(l.replace(/^\s*[-•]\s+/, ''));
          } else {
            flush(`${b}-l${i}`);
            para.push(l);
          }
        });
        flush(`${b}-lend`);
        flushPara(`${b}-pend`);
        return <Fragment key={b}>{nodes}</Fragment>;
      })}
    </div>
  );
}
