"""Build static instances of Atkinson Hyperlegible Next with an unslashed zero.

The original zero is one outer contour plus two half-counters split by the slash.
The two halves are replaced by one counter: the outer contour scaled towards the
glyph centre so that the stroke keeps the original side and top thicknesses.
"""
import sys
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools.ttLib.tables._g_l_y_f import GlyphCoordinates

src, outdir = sys.argv[1], sys.argv[2]
for wght in (400, 600, 700):
    f = TTFont(src)
    f = instancer.instantiateVariableFont(f, {"wght": wght}, updateFontNames=False)
    glyf = f["glyf"]
    g = glyf["zero"]
    coords = list(g.coordinates)
    ends = list(g.endPtsOfContours)
    flags = list(g.flags)
    o_end = ends[0]
    outer = coords[: o_end + 1]
    counter = coords[o_end + 1 :]
    ox = [p[0] for p in outer]; oy = [p[1] for p in outer]
    cx = [p[0] for p in counter]; cy = [p[1] for p in counter]
    cxm, cym = (min(ox) + max(ox)) / 2, (min(oy) + max(oy)) / 2
    sx = (max(cx) - min(cx)) / (max(ox) - min(ox))
    sy = (max(cy) - min(cy)) / (max(oy) - min(oy))
    inner = [(round(cxm + (x - cxm) * sx), round(cym + (y - cym) * sy)) for x, y in outer]
    inner_flags = list(flags[: o_end + 1])
    inner.reverse(); inner_flags.reverse()  # counters run the other way
    g.coordinates = GlyphCoordinates(outer + inner)
    # Keep only the on-curve bit; other bits (e.g. overlap) are only valid on the first point.
    g.flags = bytearray([fl & 0x01 for fl in flags[: o_end + 1] + inner_flags])
    g.endPtsOfContours = [o_end, o_end + len(inner)]
    g.numberOfContours = 2
    g.program = type(g.program)()  # drop hinting for this glyph
    g.recalcBounds(glyf)
    name = f["name"]
    for rec in name.names:
        s = rec.toUnicode()
        if "Atkinson Hyperlegible Next" in s:
            rec.string = s.replace("Atkinson Hyperlegible Next", "Passayge Text")
        elif "AtkinsonHyperlegibleNext" in s:
            rec.string = s.replace("AtkinsonHyperlegibleNext", "PassaygeText")
    out = f"{outdir}/PassaygeText-{wght}.ttf"
    f.save(out)
    print("wrote", out, "sx=%.3f sy=%.3f" % (sx, sy))
