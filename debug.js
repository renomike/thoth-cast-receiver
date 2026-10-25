/*
  The debug switch for the frame-time readout (Thoth SRD Phase 8, motion budget).

  Off by default from 8b on. The readout costs frames on the 2013 Chromecast - 8a's own
  measurement was taken with it on screen - so leaving it up would make every later
  measurement pessimistic and every real game uglier.

  Three ways to turn it on, in order of use:

    1. `?debug=1` in the URL. How the replay harness and stress.html run on a desktop.
    2. `#debug` in the hash, for the same thing without touching the query string.
    3. On the TV: the Cast console's registered receiver URL is edited to end in
       `index.html?debug=1` for as long as the numbers are wanted, then put back. A
       Chromecast loads exactly the registered URL and the sender cannot add to it, so this
       is the only route - see README, "Turning the readout on for a TV measurement".
*/

var Debug = (function () {
  'use strict';

  function enabled() {
    try {
      var search = window.location.search || '';
      var hash = window.location.hash || '';
      return /(^|[?&])debug=1($|&)/.test(search) || /(^|#)debug($|&)/.test(hash);
    } catch (e) {
      return false;
    }
  }

  return { enabled: enabled };
}());
