import { useId, type ReactNode } from 'react';

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

interface ColorControlProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  fieldKey: string;
}

/**
 * A swatch paired with a text input.
 *
 * `<input type="color">` only understands `#rrggbb`, but stylesheets are full
 * of `transparent`, `rgb(...)` and gradients — so the text input stays
 * authoritative and the swatch is a convenience that writes into it.
 */
export function ColorControl({ label, value, onChange, fieldKey }: ColorControlProps) {
  const id = useId();
  const swatch = /^#[0-9a-f]{6}$/i.test(value.trim()) ? value.trim() : '#000000';

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
      </div>
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
