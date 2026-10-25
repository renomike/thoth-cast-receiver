"""Subset the app's own font files to WOFF2 for the Cast receiver (8c closing item 1).

The receiver must draw the same faces as the phone, and it must draw them from its own
repository - a CDN is out (SRD Phase 8, "Hosting"). These are the very files the app bundles
(app/src/main/res/font), subset to Latin and digits so the TV loads kilobytes, not hundreds
of them, over the home network.

Source Sans 3 is a variable font and its weight axis is kept, so the board can ask for 400
and 700 from one file. Chrome 70, which the Chromecast reports, supports variable fonts.
"""
import os
import sys
from fontTools import subset

# Google's "latin" subset plus the few marks the board actually prints: the middot in
# "12 behind · 4 to 2", the ellipsis truncation adds, and the en/em dashes.
UNICODES = (
    "U+0020-007E,U+00A0-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,"
    "U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD"
)


def shrink(source, target, keep_variations):
    args = [
        source,
        f"--unicodes={UNICODES}",
        "--flavor=woff2",
        f"--output-file={target}",
        "--layout-features=kern,liga,tnum,lnum",
        "--no-hinting",
        "--desubroutinize",
        "--name-IDs=0,1,2,3,4,5,6",
    ]
    if not keep_variations:
        args.append("--drop-tables+=fvar,gvar,avar,STAT,HVAR,MVAR")
    subset.main(args)
    before = os.path.getsize(source)
    after = os.path.getsize(target)
    print(f"  {os.path.basename(target):<28} {before:>7} -> {after:>6} bytes "
          f"({after * 100 // before}%)")


if __name__ == "__main__":
    src, out = sys.argv[1], sys.argv[2]
    os.makedirs(out, exist_ok=True)
    shrink(os.path.join(src, "source_sans3_variable.ttf"),
           os.path.join(out, "source-sans-3.woff2"), keep_variations=True)
    shrink(os.path.join(src, "marcellus_regular.ttf"),
           os.path.join(out, "marcellus.woff2"), keep_variations=False)
