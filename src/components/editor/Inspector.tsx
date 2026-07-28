import type { Component, Editor, Trait } from 'grapesjs';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Copy,
  MousePointerSquareDashed,
  Trash2,
} from 'lucide-react';

import type { FontFamily } from '@/lib/fonts/catalogue';
import { fontFamilyValue } from '@/lib/fonts/install';
import { isImageFile, type NsiteFile } from '@/lib/nsite/files';
import { parseCssUrl } from '@/lib/nsite/siteHtml';
import { cn } from '@/lib/utils';
import { BackgroundPicker } from './BackgroundPicker';
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
import { FontControl } from './FontControl';
import { componentName, useEditorEvent, useSelectedComponent } from './editorHooks';
import {
  backgroundFit,
  backgroundValues,
  fitPatches,
  pageTarget,
  setBackground,
  setStyle,
  styleValue,
  toBackgroundImage,
  type BackgroundFit,
  type StyleTarget,
} from './styleTarget';

interface InspectorProps {
  editor: Editor | null;
  /** Every file in the site, for the background image picker. */
  files?: NsiteFile[];
  /** Adds an uploaded image to the site. Absent when nobody is signed in. */
  onUploadImage?: (file: File) => Promise<string | null>;
  /** Downloads a font into the site. Resolves false if it couldn't be fetched. */
  onInstallFont?: (font: FontFamily) => Promise<boolean>;
  /** Called after a font is set or cleared, so unused faces can be dropped. */
  onFontChanged?: () => void;
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
 * Offsets
 *
 * `top`/`right`/`bottom`/`left` are already longhands rather than sides of a
 * shorthand, so this is thinner than the padding/margin machinery above — but
 * `inset` is a shorthand for exactly these four, in the same order, and has to
 * be collapsed for the same reason.
 * ------------------------------------------------------------------------ */

const insetProps = ['top', 'right', 'bottom', 'left'] as const;

function insetValues(target: StyleTarget): Box {
  const shorthand = parseBoxShorthand(styleValue(target, 'inset')) ?? ['', '', '', ''];
  return insetProps.map((prop, index) => styleValue(target, prop) || shorthand[index]) as Box;
}

/**
 * Returning an element to the flow takes its offsets and stacking order with
 * it. They are inert on a static element, so leaving them behind would put
 * declarations in the published stylesheet that do nothing — and would silently
 * move the element again the next time it was positioned.
 */
function setPosition(target: StyleTarget, value: string) {
  if (value) {
    setStyle(target, { position: value });
    return;
  }

  setStyle(target, {
    position: '',
    inset: '',
    'z-index': '',
    ...Object.fromEntries(insetProps.map((prop) => [prop, ''])),
  });
}

function setInsetSide(target: StyleTarget, side: number, value: string) {
  const next = insetValues(target);
  next[side] = value;

  const patch: Record<string, string> = { inset: '' };
  insetProps.forEach((prop, index) => {
    patch[prop] = next[index];
  });

  setStyle(target, patch);
}

interface BackgroundFieldsProps {
  target: StyleTarget;
  fieldKey: string;
  images: { url: string; label: string }[];
  onUpload?: (file: File) => Promise<string | null>;
}

/** Colour, image, and how the image is laid out. Shared by pages and elements. */
function BackgroundFields({ target, fieldKey, images, onUpload }: BackgroundFieldsProps) {
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
        onUpload={onUpload}
        hint={
          images.length
            ? 'Upload one, paste an https:// address or a gradient, or reuse an image below.'
            : 'Upload one, or paste an https:// address or a gradient.'
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
              options={backgroundPositionOptions}
              emptyLabel="Top left"
              onChange={(value) => setBackground(target, { 'background-position': value })}
            />
          )}
        </>
      )}
    </>
  );
}

interface FontFieldsProps {
  target: StyleTarget;
  label: string;
  /** Left off where the surrounding panel is already saying enough. */
  hint?: string;
  onInstallFont?: (font: FontFamily) => Promise<boolean>;
  onFontChanged?: () => void;
}

/**
 * The typeface picker. Shared by pages and elements, like `BackgroundFields`.
 *
 * The declaration is written only once the files are in the site, so a font
 * that couldn't be downloaded leaves the page exactly as it was rather than
 * naming a family nothing can load.
 */
function FontFields({ target, label, hint, onInstallFont, onFontChanged }: FontFieldsProps) {
  const change = (value: string) => {
    setStyle(target, { 'font-family': value });
    onFontChanged?.();
  };

  return (
    <FontControl
      label={label}
      value={styleValue(target, 'font-family')}
      hint={hint}
      onPick={async (font) => {
        if (onInstallFont && !(await onInstallFont(font))) return;
        change(fontFamilyValue(font));
      }}
      onClear={() => change('')}
    />
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

/** Tags that exist to carry text, whatever they happen to contain right now. */
const TEXT_TAGS = new Set([
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'p',
  'blockquote',
  'figcaption',
  'li',
  'a',
  'span',
  'strong',
  'em',
  'small',
  'label',
  'td',
  'th',
]);

/**
 * Whether typography is the first thing someone selecting this would want.
 *
 * Decided by tag rather than by content, so that a heading is still a heading
 * while it happens to be empty or holds a nested `<span>`. A container that has
 * ended up with nothing but text counts too — a `<div>` used as a caption is
 * one in every respect except the tag.
 */
function isTextElement(component: Component): boolean {
  const tag = String(component.get('tagName') ?? '').toLowerCase();
  return TEXT_TAGS.has(tag) || Boolean(textNodeChild(component));
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

/**
 * `align-self` takes everything `align-items` does, plus `auto` — which is not
 * the same as leaving it unset, since it explicitly defers to the parent.
 */
const alignSelfOptions: Option[] = [{ value: 'auto', label: 'Auto' }, ...alignOptions];

const justifySelfOptions: Option[] = [
  { value: 'stretch', label: 'Stretch' },
  { value: 'start', label: 'Start' },
  { value: 'center', label: 'Center' },
  { value: 'end', label: 'End' },
];

/**
 * No `static` entry: that is what the control's empty option already means, and
 * offering both would be two ways to say the same thing — one of which writes a
 * declaration that changes nothing.
 */
const positionOptions: Option[] = [
  { value: 'relative', label: 'Relative' },
  { value: 'absolute', label: 'Absolute' },
  { value: 'fixed', label: 'Fixed' },
  { value: 'sticky', label: 'Sticky' },
];

/**
 * Four labels do not fit the panel's width, so these are drawn rather than
 * named — the icons are the same ones the text toolbar uses over the canvas,
 * which writes this very property.
 */
const textAlignOptions = [
  { value: 'left', label: 'Left', icon: AlignLeft },
  { value: 'center', label: 'Center', icon: AlignCenter },
  { value: 'right', label: 'Right', icon: AlignRight },
  { value: 'justify', label: 'Justify', icon: AlignJustify },
].map(({ value, label, icon: Icon }) => ({
  value,
  label,
  icon: <Icon className="size-3.5" aria-hidden="true" />,
}));

const weightOptions: Option[] = [
  { value: '400', label: 'Regular' },
  { value: '500', label: 'Medium' },
  { value: '600', label: 'Semibold' },
  { value: '700', label: 'Bold' },
];

/** Where a background image sits — not to be confused with `positionOptions`. */
const backgroundPositionOptions: Option[] = [
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
 * properties. That leaves two decisions — what the page sits on and what it is
 * set in — and both are answered here by looking rather than by typing.
 *
 * So this one is deliberately unlike the rest of the inspector: no uppercase
 * section rules, no field labels, no paragraph under each control explaining
 * what a background is. Choosing how your own page looks should feel like
 * flipping through swatches, not like filling in a form.
 */
function PagePanel({
  editor,
  images,
  onUpload,
  onInstallFont,
  onFontChanged,
}: {
  editor: Editor;
  images: { url: string; label: string }[];
  onUpload?: (file: File) => Promise<string | null>;
  onInstallFont?: (font: FontFamily) => Promise<boolean>;
  onFontChanged?: () => void;
}) {
  return (
    <div className="space-y-5 p-4">
      <header>
        <h2 className="text-base font-semibold text-foreground">Your page</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Pick a look. Change it as often as you like.
        </p>
      </header>

      <BackgroundPicker target={pageTarget(editor)} images={images} onUpload={onUpload} />

      <FontFields
        target={pageTarget(editor)}
        label="Font"
        onInstallFont={onInstallFont}
        onFontChanged={onFontChanged}
      />
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
export function Inspector({
  editor,
  files = [],
  onUploadImage,
  onInstallFont,
  onFontChanged,
}: InspectorProps) {
  const selected = useSelectedComponent(editor);
  // `styleable:change` is the one a bare CSS rule fires — the page background
  // is written through the CssComposer rather than onto a component.
  useEditorEvent(editor, 'component:update component:styleUpdate styleable:change change:device');

  if (!editor || !selected) return <EmptyState />;

  const images = files.flatMap((file) =>
    file.url && isImageFile(file) ? [{ url: file.url, label: file.path }] : [],
  );

  if (selected === editor.getWrapper()) {
    return (
      <PagePanel
        editor={editor}
        images={images}
        onUpload={onUploadImage}
        onInstallFont={onInstallFont}
        onFontChanged={onFontChanged}
      />
    );
  }

  const id = selected.getId();
  const traits = selected.getTraits();
  const textChild = textNodeChild(selected);
  const display = styleValue(selected, 'display');
  const isFlex = display === 'flex' || display === 'inline-flex';
  const isGrid = display === 'grid';

  const position = styleValue(selected, 'position');
  // Offsets and stacking order do nothing on a statically positioned element,
  // so the fields for them stay out of the way until they would have an effect.
  const isPositioned = Boolean(position) && position !== 'static';

  const parent = selected.parent();

  /*
   * How the *parent* lays out decides which properties on the child are live:
   * `flex-grow` is inert outside a flex container and `grid-column` outside a
   * grid one. Reading the parent is what lets the panel offer the half of the
   * layout model that belongs to the item rather than the container.
   */
  const parentDisplay = parent ? styleValue(parent, 'display') : '';
  const inFlex = parentDisplay === 'flex' || parentDisplay === 'inline-flex';
  const inGrid = parentDisplay === 'grid';
  const canRemove = selected.get('removable') !== false && Boolean(parent);
  const canCopy = selected.get('copyable') !== false && Boolean(parent);

  /*
   * Typography leads for anything that is mostly text, and keeps its usual
   * place below the box properties for everything else.
   *
   * Selecting a heading to restyle it is the common case, and reaching the font
   * meant scrolling past four sections of layout that a heading rarely needs.
   * It sits after Settings rather than above it, because for a text element
   * Settings is where the text itself is edited — the one thing that should
   * stay directly under the element's own name.
   */
  const isText = isTextElement(selected);

  const typography = (
    <PanelSection title="Typography">
      <FontFields
        target={selected}
        label="Font"
        hint="Downloaded into the site, so the published page serves its own fonts."
        onInstallFont={onInstallFont}
        onFontChanged={onFontChanged}
      />

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
        options={textAlignOptions}
        onChange={(value) => setStyle(selected, { 'text-align': value })}
      />

      <ColorControl
        label="Text colour"
        value={styleValue(selected, 'color')}
        fieldKey={`${id}:color`}
        onChange={(value) => setStyle(selected, { color: value })}
      />
    </PanelSection>
  );

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

      {isText && typography}

      <PanelSection title="Layout">
        <SelectControl
          label="Display"
          value={display}
          options={displayOptions}
          onChange={(value) => setStyle(selected, { display: value })}
        />

        {isFlex && (
          <>
            <SegmentedControl
              label="Direction"
              value={styleValue(selected, 'flex-direction')}
              options={[
                { value: 'row', label: 'Row' },
                { value: 'column', label: 'Column' },
              ]}
              onChange={(value) => setStyle(selected, { 'flex-direction': value })}
            />
            <SegmentedControl
              label="Wrap"
              value={styleValue(selected, 'flex-wrap')}
              options={[
                { value: 'nowrap', label: 'No wrap', title: 'Squeeze everything onto one line' },
                { value: 'wrap', label: 'Wrap', title: 'Start a new line when it runs out of room' },
              ]}
              onChange={(value) => setStyle(selected, { 'flex-wrap': value })}
            />
          </>
        )}

        {isGrid && (
          <>
            {/*
              The presets are a shortcut and the text fields are the truth, the
              same split `ColorControl` and `ImageControl` use: a track list can
              say things like `240px 1fr` or `repeat(auto-fill, minmax(160px,
              1fr))` that no fixed set of buttons could offer.
            */}
            <SegmentedControl
              label="Columns"
              value={styleValue(selected, 'grid-template-columns')}
              options={[2, 3, 4].map((count) => ({
                value: `repeat(${count}, 1fr)`,
                label: String(count),
                title: `${count} equal columns`,
              }))}
              onChange={(value) => setStyle(selected, { 'grid-template-columns': value })}
            />
            <TextControl
              label="Column tracks"
              value={styleValue(selected, 'grid-template-columns')}
              fieldKey={`${id}:grid-template-columns`}
              placeholder="repeat(3, 1fr)"
              onChange={(value) => setStyle(selected, { 'grid-template-columns': value })}
            />
            <TextControl
              label="Row tracks"
              value={styleValue(selected, 'grid-template-rows')}
              fieldKey={`${id}:grid-template-rows`}
              placeholder="auto"
              onChange={(value) => setStyle(selected, { 'grid-template-rows': value })}
            />
          </>
        )}

        {/* Both layout modes read these, and both spell the values the same way. */}
        {(isFlex || isGrid) && (
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
            <TextControl
              label="Gap"
              value={styleValue(selected, 'gap')}
              fieldKey={`${id}:gap`}
              placeholder="16px"
              onChange={(value) => setStyle(selected, { gap: value })}
            />
          </>
        )}
      </PanelSection>

      <PanelSection title="Position">
        <SelectControl
          label="Mode"
          value={position}
          options={positionOptions}
          emptyLabel="Static (in flow)"
          onChange={(value) => setPosition(selected, value)}
          hint={
            isPositioned
              ? undefined
              : 'Switch to Absolute to place this anywhere on the page, or Relative to nudge it and hold positioned children.'
          }
        />

        {isPositioned && (
          <>
            <BoxControl
              label="Offset"
              value={insetValues(selected)}
              fieldKey={`${id}:inset`}
              onChange={(side, value) => setInsetSide(selected, side, value)}
            />
            <TextControl
              label="Z-index"
              value={styleValue(selected, 'z-index')}
              fieldKey={`${id}:z-index`}
              placeholder="auto"
              hint="Higher numbers sit in front."
              onChange={(value) => setStyle(selected, { 'z-index': value })}
            />
          </>
        )}
      </PanelSection>

      {(inFlex || inGrid) && (
        <PanelSection title={inGrid ? 'Grid item' : 'Flex item'}>
          {inFlex && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <TextControl
                  label="Grow"
                  value={styleValue(selected, 'flex-grow')}
                  fieldKey={`${id}:flex-grow`}
                  placeholder="0"
                  onChange={(value) => setStyle(selected, { 'flex-grow': value })}
                />
                <TextControl
                  label="Shrink"
                  value={styleValue(selected, 'flex-shrink')}
                  fieldKey={`${id}:flex-shrink`}
                  placeholder="1"
                  onChange={(value) => setStyle(selected, { 'flex-shrink': value })}
                />
              </div>
              <TextControl
                label="Basis"
                value={styleValue(selected, 'flex-basis')}
                fieldKey={`${id}:flex-basis`}
                placeholder="auto"
                hint="The size to start from before growing or shrinking — try 30% for a sidebar."
                onChange={(value) => setStyle(selected, { 'flex-basis': value })}
              />
            </>
          )}

          {inGrid && (
            <>
              <TextControl
                label="Column"
                value={styleValue(selected, 'grid-column')}
                fieldKey={`${id}:grid-column`}
                placeholder="auto"
                hint="`span 2` to widen it, or `1 / 4` to pin it to specific lines."
                onChange={(value) => setStyle(selected, { 'grid-column': value })}
              />
              <TextControl
                label="Row"
                value={styleValue(selected, 'grid-row')}
                fieldKey={`${id}:grid-row`}
                placeholder="auto"
                onChange={(value) => setStyle(selected, { 'grid-row': value })}
              />
              <SelectControl
                label="Justify self"
                value={styleValue(selected, 'justify-self')}
                options={justifySelfOptions}
                onChange={(value) => setStyle(selected, { 'justify-self': value })}
              />
            </>
          )}

          <SelectControl
            label="Align self"
            value={styleValue(selected, 'align-self')}
            options={alignSelfOptions}
            onChange={(value) => setStyle(selected, { 'align-self': value })}
          />
          <TextControl
            label="Order"
            value={styleValue(selected, 'order')}
            fieldKey={`${id}:order`}
            placeholder="0"
            hint="Reorders this item without moving it in the markup."
            onChange={(value) => setStyle(selected, { order: value })}
          />
        </PanelSection>
      )}

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

      {!isText && typography}

      <PanelSection title="Background">
        <BackgroundFields
          target={selected}
          fieldKey={id}
          images={images}
          onUpload={onUploadImage}
        />
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
