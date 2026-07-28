import { useState } from 'react';
import { AlertCircle, Check, ChevronDown, Copy, RotateCcw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface OutputPanelProps {
  title: string;
  language: 'json' | 'html';
  content: string;
  /**
   * When set, the panel becomes a two-way editor: the content is editable and
   * gains Apply / Revert controls. Throwing from here surfaces the message
   * inline rather than losing the user's draft.
   */
  onApply?: (value: string) => void;
}

const codeClass = 'w-full overflow-auto rounded-lg border bg-background p-4 text-xs leading-relaxed';

/**
 * An editable serialization.
 *
 * The editor keeps re-serializing while this is open, so incoming content is
 * adopted only while the draft is clean — otherwise every canvas change would
 * overwrite what the user is typing.
 */
function EditableOutput({
  content,
  label,
  onApply,
}: {
  content: string;
  label: string;
  onApply: (value: string) => void;
}) {
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
      <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
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
        aria-label={`${label} source`}
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

      {error && (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-destructive">
          <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </>
  );
}

/**
 * Collapsible drawer showing what the editor actually exports.
 *
 * Read-only output is rendered as escaped text inside a <pre>, never injected
 * as markup.
 */
export function OutputPanel({ title, language, content, onApply }: OutputPanelProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="shrink-0 border-t bg-muted/30">
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

        <Badge variant="outline" className="font-mono text-xs uppercase">
          {language}
        </Badge>

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

      {open && (
        <div className="px-4 pb-4 sm:px-6">
          {onApply ? (
            <EditableOutput content={content} label={language} onApply={onApply} />
          ) : (
            <pre className={cn(codeClass, 'max-h-[40vh]')}>
              <code>{content}</code>
            </pre>
          )}
        </div>
      )}
    </section>
  );
}
