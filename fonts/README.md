# Fonts

The same two faces the phone uses, so the TV and the phone are one piece of design:

| File | Face | Used for |
|---|---|---|
| `source-sans-3.woff2` | Source Sans 3, variable weight 200–900 | names, totals, gaps, initials, the round label |
| `marcellus.woff2` | Marcellus, regular | the game's name |

**Served from this repository, never from a CDN** (SRD Phase 8, "Hosting"). Google's Cast
receiver framework is the one file loaded from elsewhere, because Google requires it.

Both are under the **SIL Open Font License 1.1**; the licences sit beside them here
(`OFL-SourceSans3.txt`, `OFL-Marcellus.txt`), as the OFL asks.

## How they were made

Subset from the app's own `app/src/main/res/font/*.ttf` — not downloaded, so the TV cannot
drift to a different cut of the face than the phone draws:

```
python subset_fonts.py <thoth>/app/src/main/res/font <this folder>
```

Latin plus digits plus the marks the board prints (the middot in "12 behind · 4 to 2", the
ellipsis truncation adds). 646 KB becomes 23 KB, and 46 KB becomes 14 KB — which matters,
because the Chromecast fetches them over the home Wi-Fi every time the receiver loads.

Source Sans 3's **weight axis is kept**, so one file serves 400 and 700; Chrome 70, which
the Chromecast reports, supports variable fonts.
