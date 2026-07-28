/**
 * The `window.napplet` namespace, as source injected into the sandboxed frame.
 *
 * This is the only code the runtime adds inside a napplet, and NIP-5D is strict
 * about it: it must be installed before any napplet script runs, it must be
 * limited to the namespace, and it must sit outside the bytes the napplet's
 * content address is computed over. So it is injected at the top of `<head>`,
 * after the CSP, and never mixed into the verified blob.
 *
 * The granted domains are baked in as a literal rather than learned from
 * `shell.init`, because NIP-5D makes the *presence* of a domain object the
 * availability signal — a napplet that checks `window.napplet.relay` on its
 * first line must get the right answer, and an answer that arrives a round trip
 * later would be no answer at all. The handshake still happens; it confirms
 * what was injected rather than being the only way to learn it.
 *
 * Written as ES5 in a plain string: it runs from the verified document under a
 * CSP allowing only inline script, and has no build step of its own.
 */

/**
 * `</script>` anywhere in here would close the tag it is serialized into. The
 * source below contains none, and this makes that true rather than assumed.
 */
function neutralize(source: string): string {
  return source.replace(/<\/script/gi, '<\\/script');
}

const SHIM = `(function () {
  'use strict';

  var host = window.parent;
  var pending = Object.create(null);
  var subs = Object.create(null);
  var counter = 0;
  var granted = __DOMAINS__;
  var services = __SERVICES__;
  var environment = null;
  var readyWaiters = [];
  var themeWaiters = [];

  function nextId() {
    counter += 1;
    return 'n' + counter;
  }

  function post(message) {
    try {
      host.postMessage(message, '*');
    } catch (err) {
      /* The host went away; every pending call will simply never settle. */
    }
  }

  function request(type, payload) {
    return new Promise(function (resolve, reject) {
      var id = nextId();
      pending[id] = { resolve: resolve, reject: reject };
      var message = { type: type, id: id };
      if (payload) {
        for (var key in payload) {
          if (Object.prototype.hasOwnProperty.call(payload, key)) message[key] = payload[key];
        }
      }
      post(message);
    });
  }

  function settle(id, error, value) {
    var slot = pending[id];
    if (!slot) return;
    delete pending[id];
    if (error) slot.reject(new Error(String(error)));
    else slot.resolve(value);
  }

  function has(domain) {
    for (var i = 0; i < granted.length; i++) {
      if (granted[i] === domain) return true;
    }
    return false;
  }

  /* ---- shell (NAP-SHELL) ---------------------------------------------- */

  var shell = {
    supports: has,
    services: services,
    ready: function () {
      if (environment) return Promise.resolve(environment);
      return new Promise(function (resolve) {
        readyWaiters.push(resolve);
      });
    },
    onReady: function (handler) {
      if (environment) {
        handler(environment);
        return { close: function () {} };
      }
      var live = true;
      readyWaiters.push(function (env) {
        if (live) handler(env);
      });
      return {
        close: function () {
          live = false;
        },
      };
    },
  };

  /* ---- relay (NAP-RELAY) ----------------------------------------------- */

  function subscribe(filters, options) {
    var subId = 's' + nextId();
    var opts = options || {};
    var handlers = {
      event: opts.onEvent ? [opts.onEvent] : [],
      eose: opts.onEose ? [opts.onEose] : [],
      closed: opts.onClosed ? [opts.onClosed] : [],
    };
    subs[subId] = handlers;

    post({
      type: 'relay.subscribe',
      id: nextId(),
      subId: subId,
      filters: [].concat(filters),
      relay: opts.relay,
    });

    return {
      subId: subId,
      on: function (name, handler) {
        if (handlers[name]) handlers[name].push(handler);
        return this;
      },
      close: function () {
        if (!subs[subId]) return;
        delete subs[subId];
        post({ type: 'relay.close', id: nextId(), subId: subId });
      },
    };
  }

  var relay = {
    subscribe: subscribe,
    query: function (filters) {
      return request('relay.query', { filters: [].concat(filters) });
    },
    publish: function (template) {
      return request('relay.publish', { event: template });
    },
    publishEncrypted: function (template, recipient, encryption) {
      return request('relay.publishEncrypted', {
        event: template,
        recipient: recipient,
        encryption: encryption,
      });
    },
  };

  /* ---- storage (NAP-STORAGE) ------------------------------------------- */

  function storageApi(scope) {
    return {
      getItem: function (key) {
        return request('storage.get', { key: String(key), scope: scope });
      },
      setItem: function (key, value) {
        return request('storage.set', { key: String(key), value: String(value), scope: scope });
      },
      removeItem: function (key) {
        return request('storage.remove', { key: String(key), scope: scope });
      },
      keys: function () {
        return request('storage.keys', { scope: scope });
      },
    };
  }

  var storage = storageApi('shared');
  storage.instance = storageApi('instance');

  /* ---- theme (NAP-THEME) ----------------------------------------------- */

  var theme = {
    get: function () {
      return request('theme.get', {});
    },
    onChanged: function (handler) {
      themeWaiters.push(handler);
      return {
        close: function () {
          var index = themeWaiters.indexOf(handler);
          if (index >= 0) themeWaiters.splice(index, 1);
        },
      };
    },
  };

  /* ---- namespace -------------------------------------------------------- */

  var domains = { shell: shell, relay: relay, storage: storage, theme: theme };
  var namespace = {};

  /*
   * Only what was granted. NIP-5D makes presence the availability signal, so a
   * domain the host does not serve must be absent rather than present and
   * failing.
   */
  namespace.shell = shell;
  for (var i = 0; i < granted.length; i++) {
    if (domains[granted[i]]) namespace[granted[i]] = domains[granted[i]];
  }

  Object.defineProperty(window, 'napplet', {
    value: namespace,
    writable: false,
    configurable: false,
  });

  /* ---- transport -------------------------------------------------------- */

  window.addEventListener('message', function (event) {
    /*
     * Only the host that created this frame. A napplet has an opaque origin, so
     * 'event.origin' is 'null' and useless for this; the Window reference is
     * not forgeable and is what NIP-5D says to compare.
     */
    if (event.source !== host) return;

    var message = event.data;
    if (!message || typeof message !== 'object' || typeof message.type !== 'string') return;

    switch (message.type) {
      case 'shell.init':
        if (environment) return;
        environment = { capabilities: message.capabilities, services: message.services || [] };
        if (message.capabilities && message.capabilities.domains) {
          granted = message.capabilities.domains;
        }
        services = environment.services;
        shell.services = services;
        var waiters = readyWaiters;
        readyWaiters = [];
        for (var w = 0; w < waiters.length; w++) waiters[w](environment);
        return;

      case 'relay.event': {
        var sub = subs[message.subId];
        if (sub) for (var e = 0; e < sub.event.length; e++) sub.event[e](message.result);
        return;
      }

      case 'relay.eose': {
        var eosed = subs[message.subId];
        if (eosed) for (var o = 0; o < eosed.eose.length; o++) eosed.eose[o]();
        return;
      }

      case 'relay.closed': {
        var closed = subs[message.subId];
        if (closed) {
          delete subs[message.subId];
          for (var c = 0; c < closed.closed.length; c++) closed.closed[c](message.reason);
        }
        return;
      }

      case 'theme.changed':
        for (var t = 0; t < themeWaiters.length; t++) themeWaiters[t](message.theme);
        return;

      case 'relay.query.result':
        settle(message.id, message.error, message.events || []);
        return;

      case 'relay.publish.result':
      case 'relay.publishEncrypted.result':
        settle(message.id, message.ok ? null : message.error || 'Publishing was refused.', message.event);
        return;

      case 'storage.get.result':
        settle(message.id, message.error, message.value === undefined ? null : message.value);
        return;

      case 'storage.set.result':
      case 'storage.remove.result':
        settle(message.id, message.error, undefined);
        return;

      case 'storage.keys.result':
        settle(message.id, message.error, message.keys || []);
        return;

      case 'theme.get.result':
        settle(message.id, message.error, message.theme);
        return;

      default:
        /* Unrecognized types are ignored, which is what keeps this forward
         * compatible as new NAPs are defined. */
        return;
    }
  });

  /* The liveness signal. Carries nothing: identity is the host's to assign. */
  post({ type: 'shell.ready' });
})();`;

/**
 * The shim, with the domains this napplet was granted baked in.
 *
 * `services` is NAP-SHELL's list of named services; this runtime exposes none,
 * so it is always empty — but the field is part of the environment a napplet is
 * entitled to read, so it is delivered rather than omitted.
 */
export function guestShim(domains: string[], services: string[] = []): string {
  return neutralize(
    SHIM.replace('__DOMAINS__', JSON.stringify(domains)).replace(
      '__SERVICES__',
      JSON.stringify(services),
    ),
  );
}
