import type { Editor } from 'grapesjs';
import { FileCode2, FileText, Type } from 'lucide-react';

import { extensionOf, formatBytes, isImageFile, type NsiteFile } from '@/lib/nsite/files';

interface AssetListProps {
  editor: Editor | null;
  assets: NsiteFile[];
}

/** Enough of a hint to tell a stylesheet from a font at a glance. */
function iconFor(file: NsiteFile) {
  if (file.type.startsWith('font/')) return Type;
  if (/^(text|application)\//.test(file.type)) return FileCode2;
  return FileText;
}

/**
 * Every file in the site that isn't a page.
 *
 * There is no such category in NIP-5A — a manifest has one kind of entry — so
 * this is the display half of the pages/assets split, listing exactly the files
 * the page dropdown leaves out. Images can be placed on the canvas; the rest
 * are here to be accounted for, since they still ship with the site.
 */
export function AssetList({ editor, assets }: AssetListProps) {
  if (!assets.length) return null;

  const place = (file: NsiteFile) => {
    if (!editor || !file.url) return;

    // Next to whatever is selected, so placement follows the user's attention
    // rather than always landing at the bottom of the page.
    const selected = editor.getSelected();
    const target = selected?.parent() ?? editor.getWrapper();
    target?.append(`<img src="${file.url}" alt="" style="max-width:100%;display:block;"/>`);
  };

  return (
    <ul className="space-y-0.5">
      {assets.map((file) => {
        const image = isImageFile(file);
        const Icon = iconFor(file);

        return (
          <li key={file.path}>
            <button
              type="button"
              onClick={() => place(file)}
              disabled={!image}
              title={file.path}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none"
            >
              {image && file.url ? (
                <img
                  src={file.url}
                  alt=""
                  className="size-6 shrink-0 rounded border bg-background object-cover"
                />
              ) : (
                <span className="flex size-6 shrink-0 items-center justify-center rounded border bg-background">
                  <Icon className="size-3 text-muted-foreground" aria-hidden="true" />
                </span>
              )}

              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs text-foreground">
                  {file.path.split('/').pop()}
                </span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {extensionOf(file.path) || 'file'} · {formatBytes(file.size)}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
