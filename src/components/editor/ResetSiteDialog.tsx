import { RotateCcw } from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

interface ResetSiteDialogProps {
  onReset: () => void;
  /** Disabled until the editor exists, and while it is holding for a site. */
  disabled?: boolean;
}

/**
 * Throws away what the editor is holding and starts over from the layouts.
 *
 * Confirmed rather than undoable: reset clears the undo history along with
 * everything else, so there is nothing left to take it back with.
 *
 * The published site is deliberately left alone. Nothing here has touched a
 * relay, and reading "reset" as "unpublish" would mean an editor action
 * silently taking down a live site — so what this offers is a blank canvas, and
 * publishing is still the only thing that changes what other people see.
 */
export function ResetSiteDialog({ onReset, disabled }: ResetSiteDialogProps) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2" disabled={disabled}>
          <RotateCcw className="size-4" aria-hidden="true" />
          Reset
        </Button>
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reset this site?</AlertDialogTitle>
          <AlertDialogDescription>
            Every page, image and font in the editor is discarded, and you start again from the
            layouts. This cannot be undone. Anything you have already published stays up until you
            publish something over it.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onReset}>
            Reset site
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
