/*
  What index.html and replay.html both have to do: load the theme, lay the page out, wire
  Messages to Board, and keep the development panel (when it is on) up to date.

  Shared so the TV and the harness cannot drift. The only difference between them is where
  the messages come from - the Cast SDK or feed.json - which is each page's own job.
*/

var Boot = (function () {
  'use strict';

  function set(id, text, cls) {
    var node = document.getElementById(id);
    if (!node) return;
    node.firstChild.nodeValue = text;
    if (cls !== undefined) node.className = 'v ' + cls;
  }

  /*
    The night palette, generated from PlayerPalette by the app's CastThemeExportTest. Loaded
    rather than written out here so the TV cannot drift from the phone when a tone is
    re-tuned (D-021). If it fails to load the board still draws, in the fallback tone.
  */
  function loadTheme(done) {
    var request = new XMLHttpRequest();
    request.open('GET', 'theme.json', true);
    request.onload = function () {
      if (request.status >= 200 && request.status < 300) {
        try {
          done(JSON.parse(request.responseText));
          return;
        } catch (e) { /* fall through */ }
      }
      done(null);
    };
    request.onerror = function () { done(null); };
    request.send();
  }

  /**
   * Lays the page out and returns a Messages instance already wired to the board.
   *
   * [options.subtitle] is written into the development panel's header area; [options.onState]
   * is called after the board has been drawn, for anything the page itself wants to add.
   */
  function start(options) {
    var debug = Debug.enabled();
    // The harness renders into its fixed 1280 x 720 box; the TV renders into the body,
    // which is the viewport. [options.jank] false suppresses the frame-time panel on a page
    // that has no motion to measure - a still frame - where it would only overlap the state
    // panel it shares a column with.
    var jank = options.jank === false ? false : debug;
    Layout.render(options.root || document.body, { diagnostics: debug, jank: jank });

    var messages = null;

    function redraw() {
      var state = messages.currentState();
      if (!state) return;
      Board.draw(state);
      /* The header is sized here, in the same frame-relative units as the board. */
      var unit = (document.getElementById('frame') || document.body).clientHeight / 100;
      var gameName = document.getElementById('bgame');
      var round = document.getElementById('bround');
      if (gameName) {
        gameName.textContent = state.displayName || '—';
        gameName.style.fontSize = Math.round(Board.head.titlePct * unit) + 'px';
      }
      if (round) {
        round.textContent = state.status === 'ACTIVE'
          ? 'Round ' + state.round
          : (state.status === 'FINISHED' ? 'Final' : 'Abandoned');
        round.style.fontSize = Math.round(Board.head.roundPct * unit) + 'px';
      }
    }

    messages = Messages.create({
      onState: function (state, fresh, sequence, skipped) {
        redraw();
        if (debug) {
          var counts = messages.counts();
          set('cMessages', String(counts.state));
          set('cSequence', String(sequence));
          set('cBoard', state.competitors.length + ' rows, round ' + state.round
            + ', ' + state.status);
          set('cEvents', fresh.length === 0
            ? (skipped > 0 ? skipped + ' already played' : 'none (full state)')
            : fresh.map(function (e) { return e.event.type + '#' + e.id; }).join(', ')
              + (skipped > 0 ? ' (' + skipped + ' already played)' : ''));
          set('cDropped', counts.ignored + ' out of order, ' + counts.rejected
            + ' rejected, ' + counts.skipped + ' events skipped');
        }
        if (options.onState) options.onState(state, fresh, sequence, skipped);
      },
      onThumbnail: function () {
        // Redrawn so the photo replaces the initials as soon as it lands.
        redraw();
        if (debug) set('cThumbs', String(messages.thumbnailCount()));
      },
      onUnsupported: function (version) {
        if (debug) {
          set('cSchema', 'sender sent v' + version + ', this page speaks v'
            + Messages.SCHEMA_VERSION, 'bad');
        }
      }
    });

    Board.configure({
      root: document.getElementById('board'),
      frame: document.getElementById('frame'),
      theme: null,
      thumbnailFor: function (playerId) { return messages.thumbnailFor(playerId); }
    });
    loadTheme(function (theme) {
      Board.configure({
        root: document.getElementById('board'),
        frame: document.getElementById('frame'),
        theme: theme,
        thumbnailFor: function (playerId) { return messages.thumbnailFor(playerId); }
      });
      redraw();
    });

    if (debug) {
      set('cSchema', 'v' + Messages.SCHEMA_VERSION, 'ok');
      set('dScreen', window.innerWidth + ' x ' + window.innerHeight
        + ' css px, dpr ' + (window.devicePixelRatio || 1));
      set('dUa', navigator.userAgent || 'unknown');
      set('sBudget', 'still board, no animation (8d)');
    }

    return { messages: messages, redraw: redraw, debug: debug, set: set };
  }

  return { start: start, set: set };
}());
