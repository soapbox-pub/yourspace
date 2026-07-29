import type { CSSProperties } from 'react';

/**
 * What an archive GIF is shown against.
 *
 * Transparency is everywhere in this archive, and a flat panel hides every GIF
 * drawn in white. The checkerboard stays light in both themes, because these
 * were made for light pages and are much more often dark-on-transparent.
 *
 * Shared by the GIF picker and the cursor picker, which are looking through the
 * same shoebox.
 */
export const CHECKERBOARD: CSSProperties = {
  backgroundColor: '#fff',
  backgroundImage:
    'linear-gradient(45deg,#e2e8f0 25%,transparent 25%,transparent 75%,#e2e8f0 75%),' +
    'linear-gradient(45deg,#e2e8f0 25%,transparent 25%,transparent 75%,#e2e8f0 75%)',
  backgroundSize: '12px 12px',
  backgroundPosition: '0 0, 6px 6px',
};
