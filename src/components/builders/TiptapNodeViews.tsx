import type { ReactNode } from 'react';
import { NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react';
import { Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AboutBlock,
  HeroBlock,
  LinksBlock,
  NotesBlock,
  ZapBlock,
} from '@/components/builders/NsiteBlocks';
import type { DemoLink } from '@/lib/nsiteDemo';
import { cn } from '@/lib/utils';

/**
 * React node views for Tiptap's custom layout blocks.
 *
 * Tiptap only knows about rich text, so anything structural has to be defined
 * as a custom atom node with a view like these. Each one is roughly the amount
 * of code required to add *one* draggable element — the main cost of choosing
 * Tiptap for page building rather than prose editing.
 */

/** Node view props as `ReactNodeViewRenderer` expects them. */
export type BlockViewProps = ReactNodeViewProps<unknown>;

/** Shared chrome so every custom node reads as an editable region. */
export function BlockShell({
  selected,
  label,
  children,
  controls,
}: {
  selected: boolean;
  label: string;
  children: ReactNode;
  controls: ReactNode;
}) {
  return (
    <NodeViewWrapper
      contentEditable={false}
      className={cn(
        'group relative my-4 rounded-xl outline-offset-4',
        selected && 'outline outline-2 outline-primary/40',
      )}
    >
      <div className="pointer-events-none absolute -top-2.5 left-3 z-10 rounded bg-primary px-2 py-0.5 text-[11px] font-medium text-primary-foreground opacity-0 transition-opacity group-hover:opacity-100">
        {label}
      </div>
      {children}
      {/* `hidden` rather than `opacity-0` so the panel claims no space until
          it is actually revealed. */}
      <div className="mt-2 hidden gap-3 rounded-lg border border-dashed bg-muted/40 p-3 group-focus-within:grid group-hover:grid">
        {controls}
      </div>
    </NodeViewWrapper>
  );
}

export function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} className="h-8 text-sm" />
    </div>
  );
}

export function HeroNodeView({ node, updateAttributes, selected }: BlockViewProps) {
  const attrs = node.attrs as {
    name: string;
    tagline: string;
    nip05: string;
    avatar: string;
    banner: string;
  };

  return (
    <BlockShell
      selected={selected}
      label="Profile hero"
      controls={
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Display name"
            value={attrs.name}
            onChange={(name) => updateAttributes({ name })}
          />
          <Field
            label="NIP-05"
            value={attrs.nip05}
            onChange={(nip05) => updateAttributes({ nip05 })}
          />
          <Field
            label="Tagline"
            value={attrs.tagline}
            onChange={(tagline) => updateAttributes({ tagline })}
          />
          <Field
            label="Avatar URL"
            value={attrs.avatar}
            onChange={(avatar) => updateAttributes({ avatar })}
          />
        </div>
      }
    >
      <HeroBlock {...attrs} />
    </BlockShell>
  );
}

export function AboutNodeView({ node, updateAttributes, selected }: BlockViewProps) {
  const attrs = node.attrs as { heading: string; body: string };

  return (
    <BlockShell
      selected={selected}
      label="About"
      controls={
        <div className="grid gap-3">
          <Field
            label="Heading"
            value={attrs.heading}
            onChange={(heading) => updateAttributes({ heading })}
          />
          <Field label="Body" value={attrs.body} onChange={(body) => updateAttributes({ body })} />
        </div>
      }
    >
      <AboutBlock {...attrs} />
    </BlockShell>
  );
}

export function LinksNodeView({ node, updateAttributes, selected }: BlockViewProps) {
  const attrs = node.attrs as { heading: string; links: DemoLink[] };
  const links = attrs.links ?? [];

  const update = (index: number, patch: Partial<DemoLink>) => {
    updateAttributes({
      links: links.map((link, i) => (i === index ? { ...link, ...patch } : link)),
    });
  };

  return (
    <BlockShell
      selected={selected}
      label="Link list"
      controls={
        <div className="grid gap-3">
          <Field
            label="Heading"
            value={attrs.heading}
            onChange={(heading) => updateAttributes({ heading })}
          />
          {links.map((link, i) => (
            <div key={i} className="flex items-end gap-2">
              <div className="flex-1">
                <Field
                  label={`Link ${i + 1} label`}
                  value={link.label}
                  onChange={(label) => update(i, { label })}
                />
              </div>
              <div className="flex-1">
                <Field label="URL" value={link.url} onChange={(url) => update(i, { url })} />
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Remove link ${i + 1}`}
                onClick={() =>
                  updateAttributes({ links: links.filter((_, index) => index !== i) })
                }
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            className="justify-self-start gap-2"
            onClick={() =>
              updateAttributes({ links: [...links, { label: 'New link', url: 'https://' }] })
            }
          >
            <Plus className="size-4" aria-hidden="true" />
            Add link
          </Button>
        </div>
      }
    >
      <LinksBlock heading={attrs.heading} links={links} />
    </BlockShell>
  );
}

export function NotesNodeView({ node, updateAttributes, selected }: BlockViewProps) {
  const attrs = node.attrs as { heading: string; count: number };

  return (
    <BlockShell
      selected={selected}
      label="Recent notes"
      controls={
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Heading"
            value={attrs.heading}
            onChange={(heading) => updateAttributes({ heading })}
          />
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">Notes to show</Label>
            <div className="flex gap-1">
              {[1, 2, 3].map((n) => (
                <Button
                  key={n}
                  variant={attrs.count === n ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => updateAttributes({ count: n })}
                >
                  {n}
                </Button>
              ))}
            </div>
          </div>
        </div>
      }
    >
      <NotesBlock {...attrs} />
    </BlockShell>
  );
}

export function ZapNodeView({ node, updateAttributes, selected }: BlockViewProps) {
  const attrs = node.attrs as { heading: string; lightningAddress: string };

  return (
    <BlockShell
      selected={selected}
      label="Zap callout"
      controls={
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Heading"
            value={attrs.heading}
            onChange={(heading) => updateAttributes({ heading })}
          />
          <Field
            label="Lightning address"
            value={attrs.lightningAddress}
            onChange={(lightningAddress) => updateAttributes({ lightningAddress })}
          />
        </div>
      }
    >
      <ZapBlock {...attrs} />
    </BlockShell>
  );
}
