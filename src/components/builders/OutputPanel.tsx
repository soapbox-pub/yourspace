import { useState } from 'react';
import { Check, ChevronDown, Copy } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface OutputPanelProps {
  title: string;
  description: string;
  language: 'json' | 'html';
  content: string;
}

/**
 * Collapsible drawer showing what an editor actually exports.
 *
 * The output is rendered as escaped text inside a <pre>, never injected as
 * markup — the whole point is to inspect it, not execute it.
 */
export function OutputPanel({ title, description, language, content }: OutputPanelProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const lines = content.split('\n').length;

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

      {open && (
        <div className="px-4 pb-4 sm:px-6">
          <p className="mb-3 max-w-3xl text-sm text-muted-foreground">{description}</p>
          <pre className="max-h-[40vh] overflow-auto rounded-lg border bg-background p-4 text-xs leading-relaxed">
            <code>{content}</code>
          </pre>
        </div>
      )}
    </section>
  );
}
