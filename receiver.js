/*
  Thoth Cast receiver - the Cast side.

  Starts the CAF receiver context, registers the custom namespace, and hands every message
  to Messages, which is the same module the desktop replay harness drives. What arrives is
  reported on the state panel; the board itself is Phase 8c, and nothing here draws one yet.

  ES2015 is allowed (Chrome 70 on the device, measured in 8a); stress.js stays as it is,
  since it is ES5 and already proved on the dongle.
*/

(function () {
  'use strict';

  const VERSION = 'v0.2';
  const NAMESPACE = 'urn:x-cast:io.github.renomike.scores';

  let senders = 0;
  let received = 0;

  function set(id, text, cls) {
    const node = document.getElementById(id);
    if (!node) return;
    node.firstChild.nodeValue = text;
    if (cls !== undefined) node.className = 'v ' + cls;
  }

  /*
    The user agent is on screen on purpose: it is the only evidence of which Chromecast
    loaded the page and how old its browser is, and the whole motion budget is set from it
    (SRD Phase 8, "The browser is Chrome 70").
  */
  function describeDevice() {
    set('dUa', navigator.userAgent || 'unknown');
    set('dScreen', window.innerWidth + ' x ' + window.innerHeight
      + ' css px, dpr ' + (window.devicePixelRatio || 1));
  }

  const messages = Messages.create({
    onState: function (state, events, sequence) {
      received++;
      set('cMessages', String(received));
      set('cSequence', String(sequence));
      set('cBoard', state.competitors.length + ' rows, round ' + state.round
        + ', ' + state.status);
      set('cEvents', events.length === 0
        ? 'none (full state)'
        : events.map(function (e) { return e.type; }).join(', '));
      const counts = messages.counts();
      set('cDropped', counts.ignored + ' out of order, ' + counts.rejected + ' rejected');
    },
    onThumbnail: function () {
      set('cThumbs', String(messages.thumbnailCount()));
    },
    onUnsupported: function (version) {
      set('cSchema', 'sender sent v' + version + ', this page speaks v'
        + Messages.SCHEMA_VERSION, 'bad');
    }
  });

  function onMessage(event) {
    let payload = event.data;
    if (typeof payload === 'string') {
      try {
        payload = JSON.parse(payload);
      } catch (e) {
        set('cDropped', 'unparseable message', 'bad');
        return;
      }
    }
    messages.accept(payload);
  }

  function startReceiver() {
    if (typeof cast === 'undefined' || !cast.framework) {
      /* An ordinary browser, or the gstatic script did not load. stress.html runs here. */
      set('cSdk', 'not loaded (not in a Cast session)', 'warn');
      set('cState', 'standalone', 'warn');
      return;
    }
    set('cSdk', 'loaded', 'ok');

    const context = cast.framework.CastReceiverContext.getInstance();
    const options = new cast.framework.CastReceiverOptions();

    /* A non-media app: no player libraries, and never torn down for being idle, because
       Thoth sends nothing between scores. The dim "waiting" screen and letting the timeout
       close it is Phase 8e. */
    options.disableIdleTimeout = true;
    options.skipPlayersLoad = true;
    options.statusText = 'Thoth - Keeper of Scores';
    options.customNamespaces = {};
    options.customNamespaces[NAMESPACE] = cast.framework.system.MessageType.JSON;

    context.addCustomMessageListener(NAMESPACE, onMessage);

    const sys = cast.framework.system.EventType;
    context.addEventListener(sys.READY, function () {
      set('cState', 'ready', 'ok');
    });
    context.addEventListener(sys.SENDER_CONNECTED, function (e) {
      senders++;
      set('cSenders', String(senders));
      set('cLastSender', (e && e.senderId) ? e.senderId : '-');
    });
    context.addEventListener(sys.SENDER_DISCONNECTED, function (e) {
      senders = Math.max(0, senders - 1);
      set('cSenders', String(senders));
      set('cLastSender', (e && e.senderId ? e.senderId : '-') + ' (gone)');
    });
    context.addEventListener(sys.SHUTDOWN, function () {
      set('cState', 'shutdown', 'bad');
    });

    context.start(options);
    set('cState', 'started', 'ok');
    set('cNamespace', NAMESPACE);
  }

  function main() {
    const jank = Debug.enabled();
    Layout.render(document.body, { jank: jank });
    const subtitle = document.getElementById('subtitle');
    if (subtitle) {
      subtitle.innerHTML = '<span id="vVersion">' + VERSION + '</span> &middot; payload v'
        + Messages.SCHEMA_VERSION + (jank ? ' &middot; frame times on' : '');
    }
    set('cSchema', 'v' + Messages.SCHEMA_VERSION, 'ok');
    describeDevice();

    /*
      The motion stress loop is not what this page is for any more: from 8b index.html is
      the receiver, and the board it will draw is Phase 8c. The loop still runs behind the
      debug switch, because the Chromecast loads only the URL registered in the Cast console
      and that is the one route to a motion measurement on the TV (see README).
    */
    if (jank) {
      Stress.start();
      set('sBudget', Stress.budget.rows + ' rows, ' + Stress.budget.confetti
        + ' confetti, motion ends at ' + Stress.budget.motionEndMs + ' ms');
    } else {
      set('sBudget', 'stress loop off (add ?debug=1 to run it)');
    }

    /* The context is started after the page is drawn, so a failure in the Cast SDK still
       leaves a readable screen on the TV rather than a blank one. */
    try {
      startReceiver();
    } catch (e) {
      set('cState', 'error: ' + (e && e.message ? e.message : e), 'bad');
    }
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    main();
  } else {
    window.addEventListener('DOMContentLoaded', main);
  }
}());
