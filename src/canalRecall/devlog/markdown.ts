// A small, safe Markdown renderer for the Dev log page (GitHub #84). It covers
// what the progress comments on issue #68 use: headings, paragraphs, nested
// bullet and numbered lists, block quotes, rules, bold, italics, inline code,
// links and bare URLs, and `#123` issue references. Every piece of text is
// HTML-escaped before any tag is added, and only http(s) and relative links
// survive, so a comment cannot inject markup or script.

export const esc = (s: string): string =>
  s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

/** Only web links (and in-page or relative ones); anything else (javascript:, data:, …) is dropped. */
export function safeHref(raw: string): string | undefined {
  const url = raw.trim();
  if (/^https?:\/\//i.test(url)) return url;
  if (/^[#./]/.test(url) && !/^\/\//.test(url)) return url;
  return undefined;
}

export interface InlineOptions { issueUrl?: (n: number) => string }

/** Inline Markdown on one block of text: code spans first, so their contents stay literal. */
export function renderInline(text: string, opts: InlineOptions = {}): string {
  const out: string[] = [];
  const parts = text.split(/(`[^`]+`)/);
  for (const part of parts) {
    if (part.length > 1 && part.startsWith('`') && part.endsWith('`')) { out.push(`<code>${esc(part.slice(1, -1))}</code>`); continue; }
    out.push(renderSpans(part, opts));
  }
  return out.join('');
}

function renderSpans(text: string, opts: InlineOptions): string {
  // Links become placeholders before escaping, so each URL is checked as written and emphasis can wrap a link.
  const links: string[] = [];
  const linkRe = /\[([^\]]+)\]\(([^)\s]+)\)|(https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"])/g;
  const marked = text.replace(/\u0000/g, '').replace(linkRe, (_m, label: string | undefined, url: string | undefined, bare: string | undefined) => {
    const href = safeHref(url ?? bare ?? '');
    const inner = label !== undefined ? emphasis(esc(label), {}) : esc(bare!);
    links.push(href ? `<a href="${esc(href)}" rel="noopener">${inner}</a>` : inner);
    return `\u0000${links.length - 1}\u0000`;
  });
  return emphasis(esc(marked), opts).replace(/\u0000(\d+)\u0000/g, (_m, i: string) => links[Number(i)]);
}

/** Bold, italics and issue references on already-escaped text. */
function emphasis(s: string, opts: InlineOptions): string {
  let r = s
    .replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, '<strong>$1</strong>')
    .replace(/__(?=\S)([\s\S]*?\S)__/g, '<strong>$1</strong>')
    .replace(/(^|[^*\w])\*(?=\S)([^*]*?\S)\*(?!\*)/g, '$1<em>$2</em>')
    .replace(/(^|[^_\w])_(?=\S)([^_]*?\S)_(?![_\w])/g, '$1<em>$2</em>');
  if (opts.issueUrl) r = r.replace(/(^|[\s(])#(\d{1,6})\b/g, (_, pre: string, n: string) => `${pre}<a href="${esc(opts.issueUrl!(Number(n)))}" rel="noopener">#${n}</a>`);
  return r;
}

interface ListItem { html: string[]; children: List[] }
interface List { ordered: boolean; indent: number; items: ListItem[] }

/** Block Markdown to HTML. Headings are shifted down by `headingShift` levels (an entry title is the page's h2). */
export function renderMarkdown(md: string, opts: InlineOptions & { headingShift?: number } = {}): string {
  const lines = md.replace(/\r\n?/g, '\n').split('\n');
  const html: string[] = [];
  const shift = opts.headingShift ?? 0;
  let para: string[] = [];
  let quote: string[] = [];
  let stack: List[] = [];

  const flushPara = () => { if (para.length) { html.push(`<p>${renderInline(para.join(' '), opts)}</p>`); para = []; } };
  const flushQuote = () => { if (quote.length) { html.push(`<blockquote>${renderMarkdown(quote.join('\n'), opts)}</blockquote>`); quote = []; } };
  const listHtml = (l: List): string => {
    const tag = l.ordered ? 'ol' : 'ul';
    return `<${tag}>${l.items.map(i => `<li>${i.html.join('')}${i.children.map(listHtml).join('')}</li>`).join('')}</${tag}>`;
  };
  const flushList = () => { if (stack.length) { html.push(listHtml(stack[0])); stack = []; } };
  const flushAll = () => { flushPara(); flushQuote(); flushList(); };

  for (const raw of lines) {
    const line = raw.replace(/\t/g, '    ');
    if (!line.trim()) { flushPara(); flushQuote(); continue; }
    const bullet = /^(\s*)([-*+]|\d{1,3}[.)])\s+(.*)$/.exec(line);
    if (bullet && !/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      flushPara(); flushQuote();
      const indent = bullet[1].length, ordered = /\d/.test(bullet[2]);
      while (stack.length && indent < stack[stack.length - 1].indent) stack.pop();
      let top = stack[stack.length - 1];
      // A list of the other kind at the same depth is a new list beside it.
      if (top && indent === top.indent && top.ordered !== ordered) {
        if (stack.length === 1) flushList(); else stack.pop();
        top = stack[stack.length - 1];
        const list: List = { ordered, indent, items: [] };
        if (top) top.items[top.items.length - 1].children.push(list); else stack = [];
        stack.push(list); top = list;
      }
      if (!top || indent > top.indent) {
        const list: List = { ordered, indent, items: [] };
        const parentItem = top?.items[top.items.length - 1];
        if (parentItem) parentItem.children.push(list); else { flushList(); stack = []; }
        stack.push(list); top = list;
      }
      top.items.push({ html: [renderInline(bullet[3], opts)], children: [] });
      continue;
    }
    // An indented line under a list item continues that item.
    if (stack.length && /^\s+\S/.test(line)) {
      const top = stack[stack.length - 1];
      top.items[top.items.length - 1].html.push(`<span class="cont">${renderInline(line.trim(), opts)}</span>`);
      continue;
    }
    const heading = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
    if (heading) {
      flushAll();
      const level = Math.min(6, heading[1].length + shift);
      html.push(`<h${level}>${renderInline(heading[2], opts)}</h${level}>`);
      continue;
    }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { flushAll(); html.push('<hr>'); continue; }
    const q = /^\s*>\s?(.*)$/.exec(line);
    if (q) { flushPara(); flushList(); quote.push(q[1]); continue; }
    flushQuote(); flushList();
    para.push(line.trim());
  }
  flushAll();
  return html.join('\n');
}
