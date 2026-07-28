import type { Component, Editor } from 'grapesjs';

import { toCssUrl } from '@/lib/nsite/siteHtml';
import { cssFamilyName, primaryFamily } from './install';

/**
 * `@font-face` rules in the page's own stylesheet.
 *
 * They live in the page rather than in a shared `fonts.css`, because each page
 * of an nsite ships as its own standalone file — and GrapesJS carries them
 * through the round trip without help: its CSS parser turns an `@font-face`
 * block into a rule with `singleAtRule` set, and `getCss` writes it back out.
 * So a face added here is serialized into the page's `<style>` on save and
 * parsed back out of it on load, with the `url()` pointing at a site path in
 * the file and at an object URL in the canvas.
 *
 * They are written straight onto the rule collection rather than through
 * `Css.setRule`, which forwards the at-rule type under a key (`atRule`) that
 * the rule constructor doesn't read — it only ever infers `media` from a width.
 */

const FONT_FACE = 'font-face';

export interface FontFaceSpec {
  family: string;
  weight: number;
  /** Somewhere the canvas can load the file: the object URL of a site file. */
  src: string;
}

interface FontFaceRule {
  family: string;
  weight: string;
}

function describe(style: Record<string, unknown>): FontFaceRule {
  const family = typeof style['font-family'] === 'string' ? style['font-family'] : '';
  const weight = style['font-weight'];

  return {
    family: primaryFamily(family),
    weight: typeof weight === 'string' || typeof weight === 'number' ? String(weight) : '',
  };
}

/**
 * Families the page actually asks for, from every `font-family` declaration
 * that isn't part of an `@font-face` block.
 *
 * Both the stylesheet and the components are read. Most component styles are in
 * the stylesheet already, since GrapesJS keeps them as rules keyed to a
 * generated id — but an imported site can carry `style="font-family:…"` on the
 * element itself, and pruning a face because the only thing asking for it was
 * an attribute would quietly break a site the editor was only ever opened on.
 *
 * Only the first name in each declaration counts: the rest are generic
 * fallbacks, which no `@font-face` ever answers for.
 */
function usedFamilies(editor: Editor): Set<string> {
  const families = new Set<string>();

  const record = (declared: unknown) => {
    if (typeof declared !== 'string') return;
    const family = primaryFamily(declared);
    if (family) families.add(family);
  };

  for (const rule of editor.Css.getRules()) {
    if (rule.get('atRuleType') === FONT_FACE) continue;
    record(rule.getStyle()['font-family']);
  }

  const walk = (component: Component) => {
    record(component.getStyle()['font-family']);
    component.components().forEach(walk);
  };

  const wrapper = editor.getWrapper();
  if (wrapper) walk(wrapper);

  return families;
}

/**
 * Drops faces for families nothing on the page uses any more.
 *
 * Trying fonts on is the whole point of a picker, and without this every family
 * tried would stay declared — and its files would stay in the site — for as
 * long as the site existed. Run after a font changes, so the page declares
 * exactly what it sets.
 */
export function pruneFontFaces(editor: Editor): void {
  const used = usedFamilies(editor);

  const stale = editor.Css.getRules().filter((rule) => {
    if (rule.get('atRuleType') !== FONT_FACE) return false;
    const { family } = describe(rule.getStyle());
    return !!family && !used.has(family);
  });

  for (const rule of stale) editor.Css.remove(rule);
}

function hasFace(editor: Editor, family: string, weight: number): boolean {
  return editor.Css.getRules().some((rule) => {
    if (rule.get('atRuleType') !== FONT_FACE) return false;
    const found = describe(rule.getStyle());
    return found.family === family && found.weight === String(weight);
  });
}

/**
 * Declares one weight of a family, unless the page already declares it.
 *
 * The guard matters: the rule collection deliberately skips its usual
 * deduplication for `singleAtRule` rules, since two `@font-face` blocks with no
 * selectors are not necessarily the same rule — so re-picking a font would
 * otherwise stack up a duplicate block on every click.
 */
export function addFontFace(editor: Editor, spec: FontFaceSpec): void {
  if (hasFace(editor, spec.family, spec.weight)) return;

  editor.Css.getAll().add({
    selectors: [],
    atRuleType: FONT_FACE,
    singleAtRule: true,
    style: {
      'font-family': cssFamilyName(spec.family),
      'font-style': 'normal',
      'font-weight': String(spec.weight),
      // Text stays readable while the file arrives, rather than the page
      // holding a blank space for it.
      'font-display': 'swap',
      src: `${toCssUrl(spec.src)} format("woff2")`,
    },
  });
}
