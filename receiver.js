/*
  Thoth Cast receiver v0 - Phase 8a skeleton.

  This is the whole receiver for 8a: start the CAF receiver context, declare the
  custom namespace Thoth will use, and put the state on screen. It animates
  nothing from a message yet; the motion on screen is Stress's own loop (8a's
  device proof). The real payload - sequence number, schemaVersion, pattern
  marker, thumbnails, events computed by the phone against the last-sent state -
  is Phase 8b (SRD Phase 8, Gap 2).

  ES5 only, for the 2013 Chromecast. See stress.js.
*/

(function () {
  'use strict';

  var VERSION = 'v0';
  var NAMESPACE = 'urn:x-cast:io.github.renomike.scores';

  var senders = 0;
  var messages = 0;
  var lastMessage = '-';

  function set(id, text, cls) {
    var node = document.getElementById(id);
    if (!node) { return; }
    node.firstChild.nodeValue = text;
    if (cls !== undefined) { node.className = 'v ' + cls; }
  }

  function describeDevice() {
    /* The user agent is the one reliable way to tell which Chromecast loaded the
       page, and it is on screen on purpose: 8a has to confirm the device is the
       H2G2-42 and record how old its engine is. */
    set('dUa', navigator.userAgent || 'unknown');
    set('dScreen', window.innerWidth + ' x ' + window.innerHeight
      + ' css px, dpr ' + (window.devicePixelRatio || 1));
  }

  function startStress() {
    Stress.start();
    set('sBudget', Stress.budget.rows + ' rows, ' + Stress.budget.confetti
      + ' confetti, motion ends at ' + Stress.budget.motionEndMs + ' ms');
  }

  function onMessage(event) {
    messages++;
    var data = event.data;
    var text;
    try {
      text = (typeof data === 'string') ? data : JSON.stringify(data);
    } catch (e) {
      text = '[unserialisable]';
    }
    if (text.length > 120) { text = text.substring(0, 117) + '...'; }
    lastMessage = text;
    set('cMessages', String(messages));
    set('cLast', lastMessage);
  }

  function startReceiver() {
    if (typeof cast === 'undefined' || !cast.framework) {
      /* Opened in an ordinary browser, or the gstatic script did not load. The
         stress loop still runs, which is how stress.html is driven on a desktop. */
      set('cSdk', 'not loaded (not in a Cast session)', 'warn');
      set('cState', 'standalone', 'warn');
      return;
    }
    set('cSdk', 'loaded', 'ok');

    var context = cast.framework.CastReceiverContext.getInstance();
    var options = new cast.framework.CastReceiverOptions();

    /* A non-media app: no player libraries are loaded, and the receiver must not
       be torn down for being idle, because Thoth sends nothing between scores. */
    options.disableIdleTimeout = true;
    options.skipPlayersLoad = true;
    options.statusText = 'Thoth - Keeper of Scores';
    options.customNamespaces = {};
    options.customNamespaces[NAMESPACE] = cast.framework.system.MessageType.JSON;

    context.addCustomMessageListener(NAMESPACE, onMessage);

    var sys = cast.framework.system.EventType;
    context.addEventListener(sys.READY, function () {
      set('cState', 'ready', 'ok');
    });
    context.addEventListener(sys.SENDER_CONNECTED, function (e) {
      senders++;
      set('cSenders', String(senders));
      set('cLastSender', (e && e.senderId) ? e.senderId : '-');
    });
    context.addEventListener(sys.SENDER_DISCONNECTED, function (e) {
      senders--;
      if (senders < 0) { senders = 0; }
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
    Layout.render(document.body);
    set('vVersion', VERSION);
    describeDevice();
    startStress();
    /* The context is started after the page is drawn, so a failure in the Cast
       SDK still leaves a readable screen on the TV rather than a blank one. */
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
