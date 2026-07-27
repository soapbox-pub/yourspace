import { useState } from 'react';
import { AlertCircle, Check, ChevronDown, Copy, RotateCcw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

export interface OutputTab {
  /** Stable id, also used as the tab value. */
  id: string;
  label: string;
  language: 'json' | 'html';
  /** What this particular serialization is, and what it costs to publish. */
  description: string;
  content: string;
  /**
   * When set, the tab becomes a two-way editor: the content is editable and
   * gains Apply / Revert controls. Throwing from here surfaces the message
   * inline rather than losing the user's draft.
   */
  onApply?: (value: string) => void;
}

interface OutputPanelProps {
  title: string;
  tabs: OutputTab[];
}

const codeClass = 'w-full overflow-auto rounded-lg border bg-background p-4 text-xs leading-relaxed';

/**
 * An editable serialization.
 *
 * The editor keeps re-serializing while this is open, so incoming content is
 * adopted only while the draft is clean — otherwise every canvas change would
 * overwrite what the user is typing.
 */
function EditableOutput({ tab }: { tab: OutputTab & { onApply: (value: string) => void } }) {
  const { content, onApply } = tab;
  // `null` means "no local edits" — the textarea then simply shows whatever the
  // editor last serialized. That keeps the live content and the user's draft in
  // one piece of state, so there is nothing to keep in sync as edits stream in.
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const value = draft ?? content;
  const dirty = draft !== null && draft !== content;

  const apply = () => {
    try {
      onApply(value);
      setDraft(null);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not apply this code.');
    }
  };

  const revert = () => {
    setDraft(null);
    setError(null);
  };

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <p className="max-w-3xl flex-1 text-sm text-muted-foreground">{tab.description}</p>
        {dirty && (
          <Button variant="ghost" size="sm" onClick={revert} className="gap-2">
            <RotateCcw className="size-4" aria-hidden="true" />
            Revert
          </Button>
        )}
        <Button size="sm" onClick={apply} disabled={!dirty}>
          Apply to canvas
        </Button>
      </div>

      <textarea
        value={value}
        spellCheck={false}
        aria-label={`${tab.label} source`}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
            event.preventDefault();
            apply();
          }
        }}
        className={cn(
          codeClass,
          'h-[40vh] resize-none font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          dirty && 'border-primary/40',
        )}
      />

      {error ? (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-destructive">
          <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground/80">
          Edits are applied on demand — press Apply, or {'\u2318'}/Ctrl + Enter.
        </p>
      )}
    </>
  );
}

/**
 * Collapsible drawer showing what an editor actually exports.
 *
 * Editors that can serialize more than one way pass several tabs — the point of
 * these demos is comparing the shape of each export. Read-only output is
 * rendered as escaped text inside a <pre>, never injected as markup.
 */
export function OutputPanel({ title, tabs }: OutputPanelProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [active, setActive] = useState(tabs[0].id);

  const current = tabs.find((tab) => tab.id === active) ?? tabs[0];

  const copy = async () => {
    await navigator.clipboard.writeText(current.content);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const lines = current.content.split('\n').length;

  return (
    <section className="shrink-0 border-t bg-muted/30">
      <Tabs value={current.id} onValueChange={setActive}>
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="gap-2"
          >
            <ChevronDown
              className={cn('size-4 transition-transform', open && 'rotate-180')}
              aria-hidden="true"
            />
            {title}
          </Button>

          {tabs.length > 1 ? (
            <TabsList aria-label="Output format">
              {tabs.map((tab) => (
                <TabsTrigger key={tab.id} value={tab.id} className="px-3">
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          ) : (
            <Badge variant="outline" className="font-mono text-xs uppercase">
              {current.language}
            </Badge>
          )}

          <span className="text-sm text-muted-foreground">
            {lines} {lines === 1 ? 'line' : 'lines'}
          </span>

          {open && (
            <Button variant="outline" size="sm" onClick={copy} className="ml-auto gap-2">
              {copied ? (
                <Check className="size-4" aria-hidden="true" />
              ) : (
                <Copy className="size-4" aria-hidden="true" />
              )}
              {copied ? 'Copied' : 'Copy'}
            </Button>
          )}
        </div>

        {open &&
          tabs.map((tab) => (
            <TabsContent key={tab.id} value={tab.id} className="px-4 pb-4 sm:px-6">
              {tab.onApply ? (
                // Keyed so switching selection or tab starts from a fresh draft
                // rather than resurrecting a stale one.
                <EditableOutput key={tab.id} tab={{ ...tab, onApply: tab.onApply }} />
              ) : (
                <>
                  <p className="mb-3 max-w-3xl text-sm text-muted-foreground">{tab.description}</p>
                  <pre className={cn(codeClass, 'max-h-[40vh]')}>
                    <code>{tab.content}</code>
                  </pre>
                </>
              )}
            </TabsContent>
          ))}
      </Tabs>
    </section>
  );
}
