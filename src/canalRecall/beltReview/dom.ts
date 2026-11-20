/** Tiny DOM helpers for the belt review page (no framework; text is always set as text, never as HTML). */
type Attrs = Record<string, string | number | boolean | null | undefined | ((e: Event) => void)>;
export type Child = Node | string | number | null | undefined | false;

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (typeof v === 'function') el.addEventListener(k.replace(/^on/, ''), v as EventListener);
    else if (k === 'class') el.className = String(v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, String(v));
  }
  append(el, children);
  return el;
}
export function append(el: Element, children: Child[]): void {
  for (const c of children) if (c !== null && c !== undefined && c !== false) el.append(c instanceof Node ? c : String(c));
}
export const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel);
export function replace(el: Element, ...children: Child[]): void { el.replaceChildren(); append(el, children); }

/** True when the keyboard event targets a text field (shortcuts stay out of the way while typing). */
export const typing = (e: KeyboardEvent) => {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === 'TEXTAREA' || (t.tagName === 'INPUT' && !['checkbox', 'radio', 'button'].includes((t as HTMLInputElement).type)) || t.tagName === 'SELECT' || t.isContentEditable);
};
