/*
  Thoth Cast receiver - motion stress loop and frame-time readout.

  Phase 8a's job for this file (SRD Phase 8, "The device"): run a representative
  amount of motion on a loop so Mike can watch the 2013 Chromecast (H2G2-42) for
  stutter, and put the frame times on screen so the judgement is not only by eye.

  Deliberate constraints, all from the device:
    - ES5 only. No let/const, no arrow functions, no template literals, no
      classes, no Object.assign. The gen-1 Chromecast's engine is about Chrome 31.
    - Transforms and opacity only. Nothing animates layout or colour.
    - A hard cap on confetti pieces (CONFETTI_PIECES).
    - All motion in a cycle ends by MOTION_END_MS, which must stay <= 3000 (TV-03).
*/

var Stress = (function () {
  'use strict';

  /* ---- the motion budget, in one place ------------------------------- */

  var ROWS = 6;              /* half of the 12-competitor worst case, in one column */
  var CONFETTI_PIECES = 24;  /* the cap */

  var SLIDE_MS = 600;        /* rows reordering */
  var COUNT_MS = 1500;       /* totals counting up */
  var CROWN_AT_MS = 600;
  var CROWN_MS = 300;
  var CONFETTI_AT_MS = 1200;
  var CONFETTI_MS = 1600;    /* 1200 + 1600 = 2800 */

  var MOTION_END_MS = 2800;  /* every animation above has finished by here */
  var CYCLE_MS = 4500;       /* then a still pause, so each cycle reads separately */

  /* Palette keys borrowed from the app's fixed palette (D-017/D-021) so the
     stress page looks like the real board rather than a test card. */
  var COMPETITORS = [
    { name: 'Konstantina', initials: 'KO', colour: '#e8c477' },
    { name: 'Mike',        initials: 'MI', colour: '#6fa8dc' },
    { name: 'Alexandros',  initials: 'AL', colour: '#8fd4a0' },
    { name: 'Jo',          initials: 'JO', colour: '#e8a05a' },
    { name: 'Theodora',    initials: 'TH', colour: '#c9a0e8' },
    { name: 'Nik',         initials: 'NI', colour: '#e87d7d' }
  ];

  var now = (window.performance && window.performance.now)
    ? function () { return window.performance.now(); }
    : function () { return Date.now(); };

  var raf = window.requestAnimationFrame
    || window.webkitRequestAnimationFrame
    || function (cb) { return window.setTimeout(function () { cb(now()); }, 16); };

  /* ---- small DOM helpers --------------------------------------------- */

  function setTransform(el, value) {
    el.style.webkitTransform = value;
    el.style.transform = value;
  }

  function setTransition(el, value) {
    el.style.webkitTransition = value;
    el.style.transition = value;
  }

  function reflow(el) {
    /* Reading offsetHeight flushes the style change above, so the next
       transition starts from the value just set instead of being coalesced. */
    return el.offsetHeight;
  }

  /* ---- state --------------------------------------------------------- */

  var rows = [];        /* { el, inner, crown, totalEl, slot, shown, from, to } */
  var pieces = [];
  var order = [];       /* order[slot] = competitor index */
  var cycle = 0;
  var cycleStart = 0;
  var counting = false;

  /* frame-time accounting */
  var lastFrame = 0;
  var frames = 0;
  var worstMs = 0;
  var over33 = 0;
  var over50 = 0;
  var sumMs = 0;
  var worstEverMs = 0;
  var worstEverOver33 = 0;
  var el = {};

  /* ---- build --------------------------------------------------------- */

  function build(boardEl, confettiEl) {
    var i;
    for (i = 0; i < ROWS; i++) {
      var row = document.createElement('div');
      row.className = 'row';

      var inner = document.createElement('div');
      inner.className = 'rowInner';

      var crown = document.createElement('div');
      crown.className = 'crown';
      crown.innerHTML = '&#9819;';          /* a chess queen: on the device by default */

      var rank = document.createElement('div');
      rank.className = 'rank';
      rank.appendChild(document.createTextNode(String(i + 1)));

      var chip = document.createElement('div');
      chip.className = 'chip';
      chip.style.background = COMPETITORS[i].colour;
      chip.appendChild(document.createTextNode(COMPETITORS[i].initials));

      var name = document.createElement('div');
      name.className = 'name';
      name.appendChild(document.createTextNode(COMPETITORS[i].name));

      var total = document.createElement('div');
      total.className = 'total';
      total.appendChild(document.createTextNode('0'));

      inner.appendChild(crown);
      inner.appendChild(rank);
      inner.appendChild(chip);
      inner.appendChild(name);
      inner.appendChild(total);
      row.appendChild(inner);
      boardEl.appendChild(row);

      rows.push({
        el: row,
        crown: crown,
        rankEl: rank,
        totalEl: total,
        slot: i,
        shown: 0,
        from: 0,
        to: 0
      });
      order.push(i);
      setTransform(row, 'translate3d(0,' + (i * 100) + '%,0)');
    }

    for (i = 0; i < CONFETTI_PIECES; i++) {
      var p = document.createElement('div');
      p.className = 'piece';
      p.style.background = COMPETITORS[i % COMPETITORS.length].colour;
      confettiEl.appendChild(p);
      pieces.push(p);
    }
  }

  /* ---- one cycle ----------------------------------------------------- */

  function startCycle() {
    cycle++;
    cycleStart = now();
    frames = 0;
    worstMs = 0;
    over33 = 0;
    over50 = 0;
    sumMs = 0;
    lastFrame = 0;

    /* New totals first, then the order they imply: the board must rank by score,
       or the rank column contradicts the totals beside it. Random gains give a
       mix of long and short slides across cycles without contriving one. */
    var i, r;
    for (i = 0; i < ROWS; i++) {
      rows[i].from = rows[i].shown;
      rows[i].to = rows[i].shown + Math.floor(Math.random() * 40) + 5;
      order[i] = i;
    }
    order.sort(function (a, b) { return rows[b].to - rows[a].to; });

    for (i = 0; i < ROWS; i++) {
      r = rows[order[i]];
      r.slot = i;
      /* The rank belongs to the slot, not to the competitor, so it is rewritten
         every cycle. The number changes at the start of the slide rather than at
         the end: on a slow device a timer that lands mid-slide is worse than a
         rank that is briefly ahead of the row it labels. */
      r.rankEl.firstChild.nodeValue = String(i + 1);
      setTransition(r.el, '-webkit-transform ' + SLIDE_MS + 'ms ease-in-out, transform ' + SLIDE_MS + 'ms ease-in-out');
      setTransform(r.el, 'translate3d(0,' + (i * 100) + '%,0)');
    }
    counting = true;

    /* the crown on the new leader only */
    for (i = 0; i < ROWS; i++) {
      r = rows[i];
      setTransition(r.crown, 'none');
      r.crown.style.opacity = '0';
      reflow(r.crown);
      setTransition(r.crown, '-webkit-transform ' + CROWN_MS + 'ms linear, transform ' + CROWN_MS + 'ms linear, opacity ' + CROWN_MS + 'ms linear');
    }
    window.setTimeout(function () {
      var lead = rows[order[0]];
      lead.crown.style.opacity = '1';
      setTransform(lead.crown, 'translate3d(0,0,0) scale(1.15)');
    }, CROWN_AT_MS);

    window.setTimeout(burst, CONFETTI_AT_MS);
  }

  function burst() {
    var i;
    for (i = 0; i < pieces.length; i++) {
      var p = pieces[i];
      setTransition(p, 'none');
      p.style.opacity = '0';
      p.style.left = (6 + Math.random() * 88) + '%';
      p.style.top = '-4%';
      setTransform(p, 'translate3d(0,0,0) rotate(0deg)');
      reflow(p);
    }
    /* A second pass so all 24 start from the same flushed state, which keeps the
       burst from arriving in two visible waves on a slow device. */
    for (i = 0; i < pieces.length; i++) {
      pieces[i].style.opacity = '1';
      setTransition(pieces[i], '-webkit-transform ' + CONFETTI_MS + 'ms ease-in, transform ' + CONFETTI_MS + 'ms ease-in, opacity ' + CONFETTI_MS + 'ms ease-in');
      setTransform(pieces[i],
        'translate3d(' + Math.round(-120 + Math.random() * 240) + 'px,'
        + Math.round(window.innerHeight * 1.05) + 'px,0) rotate('
        + Math.round(180 + Math.random() * 540) + 'deg)');
      pieces[i].style.opacity = '0';
    }
  }

  /* ---- the frame loop ------------------------------------------------ */

  function frame(t) {
    var ts = (typeof t === 'number' && t > 0) ? t : now();
    var into = ts - cycleStart;

    /* Frame times are only counted inside the motion window; the still pause
       would otherwise flatter the average. */
    if (into <= MOTION_END_MS) {
      if (lastFrame > 0) {
        var d = ts - lastFrame;
        frames++;
        sumMs += d;
        if (d > worstMs) { worstMs = d; }
        if (d > 33) { over33++; }
        if (d > 50) { over50++; }
      }
      lastFrame = ts;
    }

    if (counting) {
      var k = into / COUNT_MS;
      if (k >= 1) { k = 1; counting = false; }
      var e = 1 - (1 - k) * (1 - k);           /* ease-out, cheap */
      for (var i = 0; i < ROWS; i++) {
        var r = rows[i];
        var v = Math.round(r.from + (r.to - r.from) * e);
        if (v !== r.shown) {
          r.shown = v;
          r.totalEl.firstChild.nodeValue = String(v);
        }
      }
    }

    if (into >= CYCLE_MS) {
      report();
      startCycle();
    }

    raf(frame);
  }

  function report() {
    if (!el.fps) { return; }
    var avg = frames > 0 ? (sumMs / frames) : 0;
    var fps = avg > 0 ? (1000 / avg) : 0;
    if (worstMs > worstEverMs) { worstEverMs = worstMs; }
    if (over33 > worstEverOver33) { worstEverOver33 = over33; }

    el.fps.firstChild.nodeValue = fps.toFixed(1) + ' fps (' + avg.toFixed(1) + ' ms)';
    el.worst.firstChild.nodeValue = worstMs.toFixed(1) + ' ms';
    el.dropped.firstChild.nodeValue = over33 + ' / ' + over50;
    el.frames.firstChild.nodeValue = String(frames);
    el.cycle.firstChild.nodeValue = String(cycle);
    el.worstEver.firstChild.nodeValue = worstEverMs.toFixed(0) + ' ms, ' + worstEverOver33 + ' dropped';

    var verdict, cls;
    if (fps >= 50 && over50 === 0) {
      verdict = 'SMOOTH'; cls = 'ok';
    } else if (fps >= 30 && over50 <= 2) {
      verdict = 'SOME JANK'; cls = 'warn';
    } else {
      verdict = 'STUTTERING'; cls = 'bad';
    }
    el.verdict.firstChild.nodeValue = verdict;
    el.verdict.className = cls;
  }

  /* ---- entry point --------------------------------------------------- */

  function start() {
    el.fps = document.getElementById('jFps');
    el.worst = document.getElementById('jWorst');
    el.dropped = document.getElementById('jDropped');
    el.frames = document.getElementById('jFrames');
    el.cycle = document.getElementById('jCycle');
    el.worstEver = document.getElementById('jWorstEver');
    el.verdict = document.getElementById('verdict');

    build(document.getElementById('board'), document.getElementById('confetti'));
    startCycle();
    raf(frame);
  }

  return {
    start: start,
    budget: {
      rows: ROWS,
      confetti: CONFETTI_PIECES,
      motionEndMs: MOTION_END_MS,
      cycleMs: CYCLE_MS
    }
  };
}());
