# Thoth Cast receiver

The Google Cast **custom web receiver** for *Thoth — Keeper of Scores*. It is the
page the Chromecast loads so the TV can show the live scoreboard while the phone
stays on score entry (SRD D-006 step 2, Phase 8).

This is **v0, the Phase 8a skeleton**. It starts the receiver context, declares
the custom namespace, puts the receiver state on screen, and runs a motion stress
loop so the 2013 Chromecast can be judged. It does not yet draw a real scoreboard
from a message — that is Phase 8b onward.

The app source and the SRD are deliberately **not** in this repository: GitHub
Pages needs a public repo, and this one must hold nothing but the page. It holds
no game data, and nothing is ever sent to it except the page request itself
(SRD NFR-08).

## Files

| File | What it is |
|---|---|
| `index.html` | The receiver page. **This is the URL that goes in the Cast console.** |
| `stress.html` | The same page without the Cast SDK, for checking the motion in a desktop browser. |
| `layout.js` | The markup, shared by both pages so they cannot drift apart. |
| `receiver.js` | Starts `CastReceiverContext`, declares the namespace, reports state. |
| `stress.js` | The motion loop and the frame-time readout. The motion budget is the constants at the top. |
| `style.css` | All styling. No web font is loaded. |

Everything except Google's `cast_receiver_framework.js` is served from here.
Google requires that one file to come from `gstatic.com` and forbids
self-hosting it; there is no CDN font or script of any other kind.

## What is on screen

- **Left:** six rows that reorder, totals that count up, a crown on the leader
  and a confetti burst — the motion the real scoreboard will need.
- **Right, top:** receiver state — whether the Cast SDK loaded, whether the
  context started, the namespace, connected senders, and the last message.
  It also prints the **user agent** and viewport, which is how the Chromecast
  model and the age of its browser engine get recorded.
- **Right, bottom:** frame times, measured only during the motion window so the
  still pause between cycles does not flatter the average. `SMOOTH` /
  `SOME JANK` / `STUTTERING` is the verdict for the last cycle, and
  **Worst seen** is the worst across every cycle since the page loaded.
- A dashed rectangle marks the **5% title-safe margin**. If its edges are off the
  screen, the TV is overscanning.

## The motion budget

In `stress.js`, at the top:

- 6 rows, 24 confetti pieces (a hard cap).
- Rows slide 600 ms, totals count up over 1500 ms, the crown fades at 600 ms,
  confetti starts at 1200 ms and lasts 1600 ms.
- **All motion ends at 2800 ms**, inside TV-03's 3 s. The cycle then holds still
  until 4500 ms and starts again.
- Transforms and opacity only. Nothing animates width, height, position or
  colour.

Written in **ES5** throughout — no `let`/`const`, arrow functions, template
literals or classes — because the 2013 Chromecast's browser engine is roughly
Chrome 31. For the same reason there are no CSS custom properties.

---

# Mike: setting this up

### 1. The repo — done (2026-10-24)

<https://github.com/renomike/thoth-cast-receiver>, public, branch `main`. It has
to be public: GitHub Pages on a private repo needs a paid plan.

### 2. GitHub Pages — done (2026-10-24)

*Deploy from a branch*, `main`, `/ (root)`. The live URL is:

```
https://renomike.github.io/thoth-cast-receiver/
```

Open it in Chrome on your PC. You should see the board animating and, on the
right, **Cast SDK: loaded** and **Context: started**. The context will not reach
*ready* outside a real Cast session — that is expected, not a fault.

HTTPS matters: a Chromecast will not load a receiver over plain HTTP. Pages is
HTTPS already, so there is nothing to configure.

### 3. Register the receiver and the Chromecast

At the Cast developer console, <https://cast.google.com/publish>, signed in with
the account that paid the $5 fee:

1. **Add new application → Custom Receiver.**
   - *Name:* `Thoth — Keeper of Scores`
   - *Receiver application URL:* `https://renomike.github.io/thoth-cast-receiver/`
     (the trailing slash is fine; it serves `index.html`)
   - Leave *Guest Mode* off, and leave it **unpublished** — family use only
     (SRD Phase 8, "Hosting").
   - Save. The console shows an **Application ID**, eight hex characters.
2. **Cast Receiver Devices → Add new device.** Enter the Chromecast's
   **serial number** exactly as the Google Home app shows it (Home → the
   Chromecast → gear icon → *Device information*; use the **Cast** serial, not
   the one on the dongle's case if they differ).
3. Then **wait 15 minutes**, and after that **power-cycle the Chromecast**
   (unplug its power for ten seconds). Registration does not take effect until
   both have happened — this is Google's documented behaviour and it is the most
   common reason a custom receiver shows a blank screen.

### 4. Send Claude Code the application ID

Reply with:

- the **application ID** from step 3,
- the **Pages URL** from step 2 (confirming it matches the one registered),
- the Chromecast's **model and serial** as the Google Home app shows them, so the
  H2G2-42 identification is confirmed from the device rather than from retail
  listings.

### 5. Put it on the TV and watch it

No Thoth app build is needed for this — Phase 8a adds no code to the app. Use
Google's own tool as the sender:

1. On your PC, in **Chrome** (not Edge), open the Cast Command and Control tool:
   <https://casttool.appspot.com/cactool/>
2. Put the **application ID** in *Receiver Application ID* and press
   **Set App ID**.
3. Click the **Cast** button and pick the Chromecast.
4. The TV should load the page: *Thoth receiver v0*, the board animating, and
   the state panel on the right.

Then watch it for a couple of minutes and note:

- Does it load at all, and how long does it take?
- Is the dashed title-safe rectangle fully on screen, or is the TV cutting the
  edges off (overscan)?
- **Does the motion stutter?** Watch the rows sliding and the confetti, and read
  the **Worst seen** line and the verdict.
- Photograph the screen, including the right-hand panels — the **user agent**
  line and the frame-time numbers are the two things Phase 8a needs from the
  device.
- Does the Chromecast drop the page after a few minutes of no messages? It should
  not (`disableIdleTimeout` is set), but that is exactly the kind of thing the
  2013 device may get wrong.

If it stutters badly, that is a result, not a failure: the SRD says the motion
budget is set from what this device can actually hold, and the decision between
simpler effects and a newer Cast device is yours.

### If the TV shows nothing

In order of likelihood:

1. The 15 minutes or the power cycle in step 3 were skipped.
2. The serial number has a typo, or it is the wrong serial.
3. The Pages URL in the console does not exactly match the live one.
4. Pages has not finished its first deploy — check Settings → Pages again.

`stress.html` always works in a desktop browser, so if the page itself is fine
there, the problem is registration, not the page.
