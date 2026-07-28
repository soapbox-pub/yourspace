/**
 * Every byte of every file served into a sandbox frame passes through here, on
 * the main thread, because `postMessage` to the frame carries JSON. It is worth
 * more than the obvious loop.
 */

/**
 * Bytes per `String.fromCharCode` call. The spread has to fit in the argument
 * list, and engines start to complain well below their documented limits.
 */
const CHUNK = 0x2000;

/** `Uint8Array.prototype.toBase64`, where the engine has it. */
interface Base64Encodable {
  toBase64(): string;
}

export function bytesToBase64(bytes: Uint8Array): string {
  const native = bytes as Uint8Array & Partial<Base64Encodable>;
  if (typeof native.toBase64 === 'function') return native.toBase64();

  // A character at a time is the version everyone writes first, and it makes a
  // megabyte of markup measurably slow; a single spread over the whole array
  // overflows the argument list. Chunks are the middle.
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }

  return btoa(binary);
}

/** Encode a UTF-8 string to base64. */
export function utf8ToBase64(str: string): string {
  return bytesToBase64(new TextEncoder().encode(str));
}
