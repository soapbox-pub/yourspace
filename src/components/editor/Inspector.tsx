import type { Component, Editor, Trait } from 'grapesjs';
import { Copy, MousePointerSquareDashed, Trash2 } from 'lucide-react';

import { isImageFile, type NsiteFile } from '@/lib/nsite/files';
import { parseCssUrl, toCssUrl } from '@/lib/nsite/siteHtml';
import { cn } from '@/lib/utils';
import {
  BoxControl,
  ColorControl,
  Field,
  ImageControl,
  PanelSection,
  SelectControl,
  SegmentedControl,
  TextControl,
  type Option,
} from './fields';
import { componentName, useEditorEvent, useSelectedComponent } from './editorHooks';

interface InspectorProps {
  editor: Editor | null;
  /** Every file in the site, for the background image picker. */
  files?: NsiteFile[];
}

/* --------------------------------------------------------------------------
 * Style plumbing
 *
 * Values are read from and written to the component itself rather than through
 * the StyleManager, which is switched off on this page. `getStyle`/`addStyle`
 * already resolve against the active device, so a change made while the mobile
 * breakpoint is selected lands in that media query — the same behaviour the
 * stock Style Manager has.
 * ------------------------------------------------------------------------ */

/**
 * Anything with a style bag: a component, or a bare CSS rule. The page's own
 * background is the second kind — see `pageTarget`.
 */
interface StyleTarget {
  getStyle(): Record<string, unknown>;
  addStyle(patch: Record<string, string>): unknown;
}

function styleValue(target: StyleTarget, prop: string): string {
  const value = target.getStyle()[prop];
  return typeof value === 'string' ? value : '';
}

/**
 * Writing `''` is how a property is cleared: GrapesJS keeps the key but skips
 * falsy values when serializing, so nothing reaches the exported CSS.
 */
function setStyle(target: StyleTarget, patch: Record<string, string>) {
  target.addStyle(patch);
}

const PAGE_SELECTOR = 'body';

/**
 * The page's own styles, held as a `body` rule rather than on the wrapper
 * component.
 *
 * GrapesJS is willing to style the wrapper — its `stylable` list is exactly the
 * background properties — but component styles are keyed to a generated id, and
 * the wrapper's is minted fresh for each editor session. A `#i3f{…}` rule
 * written today would match nothing when the site is opened again tomorrow,
 * because the `<body id>` it refers to is dropped when a stored page is unwrapped
 * for the canvas. `body{…}` has neither problem: it is the element the canvas
 * frame already is, and it means the same thing in the published file.
 */
function pageTarget(editor: Editor): StyleTarget {
  return {
    getStyle: () => editor.Css.getRule(PAGE_SELECTOR)?.getStyle() ?? {},
    addStyle: (patch) =>
      (editor.Css.getRule(PAGE_SELECTOR) ?? editor.Css.setRule(PAGE_SELECTOR, {})).addStyle(patch),
  };
}

const boxSideProps = (prop: string) => [
  `${prop}-top`,
  `${prop}-right`,
  `${prop}-bottom`,
  `${prop}-left`,
];

type Box = [string, string, string, string];

/**
 * Expands `padding: 12px 24px` into four sides.
 *
 * Returns null for anything containing a function call — `calc(...)` and
 * `var(...)` can hold spaces, and splitting those on whitespace would produce
 * nonsense rather than an honest "I don't know".
 */
function parseBoxShorthand(value: string): Box | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed.includes('(')) return null;

  const parts = trimmed.split(/\s+/);
  switch (parts.length) {
    case 1:
      return [parts[0], parts[0], parts[0], parts[0]];
    case 2:
      return [parts[0], parts[1], parts[0], parts[1]];
    case 3:
      return [parts[0], parts[1], parts[2], parts[1]];
    case 4:
      return [parts[0], parts[1], parts[2], parts[3]];
    default:
      return null;
  }
}

/** Longhand wins where present, otherwise fall back to the shorthand. */
function boxValues(target: StyleTarget, prop: string): Box {
  const shorthand = parseBoxShorthand(styleValue(target, prop)) ?? ['', '', '', ''];
  return boxSideProps(prop).map(
    (side, index) => styleValue(target, side) || shorthand[index],
  ) as Box;
}

/**
 * Edits collapse the shorthand into longhands, so that changing one side can
 * never be silently undone by a `padding` declaration later in the rule.
 */
function setBoxSide(target: StyleTarget, prop: string, side: number, value: string) {
  const next = boxValues(target, prop);
  next[side] = value;

  const patch: Record<string, string> = { [prop]: '' };
  boxSideProps(prop).forEach((name, index) => {
    patch[name] = next[index];
  });

  setStyle(target, patch);
}

/* --------------------------------------------------------------------------
 * Background
 * ------------------------------------------------------------------------ */

/** Values that stand in for an image: a file, a gradient, or nothing. */
const IMAGE_VALUE = /^(url|[a-z-]*gradient|image-set|cross-fade|element)\(|^none$/i;

/**
 * Splits a `background` shorthand into the two parts this panel edits.
 *
 * Returns null for anything richer, in the same spirit as `parseBoxShorthand`:
 * a shorthand carrying a position, a size or a repeat alongside its colour
 * cannot become two longhands without dropping the rest.
 */
function parseBackgroundShorthand(value: string): { color: string; image: string } | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  // One bare token (`#fff`, `red`, `transparent`), or one function call
  // (`rgb(…)`, `linear-gradient(…)`) with nothing after it.
  const single = /^[^\s(]+$/.test(trimmed) || /^[a-z-]+\(.*\)$/is.test(trimmed);
  if (!single) return null;

  return IMAGE_VALUE.test(trimmed) ? { color: '', image: trimmed } : { color: trimmed, image: '' };
}

/** Longhand wins where present, otherwise fall back to the shorthand. */
function backgroundValues(target: StyleTarget): { color: string; image: string } {
  const shorthand = parseBackgroundShorthand(styleValue(target, 'background'));
  return {
    color: styleValue(target, 'background-color') || shorthand?.color || '',
    image: styleValue(target, 'background-image') || shorthand?.image || '',
  };
}

/**
 * Edits collapse the shorthand into longhands, for the reason `setBoxSide`
 * does: a `background` declaration left in the rule would reset whichever of
 * the colour and the image was not just written. A shorthand too rich to split
 * is lost at that point, which is why nothing here writes one back.
 */
function setBackground(target: StyleTarget, patch: Record<string, string>) {
  const { color, image } = backgroundValues(target);
  setStyle(target, {
    background: '',
    'background-color': color,
    'background-image': image,
    ...patch,
  });
}

/** How an image covers its element. */
type BackgroundFit = 'cover' | 'contain' | 'tile';

/** CSS repeats a background at its natural size by default, which is a tile. */
function backgroundFit(target: StyleTarget): BackgroundFit {
  const size = styleValue(target, 'background-size').trim().toLowerCase();
  return size === 'cover' || size === 'contain' ? size : 'tile';
}

const fitPatches: Record<BackgroundFit, Record<string, string>> = {
  cover: {
    'background-size': 'cover',
    'background-repeat': 'no-repeat',
    'background-position': 'center',
  },
  contain: {
    'background-size': 'contain',
    'background-repeat': 'no-repeat',
    'background-position': 'center',
  },
  // Cleared rather than set to `auto` / `0 0`: those are the CSS defaults, and
  // a declaration that changes nothing is noise in the exported stylesheet.
  tile: { 'background-size': '', 'background-repeat': 'repeat', 'background-position': '' },
};

/**
 * What the user typed, as a `background-image` value.
 *
 * A gradient is as much a background image as a file is, and the free-text
 * fields elsewhere in this panel already take CSS, so anything that reads as an
 * image value is kept as written. The rest is treated as a URL, and has to
 * survive the scheme allowlist to be used.
 */
function toBackgroundImage(input: string): string {
  const value = input.trim();
  if (!value) return '';
  return IMAGE_VALUE.test(value) ? value : toCssUrl(value);
}

interface BackgroundFieldsProps {
  target: StyleTarget;
  fieldKey: string;
  images: { url: string; label: string }[];
}

/** Colour, image, and how the image is laid out. Shared by pages and elements. */
function BackgroundFields({ target, fieldKey, images }: BackgroundFieldsProps) {
  const { color, image } = backgroundValues(target);
  const url = parseCssUrl(image);
  const fit = backgroundFit(target);

  return (
    <>
      <ColorControl
        label="Colour"
        value={color}
        fieldKey={`${fieldKey}:background-color`}
        onChange={(value) => setBackground(target, { 'background-color': value })}
      />

      <ImageControl
        label="Image"
        value={url || image}
        preview={url}
        fieldKey={`${fieldKey}:background-image`}
        options={images}
        hint={
          images.length
            ? 'An https:// address, a gradient, or one of the images below.'
            : 'An https:// address, or a gradient.'
        }
        onChange={(value) => setBackground(target, { 'background-image': toBackgroundImage(value) })}
      />

      {image && (
        <>
          <SegmentedControl
            label="Fit"
            value={fit}
            clearable={false}
            options={[
              { value: 'cover', label: 'Cover', title: 'Fill the area, cropping the overflow' },
              { value: 'contain', label: 'Fit', title: 'Scale until the whole image shows' },
              { value: 'tile', label: 'Tile', title: 'Repeat it at its natural size' },
            ]}
            onChange={(value) => setBackground(target, fitPatches[value as BackgroundFit])}
          />

          {fit !== 'tile' && (
            <SelectControl
              label="Position"
              value={styleValue(target, 'background-position')}
              options={positionOptions}
              emptyLabel="Top left"
              onChange={(value) => setBackground(target, { 'background-position': value })}
            />
          )}
        </>
      )}
    </>
  );
}

/* --------------------------------------------------------------------------
 * Traits
 * ------------------------------------------------------------------------ */

function TraitField({ trait, fieldKey }: { trait: Trait; fieldKey: string }) {
  const name = trait.getName();
  const label = String(trait.getLabel() || name);
  const key = `${fieldKey}:${name}`;
  const raw = trait.getValue();

  switch (trait.getType()) {
    case 'select': {
      const options: Option[] = trait.getOptions().map((option) => ({
        value: trait.getOptionId(option),
        label: trait.getOptionLabel(option),
      }));
      return (
        <SelectControl
          label={label}
          value={String(raw ?? '')}
          options={options}
          onChange={(value) => trait.setValue(value)}
        />
      );
    }

    case 'checkbox':
      return (
        <Field label={label}>
          <input
            type="checkbox"
            checked={Boolean(trait.getValue({ useType: true }))}
            onChange={(event) => trait.setValue(event.target.checked)}
            className="size-4 rounded border-input accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </Field>
      );

    case 'color':
      return (
        <ColorControl
          label={label}
          value={String(raw ?? '')}
          fieldKey={key}
          onChange={(value) => trait.setValue(value)}
        />
      );

    default:
      return (
        <TextControl
          label={label}
          value={String(raw ?? '')}
          fieldKey={key}
          placeholder={String(trait.get('placeholder') ?? '')}
          onChange={(value) => trait.setValue(value)}
        />
      );
  }
}

/**
 * The text of a component whose entire content is one text node.
 *
 * Returns null for anything richer, because writing back would flatten nested
 * markup. Both the canvas (`el.textContent`) and the exported HTML
 * (`escapeNodeContent`) treat this value as text, so it needs no escaping here.
 */
function textNodeChild(component: Component): Component | null {
  const children = component.components();
  if (children.length !== 1) return null;

  const child = children.at(0);
  return child?.get('type') === 'textnode' ? child : null;
}

/* --------------------------------------------------------------------------
 * Style vocabulary
 * ------------------------------------------------------------------------ */

const displayOptions: Option[] = [
  { value: 'block', label: 'Block' },
  { value: 'flex', label: 'Flex' },
  { value: 'grid', label: 'Grid' },
  { value: 'inline-block', label: 'Inline block' },
  { value: 'inline', label: 'Inline' },
  { value: 'none', label: 'Hidden' },
];

const justifyOptions: Option[] = [
  { value: 'flex-start', label: 'Start' },
  { value: 'center', label: 'Center' },
  { value: 'flex-end', label: 'End' },
  { value: 'space-between', label: 'Space between' },
  { value: 'space-around', label: 'Space around' },
];

const alignOptions: Option[] = [
  { value: 'stretch', label: 'Stretch' },
  { value: 'flex-start', label: 'Start' },
  { value: 'center', label: 'Center' },
  { value: 'flex-end', label: 'End' },
  { value: 'baseline', label: 'Baseline' },
];

const weightOptions: Option[] = [
  { value: '400', label: 'Regular' },
  { value: '500', label: 'Medium' },
  { value: '600', label: 'Semibold' },
  { value: '700', label: 'Bold' },
];

const positionOptions: Option[] = [
  { value: 'center', label: 'Center' },
  { value: 'top', label: 'Top' },
  { value: 'bottom', label: 'Bottom' },
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
  { value: 'top left', label: 'Top left' },
  { value: 'top right', label: 'Top right' },
  { value: 'bottom left', label: 'Bottom left' },
  { value: 'bottom right', label: 'Bottom right' },
];

/* --------------------------------------------------------------------------
 * Panel
 * ------------------------------------------------------------------------ */

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <MousePointerSquareDashed className="size-5" aria-hidden="true" />
      </span>
      <p className="text-sm font-medium text-foreground">Nothing selected</p>
      <p className="max-w-[26ch] text-xs leading-relaxed text-muted-foreground">
        Click any element on the page and its settings appear right here — no tabs, no digging.
      </p>
    </div>
  );
}

/**
 * The panel for the page itself.
 *
 * Separate from the element panel rather than a set of hidden sections, because
 * almost nothing they show applies: the page has no traits, cannot be
 * duplicated or deleted, and GrapesJS restricts the wrapper to background
 * properties. What is left is one section and an explanation of what it covers.
 */
function PagePanel({
  editor,
  images,
}: {
  editor: Editor;
  images: { url: string; label: string }[];
}) {
  return (
    <div>
      <header className="border-b bg-muted/30 px-4 py-3">
        <h2 className="truncate text-sm font-semibold text-foreground">Page</h2>
        <code className="mt-0.5 block truncate text-[11px] text-muted-foreground">body</code>
      </header>

      <PanelSection title="Background">
        <BackgroundFields target={pageTarget(editor)} fieldKey="page" images={images} />
        <p className="text-xs leading-relaxed text-muted-foreground">
          Sits behind every block on this page. Each page in the site keeps its own, since each
          ships as its own file.
        </p>
      </PanelSection>
    </div>
  );
}

/**
 * The right-hand panel.
 *
 * The ordering is the point of this demo: a component's own settings sit at the
 * top, visible the moment it is selected, with styling below. GrapesJS's stock
 * chrome puts the Style Manager in front and hides traits behind a toolbar
 * button, so editing the one field a component actually exposes — the hero's
 * npub — costs two clicks and a scroll.
 */
export function Inspector({ editor, files = [] }: InspectorProps) {
  const selected = useSelectedComponent(editor);
  // `styleable:change` is the one a bare CSS rule fires — the page background
  // is written through the CssComposer rather than onto a component.
  useEditorEvent(editor, 'component:update component:styleUpdate styleable:change change:device');

  if (!editor || !selected) return <EmptyState />;

  const images = files.flatMap((file) =>
    file.url && isImageFile(file) ? [{ url: file.url, label: file.path }] : [],
  );

  if (selected === editor.getWrapper()) return <PagePanel editor={editor} images={images} />;

  const id = selected.getId();
  const traits = selected.getTraits();
  const textChild = textNodeChild(selected);
  const display = styleValue(selected, 'display');
  const isFlex = display === 'flex' || display === 'inline-flex';
  const isGrid = display === 'grid';

  const parent = selected.parent();
  const canRemove = selected.get('removable') !== false && Boolean(parent);
  const canCopy = selected.get('copyable') !== false && Boolean(parent);

  const duplicate = () => {
    if (!parent) return;
    const index = parent.components().indexOf(selected);
    const [copy] = parent.append(selected.clone(), { at: index + 1 });
    if (copy) editor.select(copy);
  };

  return (
    <div>
      <header className="flex items-start gap-2 border-b bg-muted/30 px-4 py-3">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold text-foreground">
            {componentName(selected)}
          </h2>
          <code className="mt-0.5 block truncate text-[11px] text-muted-foreground">
            {String(selected.get('tagName') || 'node')}
          </code>
        </div>

        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            onClick={duplicate}
            disabled={!canCopy}
            title="Duplicate"
            className={cn(
              'flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors',
              'hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              'disabled:pointer-events-none disabled:opacity-40',
            )}
          >
            <Copy className="size-3.5" aria-hidden="true" />
            <span className="sr-only">Duplicate</span>
          </button>
          <button
            type="button"
            onClick={() => selected.remove()}
            disabled={!canRemove}
            title="Delete"
            className={cn(
              'flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors',
              'hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              'disabled:pointer-events-none disabled:opacity-40',
            )}
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
            <span className="sr-only">Delete</span>
          </button>
        </div>
      </header>

      <PanelSection title="Settings">
        {textChild && (
          <TextControl
            label="Content"
            multiline
            value={String(textChild.get('content') ?? '')}
            fieldKey={`${id}:content`}
            onChange={(value) => textChild.set('content', value)}
          />
        )}

        {traits.length > 0 ? (
          traits.map((trait) => (
            <TraitField key={String(trait.getId())} trait={trait} fieldKey={id} />
          ))
        ) : textChild ? null : (
          <p className="text-xs leading-relaxed text-muted-foreground">
            This element has no settings of its own. Registered component types declare traits —
            select the Profile hero to see one.
          </p>
        )}
      </PanelSection>

      <PanelSection title="Layout">
        <SelectControl
          label="Display"
          value={display}
          options={displayOptions}
          onChange={(value) => setStyle(selected, { display: value })}
        />

        {isFlex && (
          <SegmentedControl
            label="Direction"
            value={styleValue(selected, 'flex-direction')}
            options={[
              { value: 'row', label: 'Row' },
              { value: 'column', label: 'Column' },
            ]}
            onChange={(value) => setStyle(selected, { 'flex-direction': value })}
          />
        )}

        {isFlex && (
          <>
            <SelectControl
              label="Justify"
              value={styleValue(selected, 'justify-content')}
              options={justifyOptions}
              onChange={(value) => setStyle(selected, { 'justify-content': value })}
            />
            <SelectControl
              label="Align"
              value={styleValue(selected, 'align-items')}
              options={alignOptions}
              onChange={(value) => setStyle(selected, { 'align-items': value })}
            />
          </>
        )}

        {(isFlex || isGrid) && (
          <TextControl
            label="Gap"
            value={styleValue(selected, 'gap')}
            fieldKey={`${id}:gap`}
            placeholder="16px"
            onChange={(value) => setStyle(selected, { gap: value })}
          />
        )}
      </PanelSection>

      <PanelSection title="Size">
        <div className="grid grid-cols-2 gap-2">
          <TextControl
            label="Width"
            value={styleValue(selected, 'width')}
            fieldKey={`${id}:width`}
            placeholder="auto"
            onChange={(value) => setStyle(selected, { width: value })}
          />
          <TextControl
            label="Height"
            value={styleValue(selected, 'height')}
            fieldKey={`${id}:height`}
            placeholder="auto"
            onChange={(value) => setStyle(selected, { height: value })}
          />
        </div>
        <TextControl
          label="Max width"
          value={styleValue(selected, 'max-width')}
          fieldKey={`${id}:max-width`}
          placeholder="none"
          onChange={(value) => setStyle(selected, { 'max-width': value })}
        />
      </PanelSection>

      <PanelSection title="Spacing">
        <BoxControl
          label="Padding"
          value={boxValues(selected, 'padding')}
          fieldKey={`${id}:padding`}
          onChange={(side, value) => setBoxSide(selected, 'padding', side, value)}
        />
        <BoxControl
          label="Margin"
          value={boxValues(selected, 'margin')}
          fieldKey={`${id}:margin`}
          onChange={(side, value) => setBoxSide(selected, 'margin', side, value)}
        />
      </PanelSection>

      <PanelSection title="Typography">
        <div className="grid grid-cols-2 gap-2">
          <TextControl
            label="Size"
            value={styleValue(selected, 'font-size')}
            fieldKey={`${id}:font-size`}
            placeholder="18px"
            onChange={(value) => setStyle(selected, { 'font-size': value })}
          />
          <TextControl
            label="Line height"
            value={styleValue(selected, 'line-height')}
            fieldKey={`${id}:line-height`}
            placeholder="1.6"
            onChange={(value) => setStyle(selected, { 'line-height': value })}
          />
        </div>

        <SelectControl
          label="Weight"
          value={styleValue(selected, 'font-weight')}
          options={weightOptions}
          onChange={(value) => setStyle(selected, { 'font-weight': value })}
        />

        <SegmentedControl
          label="Align"
          value={styleValue(selected, 'text-align')}
          options={[
            { value: 'left', label: 'Left' },
            { value: 'center', label: 'Center' },
            { value: 'right', label: 'Right' },
          ]}
          onChange={(value) => setStyle(selected, { 'text-align': value })}
        />

        <ColorControl
          label="Text colour"
          value={styleValue(selected, 'color')}
          fieldKey={`${id}:color`}
          onChange={(value) => setStyle(selected, { color: value })}
        />
      </PanelSection>

      <PanelSection title="Background">
        <BackgroundFields target={selected} fieldKey={id} images={images} />
      </PanelSection>

      <PanelSection title="Appearance">
        <div className="grid grid-cols-2 gap-2">
          <TextControl
            label="Radius"
            value={styleValue(selected, 'border-radius')}
            fieldKey={`${id}:border-radius`}
            placeholder="12px"
            onChange={(value) => setStyle(selected, { 'border-radius': value })}
          />
          <TextControl
            label="Opacity"
            value={styleValue(selected, 'opacity')}
            fieldKey={`${id}:opacity`}
            placeholder="1"
            onChange={(value) => setStyle(selected, { opacity: value })}
          />
        </div>
        <TextControl
          label="Border"
          value={styleValue(selected, 'border')}
          fieldKey={`${id}:border`}
          placeholder="1px solid #e2e8f0"
          onChange={(value) => setStyle(selected, { border: value })}
        />
      </PanelSection>
    </div>
  );
}
