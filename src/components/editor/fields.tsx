import { useId, useRef, useState, type ReactNode } from 'react';
import { Image as ImageIcon, Loader2 } from 'lucide-react';

import { CHECKERBOARD } from './checkerboard';
import { cn } from '@/lib/utils';

/**
 * Compact form controls for the inspector panel.
 *
 * These use native `<input>` / `<select>` rather than the app's shadcn
 * equivalents: the panel is a dense 300px column where every control is ~28px
 * tall, and the Radix `Select` in particular renders a portalled listbox sized
 * for page forms. Styling natives keeps the density without fighting a
 * component built for a different context.
 */

const controlClass =
  'h-8 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground hover:border-ring/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50';

interface FieldProps {
  label: string;
  /** Links the label to the control it describes. */
  htmlFor?: string;
  hint?: string;
  children: ReactNode;
}

export function Field({ label, htmlFor, hint, children }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={htmlFor}
        className="block text-xs font-medium leading-none text-muted-foreground"
      >
        {label}
      </label>
      {children}
      {hint && <p className="text-xs leading-snug text-muted-foreground/80">{hint}</p>}
    </div>
  );
}

interface TextControlProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label: string;
  hint?: string;
  /**
   * Changes identity when the underlying model changes, remounting the input.
   *
   * The inputs are uncontrolled (`defaultValue`) so that re-renders triggered
   * by the editor's own change events cannot reset the caret mid-word. Keying
   * them is what still picks up a new selection or an external edit.
   */
  fieldKey: string;
  multiline?: boolean;
}

export function TextControl({
  value,
  onChange,
  placeholder,
  label,
  hint,
  fieldKey,
  multiline,
}: TextControlProps) {
  const id = useId();

  return (
    <Field label={label} htmlFor={id} hint={hint}>
      {multiline ? (
        <textarea
          key={fieldKey}
          id={id}
          rows={3}
          defaultValue={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          className={cn(controlClass, 'h-auto resize-y py-1.5 leading-relaxed')}
        />
      ) : (
        <input
          key={fieldKey}
          id={id}
          type="text"
          defaultValue={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          className={controlClass}
        />
      )}
    </Field>
  );
}

export interface Option {
  value: string;
  label: string;
}

interface SelectControlProps {
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  /** Shown as the first entry when nothing is set. */
  emptyLabel?: string;
  hint?: string;
}

export function SelectControl({
  label,
  value,
  options,
  onChange,
  emptyLabel = 'Default',
  hint,
}: SelectControlProps) {
  const id = useId();

  return (
    <Field label={label} htmlFor={id} hint={hint}>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cn(controlClass, 'cursor-pointer pr-6')}
      >
        <option value="">{emptyLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

interface SegmentedControlProps {
  label: string;
  value: string;
  options: { value: string; label: string; icon?: ReactNode; title?: string }[];
  onChange: (value: string) => void;
  /** Clicking the active segment clears the value. */
  clearable?: boolean;
}

export function SegmentedControl({
  label,
  value,
  options,
  onChange,
  clearable = true,
}: SegmentedControlProps) {
  return (
    <Field label={label}>
      <div role="group" aria-label={label} className="flex gap-1 rounded-md bg-muted p-1">
        {options.map((option) => {
          const active = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              title={option.title ?? option.label}
              onClick={() => onChange(active && clearable ? '' : option.value)}
              className={cn(
                'flex h-6 flex-1 items-center justify-center gap-1 rounded px-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                active
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {option.icon ?? option.label}
            </button>
          );
        })}
      </div>
    </Field>
  );
}

interface RangeControlProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  /** The current value, spelled for a reader — `1200px` rather than `1200`. */
  valueLabel: string;
  onChange: (value: number) => void;
}

/**
 * A slider with its value read out beside the label.
 *
 * For the one kind of number where the answer is "however it looks" rather than
 * a figure anyone knows in advance. Dragging shows the page changing under the
 * pointer, which is the whole judgement being made; the readout is there so the
 * result can still be matched somewhere else later.
 *
 * Controlled rather than keyed like `TextControl`, because a range input has no
 * caret to lose — and it has to follow the model, or the thumb springs back to
 * where it started as the editor's change events land mid-drag.
 */
export function RangeControl({
  label,
  value,
  min,
  max,
  step,
  valueLabel,
  onChange,
}: RangeControlProps) {
  const id = useId();

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-xs font-medium leading-none text-muted-foreground">
          {label}
        </label>
        <span className="text-xs font-medium tabular-nums text-foreground">{valueLabel}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      />
    </div>
  );
}

interface ColorControlProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  fieldKey: string;
  /** Adds a checkerboard button that clears the colour, making it transparent. */
  allowTransparent?: boolean;
}

/**
 * What the swatch shows for a value.
 *
 * `#rrggbb` is what the native picker understands. A colour that has been
 * through a serialize/parse round-trip — a page switch, an edit in the code
 * panel — comes back from the browser's own stylesheet as `rgb(255, 0, 0)`,
 * so those are converted too; without it the swatch would insist a red it is
 * painting is black. Anything else still shows black, and the text field
 * beside the swatch stays the source of truth.
 */
function swatchColor(value: string): string {
  const trimmed = value.trim();
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) return trimmed;

  const rgb = /^rgba?\(\s*(\d+)\s*[,\s]\s*(\d+)\s*[,\s]\s*(\d+)/i.exec(trimmed);
  if (rgb) {
    return `#${rgb
      .slice(1, 4)
      .map((channel) => Math.min(Number(channel), 255).toString(16).padStart(2, '0'))
      .join('')}`;
  }

  return '#000000';
}

/**
 * Whether a colour value amounts to see-through: unset, the keyword, or a
 * zero alpha — which is what `transparent` returns as once the browser's
 * stylesheet has serialized it (`rgba(0, 0, 0, 0)`). The alpha has to be a
 * real fourth channel: in `rgb(255, 0, 0)` the trailing zero is blue.
 */
function isTransparent(value: string): boolean {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed || trimmed === 'transparent') return true;

  return (
    /^rgba\([^,]+,[^,]+,[^,]+,\s*0(?:\.0+)?%?\s*\)$/.test(trimmed) ||
    /^rgba?\([^,/]+\s+[^,/]+\s+[^,/]+\s*\/\s*0(?:\.0+)?%?\s*\)$/.test(trimmed)
  );
}

/**
 * A swatch paired with a text input.
 *
 * `<input type="color">` only understands `#rrggbb`, but stylesheets are full
 * of `transparent`, `rgb(...)` and gradients — so the text input stays
 * authoritative and the swatch is a convenience that writes into it.
 */
export function ColorControl({
  label,
  value,
  onChange,
  fieldKey,
  allowTransparent,
}: ColorControlProps) {
  const id = useId();
  const swatch = swatchColor(value);
  const transparent = isTransparent(value);

  return (
    <Field label={label} htmlFor={id}>
      <div className="flex gap-1.5">
        <input
          type="color"
          value={swatch}
          aria-label={`${label} colour picker`}
          onChange={(event) => onChange(event.target.value)}
          className="h-8 w-9 shrink-0 cursor-pointer rounded-md border border-input bg-background p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <input
          key={fieldKey}
          id={id}
          type="text"
          defaultValue={value}
          placeholder="inherit"
          onChange={(event) => onChange(event.target.value)}
          className={cn(controlClass, 'font-mono text-xs')}
        />
        {allowTransparent && (
          <button
            type="button"
            aria-pressed={transparent}
            title="Transparent"
            onClick={() => onChange('')}
            style={CHECKERBOARD}
            className={cn(
              'h-8 w-9 shrink-0 rounded-md border transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              transparent
                ? 'border-primary ring-2 ring-primary/30'
                : 'border-input hover:border-ring/60',
            )}
          >
            <span className="sr-only">Transparent</span>
          </button>
        )}
      </div>
    </Field>
  );
}

interface ImageControlProps {
  label: string;
  /** Whatever belongs in the field — a URL, or a CSS value such as a gradient. */
  value: string;
  onChange: (value: string) => void;
  fieldKey: string;
  /** Shown as a thumbnail, when the value is a plain URL. */
  preview?: string;
  /** Images that ship with the site, offered as one-click choices. */
  options?: { url: string; label: string }[];
  /** Adds a chosen file to the site and resolves to the URL for it. */
  onUpload?: (file: File) => Promise<string | null>;
  hint?: string;
}

/**
 * A URL field with the site's own images beside it.
 *
 * The same split as `ColorControl`: the text input stays authoritative, so any
 * address — or a gradient — can be typed, and the thumbnails are a shortcut for
 * the files already in the project. Picking one writes its object URL, which
 * becomes a site path again when the page is serialized.
 */
export function ImageControl({
  label,
  value,
  onChange,
  fieldKey,
  preview,
  options = [],
  onUpload,
  hint,
}: ImageControlProps) {
  const id = useId();
  const picker = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const choose = async (file: File | undefined) => {
    if (!file || !onUpload) return;

    setUploading(true);
    try {
      const url = await onUpload(file);
      if (url) onChange(url);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Field label={label} htmlFor={id} hint={hint}>
      <div className="flex gap-1.5">
        {/*
          The preview doubles as the upload button. There is nowhere else in
          this panel to put one, and a thumbnail that opens a file picker is
          the same gesture every avatar field uses.
        */}
        <button
          type="button"
          onClick={() => picker.current?.click()}
          disabled={!onUpload || uploading}
          title={onUpload ? 'Upload an image' : 'Log in to upload images'}
          className={cn(
            'group/upload relative flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-md border border-input bg-background transition-colors',
            'hover:border-ring/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            'disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-input',
          )}
        >
          {preview && <img src={preview} alt="" className="size-full object-cover" />}
          <span
            className={cn(
              'absolute inset-0 flex items-center justify-center text-muted-foreground',
              // An empty box shows the affordance outright; over a preview it
              // waits for a hover, so the image stays readable.
              preview &&
                !uploading &&
                'bg-background/80 opacity-0 transition-opacity group-hover/upload:opacity-100 group-focus-visible/upload:opacity-100',
            )}
          >
            {uploading ? (
              <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            ) : (
              <ImageIcon className="size-3.5" aria-hidden="true" />
            )}
          </span>
          <span className="sr-only">{uploading ? 'Uploading' : 'Upload an image'}</span>
        </button>

        <input
          ref={picker}
          type="file"
          accept="image/*"
          // `hidden` rather than `sr-only`: the button above is the labelled
          // control, and this input has nothing useful to announce.
          hidden
          onChange={(event) => {
            void choose(event.target.files?.[0]);
            // Cleared so that choosing the same file twice fires again.
            event.target.value = '';
          }}
        />

        <input
          key={fieldKey}
          id={id}
          type="text"
          defaultValue={value}
          placeholder="https://example.com/stars.png"
          onChange={(event) => onChange(event.target.value)}
          className={cn(controlClass, 'font-mono text-xs')}
        />
      </div>

      {options.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {options.map((option) => {
            const active = option.url === preview;
            return (
              <button
                key={option.url}
                type="button"
                aria-pressed={active}
                title={option.label}
                onClick={() => onChange(active ? '' : option.url)}
                className={cn(
                  'size-8 overflow-hidden rounded-md border bg-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  active ? 'border-primary ring-2 ring-primary/30' : 'hover:border-ring/60',
                )}
              >
                <img src={option.url} alt={option.label} className="size-full object-cover" />
              </button>
            );
          })}
        </div>
      )}
    </Field>
  );
}

interface BoxControlProps {
  label: string;
  /** Top, right, bottom, left. */
  value: [string, string, string, string];
  onChange: (side: 0 | 1 | 2 | 3, value: string) => void;
  fieldKey: string;
}

const boxSides: { index: 0 | 1 | 2 | 3; label: string; title: string }[] = [
  { index: 0, label: 'T', title: 'Top' },
  { index: 1, label: 'R', title: 'Right' },
  { index: 2, label: 'B', title: 'Bottom' },
  { index: 3, label: 'L', title: 'Left' },
];

/** Four sides of a padding/margin box, each independently editable. */
export function BoxControl({ label, value, onChange, fieldKey }: BoxControlProps) {
  return (
    <Field label={label}>
      <div className="grid grid-cols-4 gap-1.5">
        {boxSides.map((side) => (
          <div key={side.label} className="relative">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-muted-foreground/70"
            >
              {side.label}
            </span>
            <input
              key={`${fieldKey}:${side.index}`}
              type="text"
              inputMode="numeric"
              aria-label={`${label} ${side.title}`}
              title={side.title}
              defaultValue={value[side.index]}
              placeholder="–"
              onChange={(event) => onChange(side.index, event.target.value)}
              className={cn(controlClass, 'pl-5 pr-1.5 text-center text-xs')}
            />
          </div>
        ))}
      </div>
    </Field>
  );
}

interface PanelSectionProps {
  title: string;
  children: ReactNode;
  /** Rendered to the right of the title, e.g. a reset button. */
  action?: ReactNode;
}

export function PanelSection({ title, children, action }: PanelSectionProps) {
  return (
    <section className="border-b border-border/60 px-4 py-4 last:border-b-0">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h3>
        {action}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
