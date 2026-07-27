import { useState } from 'react';
import { Check, ChevronDown, Copy } from 'lucide-react';

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
}

interface OutputPanelProps {
  title: string;
  tabs: OutputTab[];
}

/**
 * Collapsible drawer showing what an editor actually exports.
 *
 * Editors that can serialize more than one way pass several tabs — the point of
 * these demos is comparing the shape of each export. The output is rendered as
 * escaped text inside a <pre>, never injected as markup.
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
              <p className="mb-3 max-w-3xl text-sm text-muted-foreground">{tab.description}</p>
              <pre className="max-h-[40vh] overflow-auto rounded-lg border bg-background p-4 text-xs leading-relaxed">
                <code>{tab.content}</code>
              </pre>
            </TabsContent>
          ))}
      </Tabs>
    </section>
  );
}
