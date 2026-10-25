/*
  The still scoreboard (Thoth SRD Phase 8c, TV-01, TV-04, NFR-04).

  Draws a ScoreboardState into the frame. **No animation**: rank slides, count-ups and the
  lead-change celebration are Phase 8d. Rows are built once and then reused - the DOM stays
  small, because the 2013 Chromecast is what has to draw it (SRD Phase 8, motion budget 4).

  The rules are Phase 7's, so the phone and the TV cannot word the same state differently:

    - **The total is measured before the name.** A long name is what gives way; the total
      never loses a digit to it (Phase 7 layout (d)).
    - **Names truncate** at a character count, with an ellipsis, exactly as
      `PlayerNames.truncateForDisplay` does.
    - **Ties share a rank**, so the column can read 1, 1, 3 (RNK-02).
    - **A deleted member's label comes from the receiver's own strings**, never from the
      blank name in the state (PLR-08, TVR-01).
    - **Rank is never colour alone** (NFR-04): the place is a numeral, every competitor
      carries a pattern marker as well as a colour, and a team's avatars sit inside a ring.

  Sizes are a share of the 720 px frame rather than px: totals at **7.5%** at six or fewer
  and **7%** at twelve, which is the floor the SRD sets for 20 feet (about 50 px).
*/

var Board = (function () {
  'use strict';

  /* One column up to this many competitors, two above it (Phase 7 layout (b)). */
  var ONE_COLUMN_LIMIT = 6;

  /* Avatars drawn before the rest of a team is counted instead (Phase 7). */
  var MAX_AVATARS = 4;

  /* The receiver's own user-facing strings. Never taken from the state (PLR-08). */
  var STRINGS = {
    deletedPlayer: 'Deleted player',
    deletedPlayerNumbered: function (n) { return 'Deleted player ' + n; },
    behindLeader: function (gap) { return gap + ' behind'; },
    behindBoth: function (gap, toNext, rank) {
      return gap + ' behind · ' + toNext + ' to ' + rank;
    },
    moreMembers: function (n) { return '+' + n; }
  };

  /*
    Two sets of sizes, chosen by how many rows have to fit, as on the phone. Every figure is
    a percentage of the frame's height, so the board is the same shape whatever draws it.
  */
  var METRICS = {
    few: {
      columns: 1,
      /*
        A font size is not a digit height. Measured off the rendered frame, this face inks
        its digits to about 0.59 of the font size, so the 7% (50 px) floor the SRD sets for
        20 feet needs about 12% of the frame in font size, not 7%. The frames in
        docs/screenshots/phase-8c carry the measurement.
      */
      totalPct: 12.6,
      namePct: 4.0,
      rankPct: 3.8,
      gapPct: 2.1,
      avatarPct: 6.5,
      rankWidthPct: 4.5,
      nameChars: 20,
      showsPlaceAbove: true
    },
    many: {
      columns: 2,
      /* The same floor at twelve: two columns of six leave the same row height. */
      totalPct: 12.6,
      namePct: 3.0,
      rankPct: 2.8,
      gapPct: 1.8,
      avatarPct: 5.0,
      rankWidthPct: 3.6,
      nameChars: 14,
      showsPlaceAbove: false
    }
  };

  var theme = null;
  var thumbnailFor = function () { return null; };
  var root = null;
  var frame = null;
  var rowPool = [];
  var drawn = 0;

  function configure(options) {
    theme = options.theme;
    if (options.thumbnailFor) thumbnailFor = options.thumbnailFor;
    root = options.root;
    /*
      Sizes are a share of the FRAME's height, not the board's: the 7% floor the SRD sets is
      7% of the 720 px the Chromecast reports, and the board is only part of that.
    */
    frame = options.frame || options.root;
  }

  /* ---- the palette ---------------------------------------------------- */

  /*
    An unknown key falls back to the first entry rather than to nothing, which is what
    PlayerPalette.color does - a player stored under a key this page has not been told about
    still gets a colour (D-021).

    Each entry carries three values, all generated from PlayerPalette: the tone, the colour
    the initials are drawn in, and the colour the pattern's marks are drawn in. The last two
    are not guessed here. The palette chooses the initials per tone and then shades the
    pattern *away* from them, so a pattern can only improve their contrast - the invariant
    NFR-04 rests on (PlayerPalette.onColor, patternShade).
  */
  var FALLBACK = { tone: '#94B0D4', on: '#000000', shade: '#C5D4E6' };

  function entryFor(colorKey) {
    if (!theme || !theme.colors) return FALLBACK;
    var entry = theme.colors[colorKey];
    if (!entry) entry = theme.colors[Object.keys(theme.colors)[0]];
    return entry || FALLBACK;
  }

  function toneFor(colorKey) {
    return entryFor(colorKey).tone;
  }

  /* ---- numbers -------------------------------------------------------- */

  /*
    Hundredths to text (D-015). The state says how many places to show, and with 0 places no
    decimal point appears anywhere - which is the common case and must stay clean.
  */
  function formatScore(hundredths, decimalPlaces) {
    var negative = hundredths < 0;
    var value = Math.abs(hundredths);
    var whole = Math.floor(value / 100);
    var text;
    if (decimalPlaces === 0) {
      text = String(Math.round(value / 100));
    } else {
      var fraction = value % 100;
      var digits = decimalPlaces === 1
        ? String(Math.round(fraction / 10))
        : (fraction < 10 ? '0' + fraction : String(fraction));
      text = whole + '.' + digits;
    }
    return (negative ? '-' : '') + text;
  }

  /* Mirrors PlayerNames.truncateForDisplay: keep maxChars - 1 and add one ellipsis. */
  function truncate(name, maxChars) {
    var points = Array.from(name);
    if (points.length <= maxChars) return name;
    return points.slice(0, maxChars - 1).join('') + '…';
  }

  function memberLabel(member) {
    if (!member.isDeleted) return member.name;
    return member.deletedNumber
      ? STRINGS.deletedPlayerNumbered(member.deletedNumber)
      : STRINGS.deletedPlayer;
  }

  function initialsOf(label) {
    var words = label.split(/\s+/).filter(function (w) { return w.length > 0; });
    if (words.length === 0) return '?';
    if (words.length === 1) return Array.from(words[0]).slice(0, 2).join('').toUpperCase();
    return (Array.from(words[0])[0] + Array.from(words[words.length - 1])[0]).toUpperCase();
  }

  /* ---- the pattern marker (NFR-04) ------------------------------------ */

  /*
    An SVG overlay per pattern, with the same geometry as PlayerPattern.covers: four
    vertical bars, bars at 45 degrees, a three-by-three lattice of discs, a four-by-four
    checkerboard, stacked chevrons, two curved bands, a single diagonal split.

    Drawn in the tone's own shade rather than in a second colour, so the marker reads as
    texture on the avatar and the initials keep their contrast.
  */
  function patternSvg(pattern, size, mark) {
    // A fresh id per avatar: two <pattern> elements sharing one id in the same
    // document would make every avatar wear the first one's pattern.
    var id = 'p' + Math.random().toString(36).slice(2, 9);
    var body = '';
    switch (pattern) {
      case 'STRIPES_VERTICAL':
        body = '<pattern id="' + id + '" width="25" height="100" patternUnits="userSpaceOnUse">'
          + '<rect width="12.5" height="100" fill="' + mark + '"/></pattern>';
        break;
      case 'STRIPES_DIAGONAL':
        body = '<pattern id="' + id + '" width="33.3" height="33.3" patternUnits="userSpaceOnUse"'
          + ' patternTransform="rotate(45)">'
          + '<rect width="16.6" height="33.3" fill="' + mark + '"/></pattern>';
        break;
      case 'DOTS':
        body = '<pattern id="' + id + '" width="33.3" height="33.3" patternUnits="userSpaceOnUse">'
          + '<circle cx="16.6" cy="16.6" r="10" fill="' + mark + '"/></pattern>';
        break;
      case 'CHECKS':
        body = '<pattern id="' + id + '" width="50" height="50" patternUnits="userSpaceOnUse">'
          + '<rect width="25" height="25" fill="' + mark + '"/>'
          + '<rect x="25" y="25" width="25" height="25" fill="' + mark + '"/></pattern>';
        break;
      case 'CHEVRONS':
        body = '<pattern id="' + id + '" width="33.3" height="25" patternUnits="userSpaceOnUse">'
          + '<path d="M0,25 L16.6,8 L33.3,25 L33.3,17 L16.6,0 L0,17 Z" fill="' + mark + '"/>'
          + '</pattern>';
        break;
      case 'WAVES':
        body = '<pattern id="' + id + '" width="100" height="50" patternUnits="userSpaceOnUse">'
          + '<path d="M0,25 Q25,5 50,25 T100,25 L100,42 Q75,22 50,42 T0,42 Z" fill="' + mark + '"/>'
          + '</pattern>';
        break;
      case 'HALF':
        body = '<pattern id="' + id + '" width="100" height="100" patternUnits="userSpaceOnUse">'
          + '<path d="M0,0 L100,0 L0,100 Z" fill="' + mark + '"/></pattern>';
        break;
      default:
        return '';
    }
    return '<svg class="pat" width="' + size + '" height="' + size + '" viewBox="0 0 100 100">'
      + '<defs>' + body + '</defs>'
      + '<circle cx="50" cy="50" r="50" fill="url(#' + id + ')"/></svg>';
  }

  /* ---- building a row -------------------------------------------------- */

  function buildRow() {
    var row = document.createElement('div');
    row.className = 'brow';
    row.innerHTML =
      '<div class="brank"></div>'
      + '<div class="bavatars"></div>'
      + '<div class="bmore"></div>'
      + '<div class="bname"></div>'
      + '<div class="bgap"></div>'
      + '<div class="btotal"></div>';
    return {
      el: row,
      rank: row.querySelector('.brank'),
      avatars: row.querySelector('.bavatars'),
      more: row.querySelector('.bmore'),
      name: row.querySelector('.bname'),
      gap: row.querySelector('.bgap'),
      total: row.querySelector('.btotal')
    };
  }

  function avatarHtml(member, metrics, size) {
    var label = memberLabel(member);
    var entry = entryFor(member.colorKey);
    var photo = thumbnailFor(member.playerId);
    /*
      The photo when it is in, the initials until then and if it never arrives. The fallback
      is not an error state: it is what a player without a photo always shows, and the board
      must read completely from the first message (TVR-01, SRD Phase 8 "Photos").
    */
    var inner = photo
      ? '<img class="bphoto" src="' + photo + '" alt="">'
      : '<span class="binitials" style="color:' + entry.on + '">'
        + initialsOf(label) + '</span>';
    /*
      font-size on the avatar itself, so the initials (0.5em) scale with it. Without this
      they inherited the page default and drew at 8 px inside a 47 px circle - invisible,
      which the first frame showed at once.
    */
    return '<span class="bavatar" style="width:' + size + 'px;height:' + size + 'px;'
      + 'font-size:' + size + 'px;background:' + entry.tone + '">' + inner
      + patternSvg(member.pattern, size, entry.shade) + '</span>';
  }

  function fillRow(cells, competitor, state, metrics, frameHeight) {
    var unit = frameHeight / 100;
    var avatarSize = Math.round(metrics.avatarPct * unit);

    cells.rank.firstChild.nodeValue = String(competitor.rank);
    cells.rank.className = 'brank' + (competitor.isLeader ? ' bleader' : '');

    var members = competitor.members || [];
    var shown = members.slice(0, MAX_AVATARS);
    var hidden = members.length - shown.length;
    var html = '';
    var i;
    for (i = 0; i < shown.length; i++) {
      html += avatarHtml(shown[i], metrics, avatarSize);
    }
    cells.avatars.innerHTML = html;
    /*
      "+n" outside the ring, not inside it. Inside, it sat on the last avatar and the team of
      five read as one run of letters, then as an unreadable mark when it was shrunk - both
      visible in the teams frame.
    */
    cells.more.firstChild.nodeValue = hidden > 0 ? STRINGS.moreMembers(hidden) : '';
    cells.more.style.fontSize = Math.round(metrics.gapPct * unit) + 'px';
    /*
      A team's avatars overlap inside a ring in the team's own colour, so the grouping is
      something you see from across the room rather than work out from the name (Phase 7a).
      A competitor of one is drawn plain: a ring the same colour as the single avatar inside
      it says nothing.
    */
    if (members.length > 1) {
      cells.avatars.className = 'bavatars bteam';
      cells.avatars.style.borderColor = toneFor(competitor.colorKey);
      cells.avatars.style.marginRight = Math.round(avatarSize / 4) + 'px';
    } else {
      cells.avatars.className = 'bavatars';
      cells.avatars.style.borderColor = 'transparent';
      cells.avatars.style.marginRight = '0';
    }

    cells.name.firstChild.nodeValue = truncate(competitor.name, metrics.nameChars);
    cells.total.firstChild.nodeValue = formatScore(competitor.total, state.decimalPlaces);

    /*
      RNK-04 and RNK-08 on the same line as the total, not stacked under it: a second line
      under a 54 px number does not survive six rows in a 720 px frame, and stacking it is
      what clipped the bottom row in the first build of the phone's version.
    */
    var gapText = '';
    if (!competitor.isLeader) {
      var behind = formatScore(competitor.gapToLeader, state.decimalPlaces);
      var above = competitor.gapToPlaceAbove;
      var rankAbove = competitor.rankAbove;
      if (metrics.showsPlaceAbove && above !== null && above !== undefined
        && rankAbove && rankAbove > 1) {
        gapText = STRINGS.behindBoth(
          behind, formatScore(above, state.decimalPlaces), rankAbove
        );
      } else {
        gapText = STRINGS.behindLeader(behind);
      }
    }
    cells.gap.firstChild.nodeValue = gapText;
  }

  /* ---- drawing --------------------------------------------------------- */

  function draw(state) {
    if (!root || !state) return;
    var rows = state.competitors || [];
    var metrics = rows.length <= ONE_COLUMN_LIMIT ? METRICS.few : METRICS.many;
    var frameHeight = (frame && frame.clientHeight > 0) ? frame.clientHeight : 720;
    var unit = frameHeight / 100;

    root.className = 'bboard cols' + metrics.columns;

    /* Rows are reused, never rebuilt, so twelve rows cost twelve text writes. */
    while (rowPool.length < rows.length) {
      var made = buildRow();
      made.rank.appendChild(document.createTextNode(''));
      made.more.appendChild(document.createTextNode(''));
      made.name.appendChild(document.createTextNode(''));
      made.gap.appendChild(document.createTextNode(''));
      made.total.appendChild(document.createTextNode(''));
      rowPool.push(made);
    }

    var perColumn = Math.ceil(rows.length / metrics.columns);
    var columns = root.querySelectorAll('.bcol');
    if (columns.length !== metrics.columns) {
      root.innerHTML = '';
      var c;
      for (c = 0; c < metrics.columns; c++) {
        var column = document.createElement('div');
        column.className = 'bcol';
        root.appendChild(column);
      }
      columns = root.querySelectorAll('.bcol');
      drawn = 0;
    }

    var index;
    for (index = 0; index < rows.length; index++) {
      var cells = rowPool[index];
      var target = columns[Math.floor(index / perColumn)] || columns[0];
      if (cells.el.parentNode !== target) target.appendChild(cells.el);
      cells.el.style.display = '';
      cells.el.style.setProperty('--rank-w', Math.round(metrics.rankWidthPct * unit) + 'px');
      cells.rank.style.fontSize = Math.round(metrics.rankPct * unit) + 'px';
      cells.name.style.fontSize = Math.round(metrics.namePct * unit) + 'px';
      cells.gap.style.fontSize = Math.round(metrics.gapPct * unit) + 'px';
      cells.total.style.fontSize = Math.round(metrics.totalPct * unit) + 'px';
      fillRow(cells, rows[index], state, metrics, frameHeight);
    }
    for (index = rows.length; index < rowPool.length; index++) {
      rowPool[index].el.style.display = 'none';
    }
    drawn = rows.length;
  }

  return {
    configure: configure,
    draw: draw,
    metricsFor: function (count) {
      return count <= ONE_COLUMN_LIMIT ? METRICS.few : METRICS.many;
    },
    formatScore: formatScore,
    truncate: truncate
  };
}());
