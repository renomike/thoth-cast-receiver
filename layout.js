/*
  The page markup, in one place, so index.html (on the TV) and stress.html (in a
  desktop browser) cannot drift apart. Both pages are three script tags and an
  empty body; this writes the identical DOM into both.

  ES5 only, for the 2013 Chromecast. See stress.js.
*/

var Layout = (function () {
  'use strict';

  function kv(label, id, initial) {
    return '<div class="kv"><div class="k">' + label
      + '</div><div class="v" id="' + id + '">' + initial + '</div></div>';
  }

  function render(root) {
    root.innerHTML =
      '<div id="frame">'
      + '<div id="safe"></div>'

      + '<div id="head">'
      + '<div id="title">Thoth receiver</div>'
      + '<div id="subtitle"><span id="vVersion">-</span> &middot; Phase 8a skeleton'
      + ' &middot; motion stress loop</div>'
      + '</div>'

      + '<div id="board"></div>'
      + '<div id="confetti"></div>'

      + '<div id="state">'
      + '<h2>Receiver state</h2>'
      + kv('Cast SDK', 'cSdk', '-')
      + kv('Context', 'cState', '-')
      + kv('Namespace', 'cNamespace', '-')
      + kv('Senders', 'cSenders', '0')
      + kv('Last sender', 'cLastSender', '-')
      + kv('Messages', 'cMessages', '0')
      + kv('Last message', 'cLast', '-')
      + '<h2 style="margin-top:1.6vh">Device</h2>'
      + kv('Viewport', 'dScreen', '-')
      + kv('User agent', 'dUa', '-')
      + kv('Motion budget', 'sBudget', '-')
      + '</div>'

      + '<div id="jank">'
      + '<h2>Frame times (motion window only)</h2>'
      + kv('Last cycle', 'jFps', '-')
      + kv('Worst frame', 'jWorst', '-')
      + kv('&gt;33ms / &gt;50ms', 'jDropped', '-')
      + kv('Frames', 'jFrames', '-')
      + kv('Cycle', 'jCycle', '-')
      + kv('Worst seen', 'jWorstEver', '-')
      + '<div id="verdict">-</div>'
      + '</div>'

      + '</div>';
  }

  return { render: render };
}());
