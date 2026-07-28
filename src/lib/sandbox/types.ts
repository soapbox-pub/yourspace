/**
 * The JSON-RPC 2.0 dialect iframe.diy speaks over `postMessage`, plus the
 * shapes this app exchanges with it.
 */

export interface JsonRpcSuccessResponse {
  jsonrpc: '2.0';
  id: string | number;
  result: unknown;
}

export interface JsonRpcErrorResponse {
  jsonrpc: '2.0';
  id: string | number;
  error: { code: number; message: string };
}

export type JsonRpcResponse = JsonRpcSuccessResponse | JsonRpcErrorResponse;

/** A request the sandbox wants the parent to perform on its behalf. */
export interface SerialisedRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | null;
}

/** The result of resolving one path inside the sandbox. */
export interface FileResponse {
  status: number;
  contentType: string;
  body: Uint8Array;
}

/**
 * A script the frame serves at a virtual path and injects into every HTML
 * response. Used to fix up the sandbox's environment before the site boots.
 */
export interface InjectedScript {
  /** Virtual path, without a leading slash (e.g. `__injected__/preview.js`). */
  path: string;
  content: string;
}
