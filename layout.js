/*
  The page markup, in one place, so index.html (on the TV), replay.html (on a desktop) and
  stress.html cannot drift apart. Each page is a few script tags and an empty body; this
  writes the identical DOM into all of them.

  Two switches, both off by default from 8b:

    [options.diagnostics]  the receiver-state panel. It is a development read-out, not part
                           of the board, so the board gets the whole frame without it.
    [options.jank]         the frame-time read-out, which costs frames on the 2013
                           Chromecast and would make every later measurement pessimistic.
*/

var Layout = (function () {
  'use strict';

  function kv(label, id, initial) {
    return '<div class="kv"><div class="k">' + label
      + '</div><div class="v" id="' + id + '">' + initial + '</div></div>';
  }

  function render(root, options) {
    var opts = options || {};
    var debug = Boolean(opts.diagnostics || opts.jank);

    root.innerHTML =
      '<div id="frame"' + (debug ? ' class="debug"' : '') + '>'
      + '<div id="safe"></div>'

      /* The game's own name and round, as the phone's scoreboard header shows them. */
      + '<div id="head">'
      + '<div id="bhead">'
      + '<div id="bgame">—</div>'
      + '<div id="bround"></div>'
      + '</div>'
      + '</div>'

      + '<div id="board" class="bboard"></div>'
      + '<div id="confetti"></div>'

      + (opts.diagnostics
        ? '<div id="state">'
          + '<h2>Receiver state</h2>'
          + kv('Cast SDK', 'cSdk', '-')
          + kv('Context', 'cState', '-')
          + kv('Namespace', 'cNamespace', '-')
          + kv('Senders', 'cSenders', '0')
          + kv('Last sender', 'cLastSender', '-')
          + kv('Messages', 'cMessages', '0')
          + kv('Schema', 'cSchema', '-')
          + kv('Sequence', 'cSequence', '-')
          + kv('Board', 'cBoard', '-')
          + kv('Events', 'cEvents', '-')
          + kv('Thumbnails', 'cThumbs', '0')
          + kv('Dropped', 'cDropped', '-')
          + '<h2 style="margin-top:1.6vh">Device</h2>'
          + kv('Viewport', 'dScreen', '-')
          + kv('User agent', 'dUa', '-')
          + kv('Motion budget', 'sBudget', '-')
          + '</div>'
        : '')

      + (opts.jank
        ? '<div id="jank">'
          + '<h2>Frame times (motion window only)</h2>'
          + kv('Last cycle', 'jFps', '-')
          + kv('Worst frame', 'jWorst', '-')
          + kv('&gt;33ms / &gt;50ms', 'jDropped', '-')
          + kv('Frames', 'jFrames', '-')
          + kv('Cycle', 'jCycle', '-')
          + kv('Worst seen', 'jWorstEver', '-')
          + '<div id="verdict">-</div>'
          + '</div>'
        : '')

      + '</div>';
  }

  return { render: render };
}());
