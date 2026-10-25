/*
  The payload rules, receiver side (Thoth SRD Phase 8, Gap 2; 8b closing item 1).

  One module, used by both the real Cast path (receiver.js) and the desktop replay harness
  (replay.js), so what the harness proves is what the TV does.

  What it does NOT do, on purpose: it never works out what changed. The phone detects every
  event against the state that produced it and puts them in the message. A second detector
  here, in another language, would drift from the Kotlin one (D-008, D-013, TVR-02).

  Two guards against drawing the same thing twice:

    1. A state message whose sequence is not ahead of the highest already drawn is ignored
       outright - it arrived twice, or out of order.
    2. Every event carries a stable id, the sequence of the state that produced it, and an
       id is played **once**. This is the one that matters: a send the phone reported as
       failed may in fact have arrived, so the next message carries those events again under
       the same ids, and without this rule the TV would celebrate one lead change twice.

  ES2015 is allowed: the Chromecast that runs this reports Chrome 70 (CrKey 1.36.159268),
  measured on Mike's device in 8a. Anything newer than Chrome 70 is still avoided - no
  optional chaining, no nullish coalescing, no Object.fromEntries.
*/

var Messages = (function () {
  'use strict';

  /* The payload version this receiver understands. Must match CAST_SCHEMA_VERSION. */
  var SCHEMA_VERSION = 2;

  function create(handlers) {
    var state = null;
    var lastStateSequence = 0;
    var thumbnails = {};
    var playedEventIds = {};
    var counts = { state: 0, thumbnail: 0, ignored: 0, rejected: 0, played: 0, skipped: 0 };

    /*
      One message. Returns what was done with it, which the state panel prints and the
      replay harness asserts against.
    */
    function accept(message) {
      if (!message || typeof message !== 'object') {
        counts.rejected++;
        return 'rejected';
      }
      if (message.schemaVersion !== SCHEMA_VERSION) {
        /*
          A payload from a newer phone than this page, or an older one. Refused rather than
          guessed at: the phone carries the schema version precisely so the receiver can say
          "I do not know this" instead of drawing something wrong.
        */
        counts.rejected++;
        if (handlers.onUnsupported) handlers.onUnsupported(message.schemaVersion);
        return 'rejected';
      }

      if (message.type === 'thumbnail') {
        /*
          Cached under the player id, and never ordered against the sequence: a repeat is
          harmless, and the cache lives only as long as this page, which is why the phone
          sends them again after a reconnect.
        */
        thumbnails[message.playerId] = 'data:' + (message.mimeType || 'image/jpeg')
          + ';base64,' + message.base64;
        counts.thumbnail++;
        if (handlers.onThumbnail) handlers.onThumbnail(message.playerId);
        return 'thumbnail';
      }

      if (message.type === 'state') {
        if (message.sequence <= lastStateSequence) {
          counts.ignored++;
          return 'ignored';
        }
        lastStateSequence = message.sequence;
        state = message.state;
        counts.state++;

        /*
          Split the message's events into the ones to animate and the ones already played.
          The board is always drawn from the state; only the animation is skipped, so a
          repeat still leaves the TV showing the right totals.
        */
        var carried = message.events || [];
        var fresh = [];
        var i;
        for (i = 0; i < carried.length; i++) {
          var entry = carried[i];
          if (playedEventIds[entry.id]) {
            counts.skipped++;
          } else {
            playedEventIds[entry.id] = true;
            counts.played++;
            fresh.push(entry);
          }
        }

        /*
          An empty list is the normal case on a connect, a reconnect, or after a gap of more
          than five seconds, and means "this is where things stand", not "nothing happened".
        */
        if (handlers.onState) {
          handlers.onState(state, fresh, message.sequence, carried.length - fresh.length);
        }
        return fresh.length === carried.length ? 'state' : 'state (events skipped)';
      }

      counts.rejected++;
      return 'rejected';
    }

    function reset() {
      state = null;
      lastStateSequence = 0;
      thumbnails = {};
      playedEventIds = {};
      counts = { state: 0, thumbnail: 0, ignored: 0, rejected: 0, played: 0, skipped: 0 };
    }

    return {
      accept: accept,
      reset: reset,
      schemaVersion: SCHEMA_VERSION,
      currentState: function () { return state; },
      lastSequence: function () { return lastStateSequence; },
      thumbnailFor: function (playerId) { return thumbnails[playerId] || null; },
      thumbnailCount: function () { return Object.keys(thumbnails).length; },
      counts: function () { return counts; }
    };
  }

  return { create: create, SCHEMA_VERSION: SCHEMA_VERSION };
}());
