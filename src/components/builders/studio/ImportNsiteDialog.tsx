import { useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { AlertCircle, Download, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { fetchNsite, type NsiteImport, type NsiteImportProgress } from '@/lib/nsite/fetchNsite';
import { parseNsiteRef } from '@/lib/nsite/manifest';

/** The site the NIP-5A draft is written against — a real, complete nsite. */
const EXAMPLE = 'npub1ye5ptcxfyyxl5vjvdjar2ua3f0hynkjzpx552mu5snj3qmx5pzjscpknpr';

interface ImportNsiteDialogProps {
  onImport: (result: NsiteImport) => void;
  /** Disabled until the editor exists to receive the pages. */
  disabled?: boolean;
}

/**
 * Loads a published nsite into the editor.
 *
 * The two identifier types answer different questions. An npub names a person,
 * so it resolves to their root site — the single kind 15128 a pubkey may have.
 * An naddr names one addressable event, so it resolves to exactly that named
 * site, kind 35128 with its `d` tag.
 */
export function ImportNsiteDialog({ onImport, disabled }: ImportNsiteDialogProps) {
  const { nostr } = useNostr();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [progress, setProgress] = useState<NsiteImportProgress | null>(null);
  const abortRef = useRef<AbortController>(null);

  const importSite = useMutation({
    mutationFn: async (input: string) => {
      // Parsing first means a typo fails instantly with a specific message
      // instead of after an eight second relay timeout.
      const ref = parseNsiteRef(input);

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setProgress(null);
      return fetchNsite(nostr, ref, { signal: controller.signal, onProgress: setProgress });
    },
    onSuccess: (result) => {
      onImport(result);
      setOpen(false);
    },
  });

  // Closing means abandoning: stop the in-flight fetches rather than leaving a
  // dozen requests running against someone's Blossom server, and clear the
  // error so reopening doesn't start on a stale complaint.
  const toggle = (next: boolean) => {
    setOpen(next);
    if (!next) {
      abortRef.current?.abort();
      importSite.reset();
      setProgress(null);
    }
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!importSite.isPending) importSite.mutate(value);
  };

  const error = importSite.error;

  return (
    <Dialog open={open} onOpenChange={toggle}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2" disabled={disabled}>
          <Download className="size-4" aria-hidden="true" />
          Import nsite
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Import an nsite</DialogTitle>
            <DialogDescription>
              Fetches the NIP-5A manifest, then every file it lists from Blossom. Each blob is
              checked against the hash the author signed before it is used.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-6">
            <Label htmlFor="nsite-identifier">npub or naddr</Label>
            <Input
              id="nsite-identifier"
              value={value}
              autoFocus
              spellCheck={false}
              autoComplete="off"
              placeholder="npub1… or naddr1…"
              onChange={(event) => setValue(event.target.value)}
              aria-invalid={Boolean(error)}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              An npub loads that key’s root site. An naddr loads one named site.{' '}
              <button
                type="button"
                onClick={() => setValue(EXAMPLE)}
                className="underline underline-offset-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Try an example
              </button>
              .
            </p>

            {importSite.isPending && (
              <div className="pt-2">
                <Progress
                  value={progress && progress.total ? (progress.loaded / progress.total) * 100 : 0}
                />
                <p className="pt-1.5 text-xs text-muted-foreground">
                  {progress
                    ? `${progress.loaded} of ${progress.total} files`
                    : 'Looking for the manifest…'}
                </p>
              </div>
            )}

            {error && (
              <p className="flex items-start gap-1.5 pt-1 text-xs text-destructive">
                <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden="true" />
                {error instanceof Error ? error.message : 'Could not import that site.'}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button type="submit" disabled={!value.trim() || importSite.isPending} className="gap-2">
              {importSite.isPending && (
                <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden="true" />
              )}
              Import
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
