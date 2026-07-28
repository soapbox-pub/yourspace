import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { NostrEvent } from '@nostrify/nostrify';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, ArrowUpRight, CheckCircle2, Loader2, Upload } from 'lucide-react';

import { LoginArea } from '@/components/auth/LoginArea';
import { useAuthor } from '@/hooks/useAuthor';
import { useNip05Verified } from '@/hooks/useNip05';
import { getProfileUrl } from '@/lib/userParam';
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
import { useAppContext } from '@/hooks/useAppContext';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { getEffectiveBlossomServers } from '@/lib/appBlossom';
import { formatBytes, pagesOf, type NsiteFile } from '@/lib/nsite/files';
import { ROOT_SITE_KIND } from '@/lib/nsite/manifest';
import {
  entryPage,
  manifestTags,
  suggestedTitle,
  uploadSite,
  type FailedUpload,
  type PublishProgress,
} from '@/lib/nsite/publish';

interface PublishNsiteDialogProps {
  /** The site as it would ship — serializes the canvas before handing it over. */
  getFiles: () => NsiteFile[];
  /** Disabled until the editor exists to be serialized. */
  disabled?: boolean;
}

/**
 * Deploys the site on the canvas as the signed-in key's root nsite.
 *
 * The root site (kind 15128) rather than a named one, because a key has exactly
 * one and it is what an npub resolves to — this is the homepage, not a
 * subdirectory. Publishing again replaces it, which is what makes the button
 * usable a second time.
 *
 * The files are snapshotted when the dialog opens rather than read at submit,
 * so what the summary counts is what gets uploaded.
 */
export function PublishNsiteDialog({ getFiles, disabled }: PublishNsiteDialogProps) {
  const { user } = useCurrentUser();
  const { config } = useAppContext();
  const { mutateAsync: createEvent } = useNostrPublish();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<NsiteFile[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [progress, setProgress] = useState<PublishProgress | null>(null);
  const abortRef = useRef<AbortController>(null);

  const publish = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('You must be signed in to publish.');

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setProgress(null);

      const upload = await uploadSite(files, {
        signer: user.signer,
        servers: getEffectiveBlossomServers(
          config.blossomServerMetadata,
          config.useAppBlossomServers,
        ),
        signal: controller.signal,
        onProgress: setProgress,
      });

      // A manifest listing nothing is a site that can't be opened, and it would
      // replace the one already published. Better to fail with the reason.
      if (!upload.entries.length) {
        throw new Error(
          upload.failed[0]?.reason ?? 'No file reached a Blossom server, so there is nothing to publish.',
        );
      }

      const event = await createEvent({
        kind: ROOT_SITE_KIND,
        content: '',
        tags: manifestTags(upload, { title, description }),
      });

      return { event, failed: upload.failed };
    },
    onSuccess: ({ event }) => {
      // The showcase and anyone's view of this key's site are both a manifest
      // older than the one just signed.
      queryClient.invalidateQueries({ queryKey: ['nsite-feed'] });
      queryClient.invalidateQueries({ queryKey: ['nsite', ROOT_SITE_KIND, event.pubkey, ''] });
    },
  });

  /*
   * Closing abandons the run: the in-flight uploads are stopped rather than
   * left pushing megabytes at someone's Blossom server, and the outcome is
   * cleared so reopening doesn't start on the last deployment's report.
   */
  const toggle = (next: boolean) => {
    setOpen(next);

    if (next) {
      const snapshot = getFiles();
      setFiles(snapshot);
      setTitle((current) => current || suggestedTitle(snapshot));
    } else {
      abortRef.current?.abort();
      publish.reset();
      setProgress(null);
    }
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!publish.isPending && !publish.data) publish.mutate();
  };

  const pages = pagesOf(files);
  const bytes = files.reduce((total, file) => total + file.size, 0);
  const hasIndex = entryPage(files)?.path === '/index.html';
  const result = publish.data;

  return (
    <Dialog open={open} onOpenChange={toggle}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2" disabled={disabled}>
          <Upload className="size-4" aria-hidden="true" />
          Publish
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        {/*
          `DialogContent` is a grid, so this form is a grid item and defaults to
          `min-width: auto` — it refuses to be narrower than its widest
          unbreakable content, and takes the column, the footer and the buttons
          out past the dialog's edge with it. A published site's address is
          exactly that kind of content.
        */}
        <form onSubmit={submit} className="min-w-0">
          <DialogHeader>
            <DialogTitle>{result ? 'Your site is live' : 'Publish your site'}</DialogTitle>
            <DialogDescription>
              {result
                ? 'The manifest is signed and out on your relays. Publishing again replaces it.'
                : 'Uploads every file to your Blossom servers, then signs one manifest mapping each path to its hash. This becomes the site your npub resolves to.'}
            </DialogDescription>
          </DialogHeader>

          {!user ? (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <p className="max-w-xs text-sm text-muted-foreground">
                A site is signed by the key that owns it, so publishing needs an account.
              </p>
              <LoginArea className="max-w-60" />
            </div>
          ) : result ? (
            <PublishedSite event={result.event} failed={result.failed} />
          ) : (
            <div className="space-y-4 py-6">
              <div className="space-y-2">
                <Label htmlFor="nsite-title">Title</Label>
                <Input
                  id="nsite-title"
                  value={title}
                  autoFocus
                  maxLength={120}
                  placeholder="My corner of the internet"
                  onChange={(event) => setTitle(event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="nsite-description">
                  Description <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="nsite-description"
                  value={description}
                  maxLength={280}
                  placeholder="What people will find here"
                  onChange={(event) => setDescription(event.target.value)}
                />
              </div>

              <dl className="flex items-center gap-4 rounded-lg border bg-muted/40 px-4 py-3 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Pages</dt>
                  <dd className="font-medium tabular-nums">{pages.length}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Files</dt>
                  <dd className="font-medium tabular-nums">{files.length}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Size</dt>
                  <dd className="font-medium tabular-nums">{formatBytes(bytes)}</dd>
                </div>
              </dl>

              {!hasIndex && (
                <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden="true" />
                  There's no <code className="font-mono">/index.html</code>, so visitors landing on
                  the site root will have nothing to open.
                </p>
              )}

              {publish.isPending && (
                <div>
                  <Progress
                    value={progress?.total ? (progress.loaded / progress.total) * 100 : 0}
                  />
                  <p className="pt-1.5 text-xs text-muted-foreground">
                    {!progress
                      ? 'Reading the files…'
                      : progress.loaded < progress.total
                        ? `Uploading ${progress.loaded} of ${progress.total} files — your signer will ask to authorize each one that isn't already stored.`
                        : 'Signing the manifest…'}
                  </p>
                </div>
              )}

              {publish.error && (
                <p className="flex items-start gap-1.5 text-xs text-destructive">
                  <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden="true" />
                  {publish.error.message}
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            {result ? (
              <Button type="button" variant="outline" onClick={() => toggle(false)}>
                Done
              </Button>
            ) : (
              <Button type="submit" disabled={!user || !files.length || publish.isPending} className="gap-2">
                {publish.isPending && (
                  <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden="true" />
                )}
                Publish
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface PublishedSiteProps {
  event: NostrEvent;
  failed: FailedUpload[];
}

/** Where the site can now be reached, and anything that didn't make it. */
function PublishedSite({ event, failed }: PublishedSiteProps) {
  const author = useAuthor(event.pubkey);
  const metadata = author.data?.metadata;

  /*
   * A verified NIP-05 makes a far better address than an npub, but only once
   * verified — the name lives in a kind 0, and an unverified one would point
   * this link at whoever actually holds the name.
   */
  const verified = useNip05Verified(event.pubkey, metadata?.nip05);
  const path = getProfileUrl(event.pubkey, metadata, verified);

  return (
    <div className="space-y-4 py-6">
      <div className="flex items-start gap-3 rounded-lg border bg-muted/40 px-4 py-3">
        <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" aria-hidden="true" />
        {/*
          `break-all` on the address because an npub is one unbreakable
          63-character token. It also drops the min-content width to a single
          character: the dialog is a grid, and a child that refuses to be
          narrower than its text widens the whole column past the dialog.
        */}
        <Link to={path} className="group min-w-0">
          <span className="block font-medium underline-offset-4 group-hover:underline">
            View your site
            <ArrowUpRight className="ml-1 inline size-3.5 align-text-bottom" aria-hidden="true" />
          </span>
          <span className="mt-0.5 block break-all font-mono text-xs text-muted-foreground">
            {path}
          </span>
        </Link>
      </div>

      {failed.length > 0 && (
        <div className="space-y-1.5">
          <p className="flex items-start gap-1.5 text-xs text-destructive">
            <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden="true" />
            {failed.length} {failed.length === 1 ? 'file' : 'files'} were left out because no server
            would store them.
          </p>
          <ul className="space-y-0.5 pl-5 text-xs text-muted-foreground">
            {failed.slice(0, 5).map(({ path, reason }) => (
              <li key={path} className="truncate">
                <span className="font-mono">{path}</span> — {reason}
              </li>
            ))}
            {failed.length > 5 && <li>and {failed.length - 5} more</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
