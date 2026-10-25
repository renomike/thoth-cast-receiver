# Thoth Cast receiver

The Google Cast **custom web receiver** for *Thoth — Keeper of Scores*. It is the
page the Chromecast loads so the TV can show the live scoreboard while the phone
stays on score entry (SRD D-006 step 2, Phase 8).

This is **v0.2, Phase 8b**. It starts the receiver context, registers the custom
namespace, applies the payload rules — schema version checked, out-of-order
messages dropped, thumbnails cached by player id — and puts what arrived on
screen. It does **not** draw a scoreboard yet: that is Phase 8c.

The receiver never works out what changed. The phone detects every event against
the last state it *sent* and puts them in the message; a second detector here, in
another language, would drift from the Kotlin one (SRD D-008, D-013, TVR-02).

The app source and the SRD are deliberately **not** in this repository: GitHub
Pages needs a public repo, and this one must hold nothing but the page. It holds
no game data, and nothing is ever sent to it except the page request itself
(SRD NFR-08).

## Files

| File | What it is |
|---|---|
| `index.html` | The receiver page. **This is the URL registered in the Cast console.** |
| `receiver.js` | Starts `CastReceiverContext`, registers the namespace, reports state. |
| `messages.js` | The payload rules: schema check, out-of-order drop, thumbnail cache. Shared by the TV and the harness. |
| `layout.js` | The markup, shared by every page so they cannot drift apart. |
| `debug.js` | The switch for the frame-time readout. Off unless asked for. |
| `style.css` | All styling, in frame-relative units so one sheet serves the TV and the harness. |
| `replay.html`, `replay.js`, `replay.css` | The desktop replay harness. |
| `feed.json` | A recorded feed of real messages. Produced by the app, not written by hand. |
| `stress.html`, `stress-page.js`, `stress.js` | The motion stress loop, kept from 8a. |

Everything except Google's `cast_receiver_framework.js` is served from here.
Google requires that one file to come from `gstatic.com` and forbids
self-hosting it; there is no CDN font or script of any other kind.

**JavaScript level.** 8a assumed the gen-1 Chromecast's engine was about Chrome 31 and wrote
everything in ES5. The device's own user agent, read off Mike's TV, says
**Chrome 70.0.3538.47 (CrKey 1.36.159268)**, so ES2015 and CSS custom properties are allowed
from 8b on. Anything newer than Chrome 70 is still avoided: no optional chaining, no nullish
coalescing, no `Object.fromEntries`. `stress.js` stays as its original ES5, because it is
already proved on the dongle and rewriting working code buys nothing.

## What is on screen

`index.html`, on the TV:

- **Right, top:** receiver state - whether the Cast SDK loaded, the context, the namespace,
  connected senders, how many state messages arrived and the latest sequence number, the
  board's size and round, the events in the last message, how many thumbnails are cached,
  and how many messages were dropped as out of order or refused. Below it the **user agent**
  and viewport, which is how the Chromecast model and the age of its browser get recorded.
- **Left:** empty in 8b. Drawing the board is Phase 8c.
- A dashed rectangle marks the **5% title-safe margin**. If its edges are off the screen,
  the TV is overscanning.
- **The frame-time readout is off by default** from 8b. See below.

## The replay harness

`replay.html` drives the receiver from `feed.json` with no Chromecast and no phone. It is
the only way to watch the receiver react to a game without borrowing the TV.

Serve this folder over HTTP - `file://` blocks the fetch of `feed.json`:

```
cd C:\Users\mi-ke\source\thoth-cast-receiver
python -m http.server 8731
```

then open <http://127.0.0.1:8731/replay.html>.

- The frame is fixed at **1280 x 720**, the Chromecast's own viewport, and scaled to the
  window rather than reflowed. A layout judged at a desktop window size would be a layout
  for a screen that does not exist.
- **Play / Pause / Step / Restart**, and 0.5x to 4x.
- **Resend last** replays the previous message. The receiver must ignore it, because its
  sequence is no longer ahead of the highest drawn - that is what stops a lead change being
  celebrated twice. The log says `(correct)`, or shouts if it was not.
- **Reconnect** throws away everything the receiver knows, as a real reconnect does. The
  next state then arrives as a full board with no events.
- The log, newest first, shows every message, its sequence, and what the receiver did
  with it.

**`feed.json` is generated, not written.** It comes from the app's own
`CastFeedRecordingTest`, which plays a six-player game through the real sender and records
the bytes, so the harness replays what the phone actually sends. To refresh it after the
payload changes, from the Thoth repo:

```
.\gradlew.bat :app:testDebugUnitTest --tests "*CastFeedRecordingTest*"
copy app\build\reports\cast-feed.json ..\thoth-cast-receiver\feed.json
```

## The frame-time readout

Off by default from 8b. It costs frames on the 2013 Chromecast - 8a's own measurement was
taken with it on screen - so leaving it up would make every later measurement pessimistic.

- On a desktop: add `?debug=1`, for example `replay.html?debug=1`.
- `stress.html` always shows it; measuring the motion is that page's whole purpose.

### Turning the readout on for a TV measurement

A Chromecast loads exactly the URL registered in the Cast console, and the sender cannot add
to it, so this is the only route:

1. <https://cast.google.com/publish> - the Thoth application - **Edit**.
2. Change the receiver URL to
   `https://renomike.github.io/thoth-cast-receiver/index.html?debug=1`
3. Save, **wait 15 minutes**, and power-cycle the Chromecast.
4. Take the measurement. The readout appears, and so does the motion stress loop.
5. Put the URL back to `https://renomike.github.io/thoth-cast-receiver/` afterwards, with
   the same 15-minute wait and power cycle.

## The motion budget

Set from what Mike's own Chromecast managed in 8a (19.5 fps, worst frame 334 ms, verdict
STUTTERING, Mike's eye: "pretty okay"), because he is keeping the dongle. From the SRD:

- Rank slides and total count-ups are always on, `transform` and `opacity` only - never
  layout, blur, shadow or gradient animation.
- A lead change is the crown moving plus **at most 12 confetti pieces, once per lead
  change**, droppable if the readout fails.
- All motion still ends within **3 s** (TV-03).
- Designed for the **1280 x 720** viewport, in frame-relative units, not the phone's dp.
- The DOM stays small: rows are reused, not rebuilt, and thumbnails are decoded once.
- **8d's acceptance:** no frame over 100 ms in the motion window and a verdict of at least
  "some jank", on a six-competitor board and a twelve-competitor board, with Mike's eye the
  final judge. If it cannot hold that, effects go in the order confetti, then the count-up -
  never the rank slide, and never the legibility target.

`stress.js` still runs 6 rows and 24 confetti pieces, all motion ending at 2800 ms. It is
8a's measuring stick and is left as it was so the numbers stay comparable; the real board
built in 8c and 8d follows the budget above.

---

# Setting it up, and keeping it up to date

### Done already

1. **The repo** - <https://github.com/renomike/thoth-cast-receiver>, public, branch `main`.
   It has to be public: GitHub Pages on a private repo needs a paid plan.
2. **GitHub Pages** - *Deploy from a branch*, `main`, `/ (root)`, live at
   <https://renomike.github.io/thoth-cast-receiver/>. HTTPS is automatic, and a Chromecast
   will not load a receiver over plain HTTP.
3. **The Custom Receiver** - registered unpublished against that URL, with the Chromecast
   added by serial. Application ID **`F6ABF44A`**, Cast firmware 1.36.159268. It is in the
   app as a string resource, never as a literal in code.

Remember, for any change made in the Cast console (not for a code change here): registration
only takes effect after **15 minutes and a power cycle** of the Chromecast.

### Pushing a change to the TV

Pages redeploys on every push to `main`. There is nothing to click.

```
cd C:\Users\mi-ke\source\thoth-cast-receiver
git status
git add -A
git commit -m "what changed"
git push
```

Then:

1. Watch the deploy: the repo's **Actions** tab, or **Settings - Pages**, shows the build.
   It usually takes under a minute.
2. **Hard-reload** <https://renomike.github.io/thoth-cast-receiver/> in Chrome
   (Ctrl+Shift+R). Pages caches aggressively and a normal reload will show the old page.
3. To see it on the TV, **stop casting and start again** - the Chromecast loaded the old
   page and will not notice a new one. Launch it from
   <https://casttool.appspot.com/cactool/> with application ID `F6ABF44A`, or from Thoth's
   own Cast button once 8c has a board to show.

If the TV shows a stale page after all of that, pull the plug on the Chromecast for ten
seconds; its own cache is the last suspect.

### If the TV shows nothing

In order of likelihood:

1. The 15 minutes or the power cycle after a **console** change were skipped.
2. The Pages URL in the console does not exactly match the live one.
3. Pages has not finished deploying - check the Actions tab.
4. The serial number in the console has a typo.

`replay.html` and `stress.html` always work in a desktop browser, so if the pages themselves
are fine there, the problem is registration or caching, not the code.
