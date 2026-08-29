/**
 * Serialising fetch bodies for the trip across `postMessage`.
 *
 * Protocol v1 sends base64 strings, which costs an encode on this side, a
 * decode on the other, and 33% more bytes on the wire. v2 hands the frame a
 * `Uint8Array` and lets structured clone copy it. The frame announces which it
 * speaks in `ready`, so both are still reachable.
 */

import { bytesToBase64, utf8ToBase64 } from './base64';
import type { SerialisedBody } from './types';

/**
 * Highest iframe.diy protocol version this app supports.
 * v2 = fetch bodies may be raw binary instead of base64 strings.
 */
export const PROTOCOL_VERSION = 2;

/** Read the version out of a frame's `ready` params, defaulting to v1. */
export function frameVersion(params: unknown): number {
  const version = (params as { version?: unknown } | undefined)?.version;
  return typeof version === 'number' ? version : 1;
}

/**
 * Serialise raw bytes for transport: passed through as-is for v2 frames,
 * base64-encoded for v1 frames (e.g. a stale cached Service Worker).
 */
export function toBody(bytes: Uint8Array, binary: boolean): SerialisedBody {
  if (!binary) return bytesToBase64(bytes);

  // Structured clone copies a view's *entire* underlying buffer, so send a
  // compact copy when the view doesn't span its buffer (e.g. a file inside an
  // unpacked archive).
  return bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength
    ? bytes
    : bytes.slice();
}

/** Serialise a UTF-8 string for transport (see `toBody`). */
export function textToBody(str: string, binary: boolean): SerialisedBody {
  return binary ? new TextEncoder().encode(str) : utf8ToBase64(str);
}
