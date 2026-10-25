/*
  Thoth Cast receiver - the Cast side.

  Starts the CAF receiver context, registers the custom namespace, and hands every message
  to Messages, which draws the board through Board. Both are shared with the desktop replay
  harness, so what the harness proves is what the TV does.

  The board is still: rank slides, count-ups and the lead-change celebration are Phase 8d.
*/

(function () {
  'use strict';

  const VERSION = 'v0.3';
  const NAMESPACE = 'urn:x-cast:io.github.renomike.scores';

  let senders = 0;
  let boot = null;

  function onMessage(event) {
    let payload = event.data;
    if (typeof payload === 'string') {
      try {
        payload = JSON.parse(payload);
      } catch (e) {
        if (boot.debug) Boot.set('cDropped', 'unparseable message', 'bad');
        return;
      }
    }
    boot.messages.accept(payload);
  }

  function startReceiver() {
    if (typeof cast === 'undefined' || !cast.framework) {
      /* An ordinary browser, or the gstatic script did not load. */
      if (boot.debug) {
        Boot.set('cSdk', 'not loaded (not in a Cast session)', 'warn');
        Boot.set('cState', 'standalone', 'warn');
      }
      return;
    }
    if (boot.debug) Boot.set('cSdk', 'loaded', 'ok');

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
      if (boot.debug) Boot.set('cState', 'ready', 'ok');
    });
    context.addEventListener(sys.SENDER_CONNECTED, function (e) {
      senders++;
      if (boot.debug) {
        Boot.set('cSenders', String(senders));
        Boot.set('cLastSender', (e && e.senderId) ? e.senderId : '-');
      }
    });
    context.addEventListener(sys.SENDER_DISCONNECTED, function (e) {
      senders = Math.max(0, senders - 1);
      if (boot.debug) {
        Boot.set('cSenders', String(senders));
        Boot.set('cLastSender', (e && e.senderId ? e.senderId : '-') + ' (gone)');
      }
    });
    context.addEventListener(sys.SHUTDOWN, function () {
      if (boot.debug) Boot.set('cState', 'shutdown', 'bad');
    });

    context.start(options);
    if (boot.debug) {
      Boot.set('cState', 'started', 'ok');
      Boot.set('cNamespace', NAMESPACE);
    }
  }

  function main() {
    boot = Boot.start({});

    /*
      Until the first message arrives there is nothing to draw. The name says which app the
      TV is showing rather than leaving a black screen, which is also how Mike can tell the
      receiver loaded at all.
    */
    const gameName = document.getElementById('bgame');
    if (gameName) gameName.textContent = 'Thoth · ' + VERSION;
    const round = document.getElementById('bround');
    if (round) round.textContent = 'waiting for the phone';

    /* The context is started after the page is drawn, so a failure in the Cast SDK still
       leaves a readable screen on the TV rather than a blank one. */
    try {
      startReceiver();
    } catch (e) {
      if (boot.debug) {
        Boot.set('cState', 'error: ' + (e && e.message ? e.message : e), 'bad');
      }
    }
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    main();
  } else {
    window.addEventListener('DOMContentLoaded', main);
  }
}());
