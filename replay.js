/*
  The desktop replay harness (Thoth SRD Phase 8, "Testing without a TV"; 8b deliverable 6).

  Drives the receiver from a recorded feed, in an ordinary desktop browser, with no
  Chromecast and no phone. The feed is `feed.json`, produced by the app's own
  CastFeedRecordingTest from the real ScoreboardBroadcaster, so the harness replays the
  exact bytes the phone sends - not an imitation of them. Everything it feeds goes through
  the same Messages module the Cast path uses.

  The frame is fixed at 1280 x 720, which is what Mike's Chromecast reports
  (1280 x 720 css px at dpr 1, measured in 8a). A desktop window is not that size, so the
  frame is scaled to fit rather than reflowed: a layout judged at 1512 x 850 would be a
  layout for a screen that does not exist.

  ES2015 is allowed (Chrome 70 on the device).
*/

(function () {
  'use strict';

  const WIDTH = 1280;
  const HEIGHT = 720;

  let feed = null;
  let cursor = 0;
  let timer = null;
  let speed = 1;
  let messages = null;

  function set(id, text, cls) {
    const node = document.getElementById(id);
    if (!node) return;
    node.firstChild.nodeValue = text;
    if (cls !== undefined) node.className = 'v ' + cls;
  }

  function log(line) {
    const box = document.getElementById('replayLog');
    if (!box) return;
    const row = document.createElement('div');
    row.appendChild(document.createTextNode(line));
    box.insertBefore(row, box.firstChild);
    while (box.childNodes.length > 40) box.removeChild(box.lastChild);
  }

  function status(text) {
    const node = document.getElementById('replayStatus');
    if (node) node.firstChild.nodeValue = text;
  }

  /* Scale the 1280 x 720 frame into whatever window this is, without reflowing it. */
  function fit() {
    const stage = document.getElementById('stage');
    const frame = document.getElementById('castFrame');
    if (!stage || !frame) return;
    const scale = Math.min(stage.clientWidth / WIDTH, stage.clientHeight / HEIGHT);
    frame.style.transform = 'scale(' + scale + ')';
    frame.style.webkitTransform = 'scale(' + scale + ')';
    set('rScale', Math.round(scale * 100) + '% of 1280 x 720');
  }

  function step() {
    if (!feed || cursor >= feed.messages.length) {
      pause();
      status('end of feed (' + (feed ? feed.messages.length : 0) + ' messages)');
      return;
    }
    const message = feed.messages[cursor];
    cursor++;
    const outcome = messages.accept(message);
    log('#' + cursor + '  seq ' + message.sequence + '  ' + message.type + '  -> ' + outcome);
    set('rCursor', cursor + ' / ' + feed.messages.length);
  }

  function play() {
    if (timer || !feed) return;
    const gap = Math.max(50, Math.round((feed.defaultGapMs || 1200) / speed));
    timer = window.setInterval(function () {
      if (cursor >= feed.messages.length) {
        pause();
        status('end of feed');
        return;
      }
      step();
    }, gap);
    status('playing at ' + speed + 'x (' + gap + ' ms a message)');
  }

  function pause() {
    if (timer) {
      window.clearInterval(timer);
      timer = null;
    }
    status('paused');
  }

  function restart() {
    pause();
    cursor = 0;
    messages.reset();
    set('rCursor', '0 / ' + (feed ? feed.messages.length : 0));
    set('cMessages', '0');
    set('cSequence', '-');
    set('cBoard', '-');
    set('cEvents', '-');
    set('cThumbs', '0');
    set('cDropped', '-');
    status('restarted');
    log('--- restarted ---');
  }

  /*
    Replays the message just before the cursor a second time. The receiver must ignore it:
    its sequence is no longer ahead of the highest drawn, so a lead change cannot be
    celebrated twice (SRD Phase 8, Gap 2). This is the one-click check of that rule.
  */
  function resend() {
    if (!feed || cursor === 0) return;
    const message = feed.messages[cursor - 1];
    const outcome = messages.accept(message);
    log('resend seq ' + message.sequence + '  -> ' + outcome
      + (outcome === 'ignored' ? '  (correct)' : '  (SHOULD HAVE BEEN IGNORED)'));
  }

  /*
    Drops the connection and brings it back, as the phone's reconnect does: the receiver
    forgets everything and the next full state arrives with no events.
  */
  function reconnect() {
    messages.reset();
    set('cThumbs', '0');
    log('--- receiver reset (reconnect) ---');
    status('reset; the next state is a full board with no events');
  }

  function control(label, handler) {
    const button = document.createElement('button');
    button.className = 'rBtn';
    button.appendChild(document.createTextNode(label));
    button.addEventListener('click', handler);
    return button;
  }

  function buildControls() {
    const bar = document.getElementById('replayBar');
    bar.appendChild(control('Play', play));
    bar.appendChild(control('Pause', pause));
    bar.appendChild(control('Step', function () { pause(); step(); }));
    bar.appendChild(control('Restart', restart));
    bar.appendChild(control('Resend last', resend));
    bar.appendChild(control('Reconnect', reconnect));
    [0.5, 1, 2, 4].forEach(function (rate) {
      bar.appendChild(control(rate + 'x', function () {
        speed = rate;
        if (timer) {
          pause();
          play();
        } else {
          status('speed ' + rate + 'x');
        }
      }));
    });
  }

  function wireReceiverPanel() {
    messages = Messages.create({
      onState: function (state, events, sequence) {
        const counts = messages.counts();
        set('cMessages', String(counts.state));
        set('cSequence', String(sequence));
        set('cBoard', state.competitors.length + ' rows, round ' + state.round
          + ', ' + state.status);
        set('cEvents', events.length === 0
          ? 'none (full state)'
          : events.map(function (e) { return e.type; }).join(', '));
        set('cDropped', counts.ignored + ' out of order, ' + counts.rejected + ' rejected');
      },
      onThumbnail: function () {
        set('cThumbs', String(messages.thumbnailCount()));
      },
      onUnsupported: function (version) {
        set('cSchema', 'feed is v' + version + ', this page speaks v'
          + Messages.SCHEMA_VERSION, 'bad');
      }
    });
  }

  function main() {
    const frame = document.getElementById('castFrame');
    Layout.render(frame, { jank: Debug.enabled() });
    const subtitle = document.getElementById('subtitle');
    if (subtitle) {
      subtitle.innerHTML = 'replay harness &middot; payload v' + Messages.SCHEMA_VERSION
        + ' &middot; 1280 x 720';
    }
    set('cSdk', 'replay harness (no Cast SDK)', 'warn');
    set('cState', 'driven from feed.json', 'warn');
    set('cNamespace', 'urn:x-cast:io.github.renomike.scores');
    set('cSchema', 'v' + Messages.SCHEMA_VERSION, 'ok');
    set('dScreen', WIDTH + ' x ' + HEIGHT + ' css px, dpr 1 (the Chromecast’s own)');
    set('dUa', navigator.userAgent || 'unknown');
    set('sBudget', 'board drawing is Phase 8c');

    wireReceiverPanel();
    buildControls();
    fit();
    window.addEventListener('resize', fit);

    const request = new XMLHttpRequest();
    request.open('GET', 'feed.json', true);
    request.onload = function () {
      if (request.status < 200 || request.status >= 300) {
        status('feed.json could not be loaded (HTTP ' + request.status + ')');
        return;
      }
      try {
        feed = JSON.parse(request.responseText);
      } catch (e) {
        status('feed.json is not valid JSON');
        return;
      }
      set('rCursor', '0 / ' + feed.messages.length);
      set('rFeed', feed.messages.length + ' messages, recorded by ' + feed.recordedBy);
      status('loaded; press Play');
    };
    request.onerror = function () {
      /* file:// blocks XHR, which is the usual cause. */
      status('feed.json could not be loaded - serve this folder over HTTP');
    };
    request.send();
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    main();
  } else {
    window.addEventListener('DOMContentLoaded', main);
  }
}());
