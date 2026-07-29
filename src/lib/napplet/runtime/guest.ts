/**
 * The `window.napplet` namespace, as source injected into the sandboxed frame.
 *
 * This is the only code the runtime adds inside a napplet, and NIP-5D is strict
 * about it: it must be installed before any napplet script runs, it must be
 * limited to the namespace, and it must sit outside the bytes the napplet's
 * content address is computed over. So it is served at a path of its own and
 * linked from the top of `<head>`, never mixed into the verified blob.
 *
 * The granted domains are baked in as a literal rather than learned from
 * `shell.init`, because NIP-5D makes the *presence* of a domain object the
 * availability signal — a napplet that checks `window.napplet.relay` on its
 * first line must get the right answer, and an answer that arrives a round trip
 * later would be no answer at all. The handshake still happens; it confirms
 * what was injected rather than being the only way to learn it.
 *
 * More than a transport, too. Several NAPs put obligations on the
 * *runtime-provided binding* specifically — NAP-INC's convention URI
 * transposition, its retention of unclaimed channel handles and of the terminal
 * closed record — and those live here, on the napplet's side of the wire, not
 * in the shell.
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
  var intentWaiters = [];
  var identityWaiters = [];
  var incHandlers = Object.create(null);
  var channels = Object.create(null);
  var openedHandlers = [];
  var pendingOpened = [];

  /* Enough for a burst while a napplet boots; bounded, because NAP-INC says an
   * unclaimed buffer may be bounded but never silently dropped. */
  var MAX_CHANNEL_BUFFER = 64;

  function nextId() {
    counter += 1;
    return 'n' + counter;
  }

  /*
   * NAP messages travel wrapped in a JSON-RPC envelope, because the frame
   * between this document and the shell relays nothing else — it drops any
   * message whose 'jsonrpc' is not '2.0', and relays upward only requests that
   * carry an 'id'. So even a fire-and-forget NAP message is sent as a request;
   * the reply is a bare acknowledgement, and real results arrive as pushes
   * correlated by the NAP-level 'id' inside 'params'.
   */
  var wire = 0;

  function post(message) {
    wire += 1;
    try {
      host.postMessage(
        { jsonrpc: '2.0', id: 'nap-' + wire, method: 'napplet', params: message },
        location.origin,
      );
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

  /* Handlers are called from a copy, so one that unsubscribes mid-delivery
   * doesn't shorten the list the loop is walking. */
  function notify(list, value) {
    var copy = list.slice();
    for (var i = 0; i < copy.length; i++) copy[i](value);
  }

  function subscription(list, handler) {
    list.push(handler);
    return {
      close: function () {
        var index = list.indexOf(handler);
        if (index >= 0) list.splice(index, 1);
      },
    };
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
      return subscription(themeWaiters, handler);
    },
  };

  /* ---- inc (NAP-INC) ---------------------------------------------------- */

  /*
   * A convention URI is developer-facing sugar: emitting
   * 'napplet:profile/open?pubkey=abc' routes on 'napplet:profile/open' and
   * arrives as a payload of { pubkey: 'abc' }. The rules are deliberately
   * unforgiving — no type coercion, no '+' for space, no repeated name, no
   * fragment, no separate payload alongside — because topics are matched by
   * exact equality and a receiver should never have to guess whether '1' meant
   * a number. Anything ambiguous fails here, at the call site.
   */
  function transpose(topic, payload) {
    if (topic.indexOf('#') >= 0) {
      throw new Error('A convention URI cannot carry a fragment.');
    }

    var mark = topic.indexOf('?');
    if (mark < 0) return { topic: topic, payload: payload };

    if (payload !== undefined) {
      throw new Error('A convention URI with parameters cannot also carry a payload.');
    }

    var params = {};
    var query = topic.slice(mark + 1);
    var pairs = query ? query.split('&') : [];

    for (var i = 0; i < pairs.length; i++) {
      if (!pairs[i]) continue;

      var split = pairs[i].indexOf('=');
      var rawName = split < 0 ? pairs[i] : pairs[i].slice(0, split);
      var rawValue = split < 0 ? '' : pairs[i].slice(split + 1);
      var name;
      var value;

      try {
        name = decodeURIComponent(rawName);
        value = decodeURIComponent(rawValue);
      } catch (err) {
        throw new Error('A convention URI parameter is not valid percent-encoding.');
      }

      if (Object.prototype.hasOwnProperty.call(params, name)) {
        throw new Error('A convention URI cannot repeat a parameter.');
      }
      params[name] = value;
    }

    return { topic: topic.slice(0, mark), payload: params };
  }

  /* Consumers subscribe to the stable identity; a query on this side is sugar
   * that was never part of what gets matched. */
  function stableTopic(topic) {
    var mark = topic.indexOf('?');
    return mark < 0 ? topic : topic.slice(0, mark);
  }

  /**
   * The napplet-side half of one channel.
   *
   * Materialized from whichever message named the channel first — the opener's
   * result or the target's 'inc.channel.opened' — and identical on both sides,
   * which is what makes a channel symmetric rather than a caller and a callee.
   */
  function channelRecord(channelId, peer) {
    var existing = channels[channelId];
    if (existing) return existing;

    var record = {
      handlers: [],
      closedHandlers: [],
      buffered: [],
      terminal: null,
      handle: null,
    };

    record.handle = {
      id: channelId,
      peer: peer,
      emit: function (payload) {
        if (record.terminal) return;
        post({ type: 'inc.channel.emit', channelId: channelId, payload: payload });
      },
      on: function (handler) {
        var held = record.buffered;
        record.buffered = [];
        var handle = subscription(record.handlers, handler);
        /* Whatever arrived before anyone was listening. NAP-INC requires it be
         * retained rather than dropped, so the first handler gets the backlog. */
        for (var i = 0; i < held.length; i++) handler(held[i]);
        return handle;
      },
      onClosed: function (handler) {
        /* The terminal record is kept, so a handler registered after the
         * channel ended still learns that it did. */
        if (record.terminal) {
          handler(record.terminal);
          return { close: function () {} };
        }
        return subscription(record.closedHandlers, handler);
      },
      close: function () {
        if (record.terminal) return;
        post({ type: 'inc.channel.close', channelId: channelId });
      },
    };

    channels[channelId] = record;
    return record;
  }

  var inc = {
    emit: function (topic, payload) {
      var routed = transpose(String(topic), payload);
      post({ type: 'inc.emit', topic: routed.topic, payload: routed.payload });
    },
    on: function (topic, handler) {
      var name = stableTopic(String(topic));
      var list = incHandlers[name];

      if (!list) {
        list = incHandlers[name] = [];
        request('inc.subscribe', { topic: name }).then(null, function () {
          /* Refused by the shell: the handler is registered but never fires,
           * which is what a topic nobody may listen on looks like. */
        });
      }

      list.push(handler);

      var live = true;
      return {
        close: function () {
          if (!live) return;
          live = false;

          var index = list.indexOf(handler);
          if (index >= 0) list.splice(index, 1);
          if (list.length) return;

          delete incHandlers[name];
          post({ type: 'inc.unsubscribe', topic: name });
        },
      };
    },
    channel: {
      open: function (target) {
        return request('inc.channel.open', { target: String(target) }).then(function (opened) {
          return channelRecord(opened.channelId, opened.peer).handle;
        });
      },
      onOpened: function (handler) {
        var held = pendingOpened;
        pendingOpened = [];
        var handle = subscription(openedHandlers, handler);
        /* Handles that arrived before anything was waiting for them. */
        for (var i = 0; i < held.length; i++) handler(held[i]);
        return handle;
      },
      list: function () {
        return request('inc.channel.list', {});
      },
      broadcast: function (payload) {
        post({ type: 'inc.channel.broadcast', payload: payload });
      },
    },
  };

  /* ---- intent (NAP-INTENT) ---------------------------------------------- */

  var intent = {
    invoke: function (req) {
      return request('intent.invoke', { request: req });
    },
    open: function (archetype, payload, opts) {
      var options = opts || {};
      return intent.invoke({
        archetype: String(archetype),
        action: 'open',
        payload: payload,
        convention: options.convention,
        handler: options.handler,
        behavior: options.behavior,
      });
    },
    available: function (archetype) {
      return request('intent.available', { archetype: String(archetype) });
    },
    handlers: function () {
      return request('intent.handlers', {});
    },
    onChanged: function (handler) {
      return subscription(intentWaiters, handler);
    },
  };

  /* ---- identity (NAP-IDENTITY) ------------------------------------------ */

  var identity = {
    getPublicKey: function () {
      return request('identity.getPublicKey', {});
    },
    onChanged: function (handler) {
      return subscription(identityWaiters, handler);
    },
    getRelays: function () {
      return request('identity.getRelays', {});
    },
    getProfile: function () {
      return request('identity.getProfile', {});
    },
    getFollows: function () {
      return request('identity.getFollows', {});
    },
    getList: function (type) {
      return request('identity.getList', { listType: String(type) });
    },
    getZaps: function () {
      return request('identity.getZaps', {});
    },
    getMutes: function () {
      return request('identity.getMutes', {});
    },
    getBlocked: function () {
      return request('identity.getBlocked', {});
    },
    getBadges: function () {
      return request('identity.getBadges', {});
    },
  };

  /* ---- namespace -------------------------------------------------------- */

  var domains = {
    shell: shell,
    relay: relay,
    storage: storage,
    theme: theme,
    inc: inc,
    intent: intent,
    identity: identity,
  };
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
     * Only the frame that owns this document, and only from its own origin.
     * Both hold: the relaying frame is this document's parent and shares its
     * origin, so anything failing either check came from somewhere else.
     */
    if (event.source !== host) return;
    if (event.origin !== location.origin) return;

    var envelope = event.data;
    if (!envelope || typeof envelope !== 'object' || envelope.jsonrpc !== '2.0') return;
    // Acknowledgements of this document's own requests carry no NAP message.
    if (envelope.method !== 'napplet' || !envelope.params) return;

    var message = envelope.params;
    if (typeof message.type !== 'string') return;

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
        notify(themeWaiters, message.theme);
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

      /* ---- inc ---------------------------------------------------------- */

      case 'inc.subscribe.result':
        settle(message.id, message.error, undefined);
        return;

      case 'inc.event': {
        var topical = incHandlers[message.topic];
        if (topical) {
          notify(topical, {
            topic: message.topic,
            sender: message.sender,
            payload: message.payload,
          });
        }
        return;
      }

      case 'inc.channel.open.result':
        settle(message.id, message.error, {
          channelId: message.channelId,
          peer: message.peer,
        });
        return;

      case 'inc.channel.opened': {
        var opened = channelRecord(message.channelId, message.peer).handle;
        if (openedHandlers.length) notify(openedHandlers, opened);
        else pendingOpened.push(opened);
        return;
      }

      case 'inc.channel.event': {
        var carrying = channels[message.channelId];
        if (!carrying || carrying.terminal) return;

        var delivery = {
          channelId: message.channelId,
          sender: message.sender,
          payload: message.payload,
        };

        if (carrying.handlers.length) {
          notify(carrying.handlers, delivery);
          return;
        }

        carrying.buffered.push(delivery);
        if (carrying.buffered.length > MAX_CHANNEL_BUFFER) {
          /* Overflowed with nobody listening. NAP-INC forbids dropping the
           * backlog quietly, so the channel is closed instead — both ends are
           * told, which is the loud failure it asks for. */
          carrying.buffered.length = 0;
          post({ type: 'inc.channel.close', channelId: message.channelId });
        }
        return;
      }

      case 'inc.channel.list.result':
        settle(message.id, message.error, message.channels || []);
        return;

      case 'inc.channel.closed': {
        var ending = channels[message.channelId];
        if (!ending || ending.terminal) return;

        ending.terminal = { channelId: message.channelId, reason: message.reason };
        var mourners = ending.closedHandlers;
        ending.closedHandlers = [];
        for (var m = 0; m < mourners.length; m++) mourners[m](ending.terminal);
        return;
      }

      /* ---- intent ------------------------------------------------------- */

      case 'intent.invoke.result':
        settle(message.id, message.error, message.result);
        return;

      case 'intent.available.result':
        settle(message.id, message.error, message.availability);
        return;

      case 'intent.handlers.result':
        settle(message.id, message.error, message.handlers || []);
        return;

      case 'intent.changed':
        notify(intentWaiters, message.availability);
        return;

      /* ---- identity ----------------------------------------------------- */

      case 'identity.getPublicKey.result':
        // NAP-IDENTITY forbids this one an error: no signer is the empty string.
        settle(message.id, null, message.pubkey || '');
        return;

      case 'identity.getRelays.result':
        settle(message.id, message.error, message.relays || {});
        return;

      case 'identity.getProfile.result':
        settle(message.id, message.error, message.profile === undefined ? null : message.profile);
        return;

      case 'identity.getFollows.result':
      case 'identity.getMutes.result':
      case 'identity.getBlocked.result':
        settle(message.id, message.error, message.pubkeys || []);
        return;

      case 'identity.getList.result':
        settle(message.id, message.error, message.entries || []);
        return;

      case 'identity.getZaps.result':
        settle(message.id, message.error, message.zaps || []);
        return;

      case 'identity.getBadges.result':
        settle(message.id, message.error, message.badges || []);
        return;

      case 'identity.changed':
        notify(identityWaiters, message.pubkey || '');
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
export function guestShim(domains: string[]): string {
  // Always empty: this runtime exposes no named services. The field is still
  // delivered rather than omitted, because it is part of the environment
  // NAP-SHELL entitles a napplet to read.
  return neutralize(SHIM.replace('__DOMAINS__', JSON.stringify(domains)).replace('__SERVICES__', '[]'));
}
