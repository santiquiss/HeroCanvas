// What the stylesheets declare for an element, not what it computes to: the value a rule (or its inline style) writes,
// `var(--sf)` rather than rgb(255, 255, 255). Inspect reads it to name the token or the text style the code uses.

/** Every style rule in the document's stylesheets, nested ones (@media, @supports, @layer) included. */
function* rules(list: CSSRuleList): Generator<CSSStyleRule> {
  for (const r of list) {
    if (r instanceof CSSStyleRule) yield r;
    if ('cssRules' in r && (r as CSSGroupingRule).cssRules) yield* rules((r as CSSGroupingRule).cssRules);
  }
}

/**
 * The value the element's own rules (or its inline style) give `prop` or its `shorthand`, the last one winning (CSS
 * modules: one class a rule, so document order stands in for specificity).
 */
export function declaredValue(el: Element, prop: string, shorthand: string | null = null): string | null {
  const read = (style: CSSStyleDeclaration) => style.getPropertyValue(prop) || (shorthand ? style.getPropertyValue(shorthand) : '');
  if (el instanceof HTMLElement || el instanceof SVGElement) {
    const inline = read(el.style);
    if (inline) return inline;
  }
  let found: string | null = null;
  for (const sheet of document.styleSheets) {
    let list: CSSRuleList;
    try {
      list = sheet.cssRules;
    } catch {
      continue; // another origin's stylesheet (a font's): not readable, and not the app's
    }
    for (const rule of rules(list)) {
      const v = read(rule.style);
      if (!v) continue;
      try {
        if (el.matches(rule.selectorText)) found = v;
      } catch {
        /* a selector this browser can't match */
      }
    }
  }
  return found;
}
