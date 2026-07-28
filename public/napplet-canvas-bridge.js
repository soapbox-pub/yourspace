/**
 * Relays napplet messages from the app into the editor canvas.
 *
 * `postMessage` stamps `event.source` with the *incumbent* window — the realm
 * of the script that made the call, not the window whose method was called. The
 * app's own code runs in the app window, but a napplet frame in the editor lives
 * inside the GrapesJS canvas document, so its `window.parent` is the canvas
 * window. A message sent straight from app code therefore arrives at the frame
 * with a `source` that is not its parent, and iframe.diy drops it: the frame
 * goes on asking `ready` forever and never clears its spinner.
 *
 * This file exists to be loaded *into* the canvas document, so that the
 * `postMessage` below is made by a script belonging to the canvas realm. Then
 * `source` is the frame's real parent and the handshake completes.
 *
 * It is a static file rather than part of the bundle because the canvas
 * inherits the app's Content Security Policy, and `script-src 'self'` admits a
 * same-origin script while forbidding an inline one.
 *
 * Only outbound messages need this. Messages from a frame already arrive at the
 * canvas window, where the runtime is listening.
 */
(function () {
  'use strict';

  if (window.__nappletBridgeInstalled) return;
  window.__nappletBridgeInstalled = true;

  window.addEventListener('message', function (event) {
    // Only from the window this document is embedded in — the app.
    if (event.source !== window.parent) return;

    var data = event.data;
    if (!data || data.__napplet !== 'send' || typeof data.frameId !== 'string') return;

    var selector = 'iframe[data-napplet-frame="' + CSS.escape(data.frameId) + '"]';
    var frame = document.querySelector(selector);
    if (!frame || !frame.contentWindow) return;

    // The call that matters: made here, so the frame sees its own parent.
    frame.contentWindow.postMessage(data.message, data.targetOrigin || '*');
  });
})();
