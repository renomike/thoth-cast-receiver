/*
  Loads frames.json and feeds one named board through the real Messages and Board, so a
  phase frame is the receiver drawing a real ScoreboardState rather than a mock-up.

  Sets document.title to the frame's name and marks the body `data-ready` when the board and
  any thumbnail are drawn, which is what the screenshot script waits for.
*/

(function () {
  'use strict';

  function nameFromQuery() {
    var match = /[?&]name=([^&]+)/.exec(window.location.search || '');
    return match ? decodeURIComponent(match[1]) : 'six';
  }

  /* ?feed=N plays the first N messages of the recorded feed instead of a named board, so a
     frame can show a mid-run state with its events listed (8b closing item 2). */
  function feedCountFromQuery() {
    var match = /[?&]feed=(\d+)/.exec(window.location.search || '');
    return match ? parseInt(match[1], 10) : 0;
  }

  function playFeed(boot, count) {
    var request = new XMLHttpRequest();
    request.open('GET', 'feed.json', true);
    request.onload = function () {
      if (request.status < 200 || request.status >= 300) {
        document.title = 'feed.json HTTP ' + request.status;
        return;
      }
      var feed = JSON.parse(request.responseText);
      var i;
      for (i = 0; i < Math.min(count, feed.messages.length); i++) {
        boot.messages.accept(feed.messages[i]);
      }
      /*
        ?again=1 replays the last message under a FRESH sequence with its event ids left
        alone - the shape that arrives when the phone's send was reported failed but had in
        fact landed. The receiver must draw the board and play none of those events
        (8b closing item 1a). The frame shows it as "N events skipped".
      */
      if (/[?&]again=1/.test(window.location.search || '') && count > 0) {
        var again = JSON.parse(JSON.stringify(feed.messages[count - 1]));
        again.sequence = boot.messages.lastSequence() + 1;
        boot.messages.accept(again);
      }
      document.title = 'thoth-feed-' + count;
      document.body.setAttribute('data-ready', 'true');
    };
    request.onerror = function () {
      document.title = 'feed.json could not be loaded - serve over HTTP';
    };
    request.send();
  }

  function main() {
    var wanted = nameFromQuery();
    // No motion on a still frame, so no frame-time panel.
    var boot = Boot.start({ jank: false });
    var feedCount = feedCountFromQuery();
    if (feedCount > 0) {
      playFeed(boot, feedCount);
      return;
    }

    var request = new XMLHttpRequest();
    request.open('GET', 'frames.json', true);
    request.onload = function () {
      if (request.status < 200 || request.status >= 300) {
        document.title = 'frames.json HTTP ' + request.status;
        return;
      }
      var file;
      try {
        file = JSON.parse(request.responseText);
      } catch (e) {
        document.title = 'frames.json is not valid JSON';
        return;
      }
      var message = file.frames[wanted];
      if (!message) {
        document.title = 'no frame called ' + wanted;
        return;
      }
      /*
        The thumbnail first, so the photo is already cached when the board is drawn and the
        frame does not catch the fallback mid-swap. On the TV it is the other way round by
        design - the board goes out first and photos arrive into it - and that order is what
        the "photo" frame is for: one player has a thumbnail and the next deliberately does
        not, so both states are in one picture.
      */
      /*
        Only the "photo" board gets the thumbnail. Feeding it to every frame put the same
        photo on the first player of all of them, because the fixtures share a player id -
        which the twelve-competitor frame showed as a mysteriously blank circle.
      */
      if (file.thumbnail && wanted === 'photo') boot.messages.accept(file.thumbnail);
      boot.messages.accept(message);

      document.title = 'thoth-' + wanted;
      document.body.setAttribute('data-ready', 'true');
    };
    request.onerror = function () {
      document.title = 'frames.json could not be loaded - serve over HTTP';
    };
    request.send();
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    main();
  } else {
    window.addEventListener('DOMContentLoaded', main);
  }
}());
