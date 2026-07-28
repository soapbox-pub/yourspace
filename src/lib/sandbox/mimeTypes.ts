/**
 * MIME lookup for files served through the sandbox frame.
 *
 * Blossom is content-addressed and routinely reports the wrong type (a `.js`
 * blob comes back as `text/plain`, which browsers refuse to execute as a
 * module), so the manifest path — not the server — decides the type.
 */
const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.htm': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.bmp': 'image/bmp',
  '.avif': 'image/avif',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.opus': 'audio/opus',
  '.weba': 'audio/webm',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.xml': 'application/xml',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.wasm': 'application/wasm',
  '.pdf': 'application/pdf',
  '.toml': 'application/toml',
};

/** Guess a MIME type from a path, falling back to `application/octet-stream`. */
export function getMimeType(path: string): string {
  const dot = path.lastIndexOf('.');
  if (dot === -1) return 'application/octet-stream';
  return MIME_TYPES[path.slice(dot).toLowerCase()] ?? 'application/octet-stream';
}
