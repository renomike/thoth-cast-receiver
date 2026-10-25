/*
  stress.html's bootstrap: the motion stress loop on its own, with the frame-time readout
  always on, since measuring the motion is the whole point of this page.

  index.html is the receiver and keeps the readout behind Debug's switch (SRD Phase 8, the
  motion budget). This page does not load the Cast SDK and is not what the Chromecast
  registers; it is for looking at the motion in a desktop browser.
*/

(function () {
  'use strict';

  function main() {
    Layout.render(document.body, { jank: true });
    var subtitle = document.getElementById('subtitle');
    if (subtitle) {
      subtitle.innerHTML = 'motion stress loop &middot; frame times on';
    }
    function set(id, text, cls) {
      var node = document.getElementById(id);
      if (!node) return;
      node.firstChild.nodeValue = text;
      if (cls !== undefined) node.className = 'v ' + cls;
    }
    set('cSdk', 'not loaded (stress page)', 'warn');
    set('cState', 'standalone', 'warn');
    set('dScreen', window.innerWidth + ' x ' + window.innerHeight
      + ' css px, dpr ' + (window.devicePixelRatio || 1));
    set('dUa', navigator.userAgent || 'unknown');

    Stress.start();
    set('sBudget', Stress.budget.rows + ' rows, ' + Stress.budget.confetti
      + ' confetti, motion ends at ' + Stress.budget.motionEndMs + ' ms');
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    main();
  } else {
    window.addEventListener('DOMContentLoaded', main);
  }
}());
