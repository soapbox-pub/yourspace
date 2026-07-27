import { useState } from 'react';
import { AlertCircle, Check, ChevronDown, FileText, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { normalizePagePath, pageLabel, type NsiteFile } from '@/lib/nsite/files';
import { cn } from '@/lib/utils';

interface PageSwitcherProps {
  pages: NsiteFile[];
  activePath: string;
  onSelect: (path: string) => void;
  onCreate: (path: string) => void;
  disabled?: boolean;
}

/**
 * Which of the site's HTML files the canvas is showing.
 *
 * A site with one page still gets the control, because it is also where new
 * pages come from — and because "this editor holds a site, not a document" is
 * the thing worth making visible.
 */
export function PageSwitcher({
  pages,
  activePath,
  onSelect,
  onCreate,
  disabled,
}: PageSwitcherProps) {
  const [creating, setCreating] = useState(false);
  const [path, setPath] = useState('');
  const [error, setError] = useState<string | null>(null);

  const openCreate = () => {
    setPath('');
    setError(null);
    setCreating(true);
  };

  const create = (event: React.FormEvent) => {
    event.preventDefault();

    try {
      const normalized = normalizePagePath(path);
      if (pages.some((page) => page.path === normalized)) {
        throw new Error(`${normalized} already exists.`);
      }
      onCreate(normalized);
      setCreating(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'That path cannot be used.');
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2" disabled={disabled}>
            <FileText className="size-4 text-muted-foreground" aria-hidden="true" />
            <span className="max-w-40 truncate font-mono text-xs">{pageLabel(activePath)}</span>
            <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
            {pages.length} {pages.length === 1 ? 'page' : 'pages'}
          </DropdownMenuLabel>

          {pages.map((page) => (
            <DropdownMenuItem
              key={page.path}
              onSelect={() => onSelect(page.path)}
              className="gap-2 font-mono text-xs"
            >
              <Check
                className={cn('size-3.5 shrink-0', page.path !== activePath && 'invisible')}
                aria-hidden="true"
              />
              <span className="truncate">{pageLabel(page.path)}</span>
            </DropdownMenuItem>
          ))}

          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={openCreate} className="gap-2">
            <Plus className="size-3.5" aria-hidden="true" />
            New page…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={create}>
            <DialogHeader>
              <DialogTitle>New page</DialogTitle>
              <DialogDescription>
                The path this page will be published at. A host server serves{' '}
                <code className="font-mono">/about/</code> from{' '}
                <code className="font-mono">/about/index.html</code>.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2 py-6">
              <Label htmlFor="new-page-path">Path</Label>
              <Input
                id="new-page-path"
                value={path}
                autoFocus
                spellCheck={false}
                autoComplete="off"
                placeholder="/about/"
                onChange={(event) => {
                  setPath(event.target.value);
                  setError(null);
                }}
                aria-invalid={Boolean(error)}
                className="font-mono text-sm"
              />
              {error && (
                <p className="flex items-start gap-1.5 text-xs text-destructive">
                  <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden="true" />
                  {error}
                </p>
              )}
            </div>

            <DialogFooter>
              <Button type="submit" disabled={!path.trim()}>
                Create
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
