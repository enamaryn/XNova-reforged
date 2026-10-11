import type { ReactNode } from "react";
import Link from "next/link";

/**
 * Rendu du sous-ensemble de Markdown utilisé par la FAQ (titres, paragraphes, listes, tableaux, citations,
 * code et liens). Aucun HTML brut : tout est rendu en éléments React, donc sans injection possible.
 */

const GITHUB_BLOB = "https://github.com/enamaryn/XNova-reforged/blob/main";
const FAQ_FILE_LOCALES: Record<string, string> = {
  "FAQ.md": "fr",
  "FAQ_EN.md": "en",
  "FAQ_ES.md": "es",
  "FAQ_DE.md": "de",
  "FAQ_IT.md": "it",
};

/** Identifiant de titre compatible avec les ancres du sommaire (même règle que GitHub). */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .replace(/\s/g, "-");
}

/** Adresse d'un lien du document : autres langues de la FAQ → pages du site ; autres fichiers → GitHub. */
export function resolveHref(href: string, section: string): { href: string; external: boolean } {
  if (href.startsWith("#")) return { href, external: false };
  if (/^https?:\/\//.test(href)) return { href, external: true };
  const file = href.split("#")[0];
  const faqLocale = FAQ_FILE_LOCALES[file];
  if (faqLocale) return { href: `/${faqLocale}/${section}`, external: false };
  if (file.startsWith("../")) return { href: `${GITHUB_BLOB}/${file.slice(3)}`, external: true };
  return { href: `${GITHUB_BLOB}/docs/${file}`, external: true };
}

type Align = "left" | "right" | "center";

type Block =
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "quote"; paragraphs: string[] }
  | { type: "table"; header: string[]; aligns: Align[]; rows: string[][] }
  | { type: "rule" };

const splitRow = (line: string) =>
  line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());

const isSeparator = (line: string) => /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(line);

export function parseBlocks(markdown: string): Block[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i += 1;
      continue;
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      blocks.push({ type: "heading", level: heading[1].length, text: heading[2].trim() });
      i += 1;
      continue;
    }
    if (/^\s*---+\s*$/.test(line)) {
      blocks.push({ type: "rule" });
      i += 1;
      continue;
    }
    if (line.startsWith(">")) {
      const paragraphs: string[] = [];
      let current: string[] = [];
      while (i < lines.length && lines[i].startsWith(">")) {
        const content = lines[i].replace(/^>\s?/, "");
        if (!content.trim()) {
          if (current.length) paragraphs.push(current.join(" "));
          current = [];
        } else {
          current.push(content.trim());
        }
        i += 1;
      }
      if (current.length) paragraphs.push(current.join(" "));
      blocks.push({ type: "quote", paragraphs });
      continue;
    }
    if (line.includes("|") && i + 1 < lines.length && isSeparator(lines[i + 1])) {
      const header = splitRow(line);
      const aligns = splitRow(lines[i + 1]).map((cell): Align => {
        if (cell.startsWith(":") && cell.endsWith(":")) return "center";
        return cell.endsWith(":") ? "right" : "left";
      });
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i].includes("|") && lines[i].trim()) {
        rows.push(splitRow(lines[i]));
        i += 1;
      }
      blocks.push({ type: "table", header, aligns, rows });
      continue;
    }
    const listMatch = /^(\s*)([-*]|\d+\.)\s+/.exec(line);
    if (listMatch) {
      const ordered = /\d/.test(listMatch[2]);
      const items: string[] = [];
      while (i < lines.length && /^(\s*)([-*]|\d+\.)\s+/.test(lines[i])) {
        let item = lines[i].replace(/^(\s*)([-*]|\d+\.)\s+/, "");
        i += 1;
        // Ligne de continuation d'un élément (indentée, non vide, qui n'ouvre pas un autre bloc)
        while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !/^(\s*)([-*]|\d+\.)\s+/.test(lines[i])) {
          item += ` ${lines[i].trim()}`;
          i += 1;
        }
        items.push(item);
      }
      blocks.push({ type: "list", ordered, items });
      continue;
    }
    const paragraph: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,6})\s+/.test(lines[i]) &&
      !lines[i].startsWith(">") &&
      !/^\s*---+\s*$/.test(lines[i]) &&
      !/^(\s*)([-*]|\d+\.)\s+/.test(lines[i])
    ) {
      paragraph.push(lines[i].trim());
      i += 1;
    }
    blocks.push({ type: "paragraph", text: paragraph.join(" ") });
  }
  return blocks;
}

const INLINE = /(`[^`]+`)|(\*\*[^*]+(?:\*(?!\*)[^*]*)*\*\*)|(\*[^*\s][^*]*\*)|(\[[^\]]+\]\([^)]+\))/;

function renderInline(text: string, section: string, keyPrefix = "i"): ReactNode[] {
  const nodes: ReactNode[] = [];
  let rest = text;
  let n = 0;
  while (rest) {
    const match = INLINE.exec(rest);
    if (!match) {
      nodes.push(rest);
      break;
    }
    if (match.index > 0) nodes.push(rest.slice(0, match.index));
    const token = match[0];
    const key = `${keyPrefix}-${n++}`;
    if (match[1]) {
      nodes.push(
        <code key={key} className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[0.85em] text-sky-200">
          {token.slice(1, -1)}
        </code>,
      );
    } else if (match[2]) {
      nodes.push(
        <strong key={key} className="font-semibold text-white">
          {renderInline(token.slice(2, -2), section, key)}
        </strong>,
      );
    } else if (match[3]) {
      nodes.push(<em key={key}>{renderInline(token.slice(1, -1), section, key)}</em>);
    } else {
      const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token)!;
      const target = resolveHref(link[2], section);
      const className = "text-sky-300 underline decoration-sky-300/40 underline-offset-2 hover:text-sky-200";
      nodes.push(
        target.external ? (
          <a key={key} href={target.href} className={className} target="_blank" rel="noopener noreferrer">
            {renderInline(link[1], section, key)}
          </a>
        ) : target.href.startsWith("#") ? (
          <a key={key} href={target.href} className={className}>
            {renderInline(link[1], section, key)}
          </a>
        ) : (
          <Link key={key} href={target.href} className={className}>
            {renderInline(link[1], section, key)}
          </Link>
        ),
      );
    }
    rest = rest.slice(match.index + token.length);
  }
  return nodes;
}

const ALIGN_CLASS: Record<Align, string> = { left: "text-left", right: "text-right", center: "text-center" };

/** Rend un document Markdown ; `section` est le segment d'URL de la FAQ (`faq` public, `help` dans le jeu). */
export function renderMarkdown(markdown: string, section: string): ReactNode {
  return parseBlocks(markdown).map((block, index) => {
    const key = `b-${index}`;
    switch (block.type) {
      case "heading": {
        const id = slugify(block.text);
        const inline = renderInline(block.text, section, key);
        if (block.level === 1) {
          return (
            <h1 key={key} id={id} className="mb-4 text-3xl font-bold tracking-tight text-white sm:text-4xl">
              {inline}
            </h1>
          );
        }
        if (block.level === 2) {
          return (
            <h2 key={key} id={id} className="mb-3 mt-10 scroll-mt-24 border-b border-slate-800 pb-2 text-2xl font-semibold text-sky-300">
              {inline}
            </h2>
          );
        }
        return (
          <h3 key={key} id={id} className="mb-2 mt-6 scroll-mt-24 text-lg font-semibold text-white">
            {inline}
          </h3>
        );
      }
      case "paragraph":
        return (
          <p key={key} className="my-3 leading-7 text-slate-300">
            {renderInline(block.text, section, key)}
          </p>
        );
      case "list": {
        const Tag = block.ordered ? "ol" : "ul";
        return (
          <Tag key={key} className={`my-3 space-y-1.5 pl-6 text-slate-300 ${block.ordered ? "list-decimal" : "list-disc"}`}>
            {block.items.map((item, itemIndex) => (
              <li key={`${key}-${itemIndex}`} className="leading-7">
                {renderInline(item, section, `${key}-${itemIndex}`)}
              </li>
            ))}
          </Tag>
        );
      }
      case "quote":
        return (
          <blockquote key={key} className="my-4 space-y-2 rounded-r-lg border-l-4 border-sky-500/60 bg-slate-900/60 px-4 py-3 text-sm text-slate-300">
            {block.paragraphs.map((p, pIndex) => (
              <p key={`${key}-${pIndex}`} className="leading-6">
                {renderInline(p, section, `${key}-${pIndex}`)}
              </p>
            ))}
          </blockquote>
        );
      case "table":
        return (
          <div key={key} className="my-4 overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full min-w-[32rem] border-collapse text-sm">
              <thead className="bg-slate-900 text-slate-200">
                <tr>
                  {block.header.map((cell, cellIndex) => (
                    <th key={`${key}-h-${cellIndex}`} scope="col" className={`px-3 py-2 font-semibold ${ALIGN_CLASS[block.aligns[cellIndex] ?? "left"]}`}>
                      {renderInline(cell, section, `${key}-h-${cellIndex}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {block.rows.map((row, rowIndex) => (
                  <tr key={`${key}-r-${rowIndex}`} className="odd:bg-slate-900/40">
                    {row.map((cell, cellIndex) => (
                      <td key={`${key}-r-${rowIndex}-${cellIndex}`} className={`px-3 py-2 align-top ${ALIGN_CLASS[block.aligns[cellIndex] ?? "left"]}`}>
                        {renderInline(cell, section, `${key}-r-${rowIndex}-${cellIndex}`)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      case "rule":
        return <hr key={key} className="my-8 border-slate-800" />;
    }
  });
}
