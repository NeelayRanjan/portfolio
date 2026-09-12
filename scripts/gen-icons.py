#!/usr/bin/env python3
"""gen-icons.py - the favicon set, from the owner's generator (2026-09-12).

Hand-run only (like gen-og.mjs). Needs: STIXTwoText[wght].ttf beside it (fetch:
https://github.com/google/fonts/raw/main/ofl/stixtwotext/STIXTwoText%5Bwght%5D.ttf
- not committed), and a venv with: pip install fonttools cairosvg.
Outputs land in out/; install as app/icon.svg, app/icon.png (32),
app/apple-icon.png (180), app/favicon.ico. Colors are the site tokens.
"""
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.boundsPen import BoundsPen
import cairosvg, os, struct

# neelayranjan.dev tokens: paper / ink / red-ink (stamp red)
BG, INK, RED = "#12110f", "#eae5da", "#e5352b"

f = instantiateVariableFont(TTFont("STIXTwoText.ttf"), {"wght": 600})
fb = instantiateVariableFont(TTFont("STIXTwoText.ttf"), {"wght": 700})
gs = f.getGlyphSet(); upm = f["head"].unitsPerEm
g = gs["N"]; adv = g.width
bp = BoundsPen(gs); g.draw(bp); xmin, ymin, xmax, ymax = bp.bounds

def n_path(size, cap_px):
    s = cap_px / (ymax - ymin)
    w = (xmax - xmin) * s
    tx = (size - w) / 2 - xmin * s
    ty = (size + cap_px) / 2 + ymin * s
    pen = SVGPathPen(gs)
    g.draw(TransformPen(pen, (s, 0, 0, -s, tx, ty)))
    return pen.getCommands()

def svg(size, brackets=True, rx=None, cap=0.66, bk=0.15, sw=None):
    rx = rx if rx is not None else round(size * 0.146, 2)
    sw = sw or max(1, round(size * 0.031, 2))
    L = size * bk; m = size * 0.104
    parts = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}" width="{size}" height="{size}">',
             f'<rect width="{size}" height="{size}" rx="{rx}" fill="{BG}"/>']
    if brackets:
        parts.append(f'<path d="M{m} {m+L}V{m}H{m+L}" fill="none" stroke="{RED}" stroke-width="{sw}" stroke-linecap="square"/>')
        parts.append(f'<path d="M{size-m} {size-m-L}V{size-m}H{size-m-L}" fill="none" stroke="{RED}" stroke-width="{sw}" stroke-linecap="square"/>')
    parts.append(f'<path d="{n_path(size, size*cap)}" fill="{INK}"/></svg>')
    return "".join(parts)

os.makedirs("out", exist_ok=True)
open("out/favicon.svg","w").write(svg(96, cap=0.56))
gs_main, g_main = gs, g
gs=fb.getGlyphSet(); g=gs["N"]; bp=BoundsPen(gs); g.draw(bp); xmin,ymin,xmax,ymax=bp.bounds
open("out/favicon-16.svg","w").write(svg(16, brackets=False, cap=0.72, rx=3))
gs,g=gs_main,g_main; bp=BoundsPen(gs); g.draw(bp); xmin,ymin,xmax,ymax=bp.bounds
open("out/favicon-32.svg","w").write(svg(32, cap=0.54, sw=2, bk=0.16))
for name, size, src in [("favicon-16.png",16,"favicon-16.svg"),("favicon-32.png",32,"favicon-32.svg"),
                        ("apple-touch-icon.png",180,"favicon.svg"),("icon-512.png",512,"favicon.svg")]:
    cairosvg.svg2png(url="out/"+src, write_to="out/"+name, output_width=size, output_height=size)
cairosvg.svg2png(url="out/favicon.svg", write_to="out/preview-96.png", output_width=96, output_height=96)

# PNG-in-ICO bundle (16 + 32), same approach as the old gen-icons.mjs
imgs = [(16, open("out/favicon-16.png","rb").read()), (32, open("out/favicon-32.png","rb").read())]
ico = struct.pack("<HHH", 0, 1, len(imgs))
offset = 6 + 16 * len(imgs)
entries, blobs = b"", b""
for size, data in imgs:
    entries += struct.pack("<BBBBHHII", size % 256, size % 256, 0, 0, 1, 32, len(data), offset)
    blobs += data; offset += len(data)
open("out/favicon.ico","wb").write(ico + entries + blobs)
print("ok:", ", ".join(sorted(os.listdir("out"))))
