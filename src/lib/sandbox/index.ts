export { bytesToBase64, utf8ToBase64 } from './base64';
export { frameVersion, PROTOCOL_VERSION, textToBody, toBody } from './body';
export { injectScriptTags } from './htmlInjector';
export { getMimeType } from './mimeTypes';
export type {
  FileResponse,
  InjectedScript,
  JsonRpcResponse,
  SerialisedBody,
  SerialisedRequest,
} from './types';
