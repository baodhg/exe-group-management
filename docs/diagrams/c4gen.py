"""Hand-laid-out C4 diagrams (L1 System Context, L2 Container) rendered as SVG.

Usage: python c4gen.py <out_dir>
Writes fig1_c4_l1_context.svg and fig2_c4_l2_container.svg (UTF-8, no BOM).
Edit the texts in level1() / level2() and re-run to regenerate.
The diagram title lives in the Word caption (e.g. "Figure 2. Container diagram for
EXE Group Management System"). Both figures are sized for a portrait A4 page (15.9 cm wide),
and every connector is made of horizontal and vertical segments.
Text widths are measured with the Segoe UI font files (Windows) through Pillow.
"""
import math
import os
import sys
from xml.sax.saxutils import escape

from PIL import ImageFont

FONT = "'Segoe UI', Arial, Helvetica, sans-serif"
FONT_FILES = {"400": "segoeui.ttf", "600": "seguisb.ttf", "700": "segoeuib.ttf"}
FONT_DIR = os.path.join(os.environ.get("WINDIR", r"C:\Windows"), "Fonts")
_MEASURE = {}

# Classic C4 palette (c4model.com / Structurizr defaults)
PERSON_FILL, PERSON_STROKE = "#08427B", "#052E56"
SYSTEM_FILL, SYSTEM_STROKE = "#1168BD", "#0B4884"
CONT_FILL, CONT_STROKE = "#438DD5", "#2E6295"
CAP_FILL = "#6AA6E0"
EDGE = "#5B6573"
TEXT_DARK = "#1F2937"
TEXT_MUTED = "#4B5563"
BOUNDARY = "#8A94A6"

# Font sizes in SVG units (one set per diagram, so print sizes can be tuned per figure width).
FONTS = {
    "l2": {"name": 22, "pname": 20, "small": 17, "label": 17, "key": 16.5, "stroke": 1.8},
    "l1": {"name": 22, "pname": 21, "small": 17, "label": 17.5, "key": 16.5, "stroke": 1.8},
}


def text_width(text, size, weight="400"):
    if weight not in _MEASURE:
        _MEASURE[weight] = ImageFont.truetype(os.path.join(FONT_DIR, FONT_FILES[weight]), 100)
    return _MEASURE[weight].getlength(text) * size / 100


class Svg:
    def __init__(self, w, h, fonts):
        self.w, self.h, self.f = w, h, fonts
        self.parts = []
        self.labels = []  # drawn last, on top of the lines

    def add(self, s):
        self.parts.append(s)

    def text_block(self, cx, cy, lines, fill="#FFFFFF", background=False):
        """lines: list of (text, size, weight). The block is vertically centred on cy."""
        gap = 1.22
        heights = [size * gap for _, size, _ in lines]
        total = sum(heights)
        out = []
        if background:
            width = max(text_width(t, s_, w_) for t, s_, w_ in lines if t) + 10
            out.append(f'<rect x="{cx - width / 2:.1f}" y="{cy - total / 2 - 2:.1f}" width="{width:.1f}" '
                       f'height="{total + 4:.1f}" rx="3" fill="#FFFFFF"/>')
        y = cy - total / 2
        for (txt, size, weight), hgt in zip(lines, heights):
            y += hgt
            if txt:
                out.append(f'<text x="{cx:.1f}" y="{y - hgt * 0.24:.1f}" font-family="{FONT}" font-size="{size}" '
                           f'font-weight="{weight}" fill="{fill}" text-anchor="middle">{escape(txt)}</text>')
        (self.labels if background else self.parts).extend(out)

    def render(self):
        head = (
            f'<svg xmlns="http://www.w3.org/2000/svg" width="{self.w:.0f}" height="{self.h:.0f}" '
            f'viewBox="0 0 {self.w:.0f} {self.h:.0f}">'
            '<defs><marker id="arrow" viewBox="0 0 10 10" refX="9.5" refY="5" markerWidth="8" '
            'markerHeight="8" orient="auto-start-reverse">'
            f'<path d="M0,0 L10,5 L0,10 z" fill="{EDGE}"/></marker></defs>'
            f'<rect width="{self.w:.0f}" height="{self.h:.0f}" fill="#FFFFFF"/>'
        )
        return head + "".join(self.parts) + "".join(self.labels) + "</svg>"


# ---------- shapes ----------

def person(s, cx, cy, name_lines, desc_lines, w, h):
    f = s.f
    x, y = cx - w / 2, cy - h / 2
    r = 25
    s.add(f'<circle cx="{cx}" cy="{y - r + 10}" r="{r}" fill="{PERSON_FILL}" stroke="{PERSON_STROKE}" stroke-width="1.5"/>')
    s.add(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="24" fill="{PERSON_FILL}" stroke="{PERSON_STROKE}" stroke-width="1.5"/>')
    lines = [(t, f["pname"], "700") for t in name_lines] + [("[Person]", f["small"], "400")]
    if desc_lines:
        lines.append(("", 4, "400"))
        lines += [(d, f["small"], "400") for d in desc_lines]
    s.text_block(cx, cy + 2, lines)
    return dict(l=x, r=x + w, t=y - 2 * r + 10, b=y + h, cx=cx, cy=cy)


def box(s, cx, cy, w, h, name_lines, kind, tech, desc=(), fill=CONT_FILL, stroke=CONT_STROKE, split_tech=False):
    f = s.f
    x, y = cx - w / 2, cy - h / 2
    s.add(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="10" fill="{fill}" stroke="{stroke}" stroke-width="1.5"/>')
    lines = [(n, f["name"], "700") for n in name_lines]
    if tech and split_tech:
        lines += [(f"[{kind}:", f["small"], "400"), (f"{tech}]", f["small"], "400")]
    else:
        lines.append((f"[{kind}: {tech}]" if tech else f"[{kind}]", f["small"], "400"))
    if desc:
        lines.append(("", 6, "400"))
        lines += [(d, f["small"], "400") for d in desc]
    s.text_block(cx, cy, lines)
    return dict(l=x, r=x + w, t=y, b=y + h, cx=cx, cy=cy)


def database(s, cx, cy, w, h, name, tech):
    f = s.f
    x, y = cx - w / 2, cy - h / 2
    ry = 14
    s.add(
        f'<path d="M{x},{y + ry} L{x},{y + h - ry} A{w / 2},{ry} 0 0 0 {x + w},{y + h - ry} '
        f'L{x + w},{y + ry} A{w / 2},{ry} 0 0 0 {x},{y + ry} Z" fill="{CONT_FILL}" stroke="{CONT_STROKE}" stroke-width="1.5"/>'
    )
    s.add(f'<ellipse cx="{cx}" cy="{y + ry}" rx="{w / 2}" ry="{ry}" fill="{CAP_FILL}" stroke="{CONT_STROKE}" stroke-width="1.5"/>')
    s.text_block(cx, cy + ry * 0.7, [(name, f["pname"], "700"), ("[Container:", f["small"], "400"), (f"{tech}]", f["small"], "400")])
    return dict(l=x, r=x + w, t=y, b=y + h, cx=cx, cy=cy)


def stream(s, cx, cy, w, h, name_lines, tech, e=13):
    """Horizontal cylinder = queue / topic / stream (modelled as a container, per c4model.com)."""
    f = s.f
    x, y = cx - w / 2, cy - h / 2
    s.add(
        f'<path d="M{x + e},{y} L{x + w - e},{y} A{e},{h / 2} 0 0 1 {x + w - e},{y + h} '
        f'L{x + e},{y + h} A{e},{h / 2} 0 0 1 {x + e},{y} Z" fill="{CONT_FILL}" stroke="{CONT_STROKE}" stroke-width="1.5"/>'
    )
    s.add(f'<ellipse cx="{x + w - e}" cy="{cy}" rx="{e}" ry="{h / 2}" fill="{CAP_FILL}" stroke="{CONT_STROKE}" stroke-width="1.5"/>')
    lines = [(n, f["pname"], "700") for n in name_lines] + [("[Container:", f["small"], "400"), (f"{tech}]", f["small"], "400")]
    s.text_block(cx - e / 2, cy, lines)

    def left_at(yy):  # x of the rounded left end at height yy, so arrows touch the outline
        k = max(0.0, 1 - ((yy - cy) / (h / 2)) ** 2)
        return x + e - e * math.sqrt(k)

    return dict(l=x, r=x + w, t=y, b=y + h, cx=cx, cy=cy, left_at=left_at)


def boundary(s, x, y, w, h, name, kind):
    f = s.f
    s.add(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="12" fill="none" stroke="{BOUNDARY}" stroke-width="1.8" stroke-dasharray="10 7"/>')
    s.add(f'<text x="{x + 18}" y="{y + h - 18 - f["small"] * 1.2:.1f}" font-family="{FONT}" font-size="{f["label"] + 1}" font-weight="700" fill="{TEXT_DARK}">{escape(name)}</text>')
    s.add(f'<text x="{x + 18}" y="{y + h - 16:.1f}" font-family="{FONT}" font-size="{f["small"]}" fill="{TEXT_MUTED}">[{escape(kind)}]</text>')


def line(s, pts, asynchronous=False, arrow=True):
    d = "M" + " L".join(f"{x:.1f},{y:.1f}" for x, y in pts)
    dash = ' stroke-dasharray="9 6"' if asynchronous else ""
    head = ' marker-end="url(#arrow)"' if arrow else ""
    s.add(f'<path d="{d}" fill="none" stroke="{EDGE}" stroke-width="{s.f["stroke"]}"{dash}{head}/>')


def label_lines(s, intent, tech=None):
    lines = [(t, s.f["label"], "600") for t in intent]
    if tech:
        lines.append((f"[{tech}]", s.f["small"], "400"))
    return lines


def label_size(s, intent, tech=None):
    lines = label_lines(s, intent, tech)
    return max(text_width(t, sz, w) for t, sz, w in lines) + 10, sum(sz * 1.22 for _, sz, _ in lines) + 4


def label(s, at, intent=(), tech=None):
    s.text_block(at[0], at[1], label_lines(s, intent, tech), fill=TEXT_DARK, background=True)


def edge(s, pts, intent=(), tech=None, at=None, asynchronous=False):
    """Solid line = synchronous call, dashed line = asynchronous message (explained in the key)."""
    line(s, pts, asynchronous)
    if intent or tech:
        label(s, at, intent, tech)


def legend(s, x, y, items):
    f = s.f
    k = f["key"]
    s.add(f'<text x="{x}" y="{y}" font-family="{FONT}" font-size="{k + 1}" font-weight="700" fill="{TEXT_DARK}">Key</text>')
    yy = y + k * 0.7
    sw, sh = 34, k * 0.85
    for it in items:
        mid = yy + sh / 2
        if it == "person":
            s.add(f'<rect x="{x}" y="{yy}" width="{sw}" height="{sh}" rx="7" fill="{PERSON_FILL}"/>')
            txt = "Person"
        elif it == "system":
            s.add(f'<rect x="{x}" y="{yy}" width="{sw}" height="{sh}" rx="3" fill="{SYSTEM_FILL}"/>')
            txt = "Software System"
        elif it == "container":
            s.add(f'<rect x="{x}" y="{yy}" width="{sw}" height="{sh}" rx="3" fill="{CONT_FILL}"/>')
            txt = "Container"
        elif it == "database":
            s.add(f'<path d="M{x},{yy + 4} L{x},{yy + sh - 2} A{sw / 2},4 0 0 0 {x + sw},{yy + sh - 2} L{x + sw},{yy + 4} '
                  f'A{sw / 2},4 0 0 0 {x},{yy + 4} Z" fill="{CONT_FILL}"/>')
            s.add(f'<ellipse cx="{x + sw / 2}" cy="{yy + 4}" rx="{sw / 2}" ry="4" fill="{CAP_FILL}"/>')
            txt = "Container: database"
        elif it == "stream":
            s.add(f'<rect x="{x}" y="{yy}" width="{sw}" height="{sh}" rx="{sh / 2}" fill="{CONT_FILL}"/>')
            s.add(f'<ellipse cx="{x + sw - 5}" cy="{mid}" rx="5" ry="{sh / 2}" fill="{CAP_FILL}"/>')
            txt = "Container: message stream"
        elif it in ("sync", "rel"):
            s.add(f'<path d="M{x},{mid} L{x + sw - 2},{mid}" stroke="{EDGE}" stroke-width="{f["stroke"]}" marker-end="url(#arrow)"/>')
            txt = "Synchronous call [protocol]" if it == "sync" else "Relationship"
        elif it == "async":
            s.add(f'<path d="M{x},{mid} L{x + sw - 2},{mid}" stroke="{EDGE}" stroke-width="{f["stroke"]}" stroke-dasharray="6 4" marker-end="url(#arrow)"/>')
            txt = "Asynchronous event"
        s.add(f'<text x="{x + sw + 10}" y="{mid + k * 0.36:.1f}" font-family="{FONT}" font-size="{k}" fill="{TEXT_DARK}">{escape(txt)}</text>')
        yy += k * 1.35
    return yy


# Shared by L1 and L2 so the zoom-in stays consistent (same people, same relationship meaning).
PEOPLE = [
    (["Student /", "Team Leader"], ["EXE student;", "may lead a group"]),
    (["Lecturer"], ["Teaches EXE", "classes"]),
    (["Administrator"], ["System", "administrator"]),
]
REL_L1 = [["Forms & joins groups,", "reviews join requests"], ["Monitors grouping", "progress"], ["Manages users,", "classes & deadlines"]]
REL_L2 = [["Forms & joins", "groups, reviews", "join requests"], ["Monitors", "grouping", "progress"], ["Manages users,", "classes &", "deadlines"]]


# ---------- Level 2: Container ----------

def level2(stream_name=("Group", "Events"), stream_tech="Redis Stream"):
    s = Svg(0, 0, FONTS["l2"])
    f = s.f
    pad = 10
    fit = lambda *lines: max(text_width(t, sz, wt) for t, sz, wt in lines) + 2 * pad
    nm = lambda *t: [(x, f["name"], "700") for x in t]
    sm = lambda *t: [(x, f["small"], "400") for x in t]
    yTop, yMid, yBot = 140, 445, 775

    # people (left column)
    wP = fit(*[(t, f["pname"], "700") for n, _ in PEOPLE for t in n], *sm(*[t for _, d in PEOPLE for t in d]))
    xP = 6 + wP / 2
    ppl = [person(s, xP, y, n, d, w=wP, h=150 if len(n) > 1 else 124) for y, (n, d) in zip((yTop, yMid, yBot), PEOPLE)]

    # containers, left to right; gaps are sized to the labels that sit in them
    xb0 = ppl[1]["r"] + 16 + label_size(s, REL_L2[1])[0]                 # system boundary, left edge
    spa_desc, gw_desc = ["UI for all roles"], ["Routing,", "JWT check"]
    wSpa = fit(*nm("Single-Page"), *sm("[Container:", "React]", *spa_desc))
    wGw = fit(*nm("API Gateway"), *sm("[Container:", "YARP]", *gw_desc))
    svc_desc = {"ids": ["Users, roles, JWT"], "grp": ["Classes, groups,", "outbox & jobs"],
                "jrs": ["Join requests,", "consumer & jobs"]}
    wSvc = fit(*nm("Join Request"), *sm("[Container:", "ASP.NET Core]", *sum(svc_desc.values(), [])))
    wDb = max(text_width(t, f["pname"], "700") for t in ("IdentityDb", "GroupDb", "RequestDb")) + 24
    wSt = max(text_width(t, f["small"]) for t in ("[Container:", f"{stream_tech}]")) + 12 + 3 * 13

    api = (["Makes API", "calls"], "HTTPS")
    route = (["Routes by", "path prefix"], "HTTP")
    rw, pub, con = (["Reads &", "writes"], "SQL"), (["Publishes"], "Redis"), (["Consumes"], "Redis")
    xSpa = xb0 + 16 + wSpa / 2
    xGw = xSpa + wSpa / 2 + label_size(s, *api)[0] + 12 + wGw / 2
    jx = xGw + wGw / 2 + 22                                              # routing bus
    xSvc = jx + 50 + wSvc / 2
    gap4 = max(label_size(s, *rel)[0] for rel in (rw, pub, con)) + 12
    xData = xSvc + wSvc / 2 + gap4 + max(wDb, wSt) / 2

    spa = box(s, xSpa, yMid, wSpa, 160, ["Single-Page", "App"], "Container", "React", spa_desc, split_tech=True)
    gw = box(s, xGw, yMid, wGw, 144, ["API Gateway"], "Container", "YARP", gw_desc, split_tech=True)
    ids = box(s, xSvc, yTop, wSvc, 152, ["Identity", "Service"], "Container", "ASP.NET Core", svc_desc["ids"], split_tech=True)
    grp = box(s, xSvc, yMid, wSvc, 186, ["Group", "Service"], "Container", "ASP.NET Core", svc_desc["grp"], split_tech=True)
    jrs = box(s, xSvc, yBot, wSvc, 176, ["Join Request", "Service"], "Container", "ASP.NET Core", svc_desc["jrs"], split_tech=True)

    idb = database(s, xData, yTop, wDb, 120, "IdentityDb", "SQL Server")
    gdb = database(s, xData, yMid - 50, wDb, 120, "GroupDb", "SQL Server")
    evs = stream(s, xData, 608, wSt, 220, stream_name, stream_tech)
    rdb = database(s, xData, 812, wDb, 120, "RequestDb", "SQL Server")

    right = max(idb["r"], evs["r"]) + 14
    bottom = max(jrs["b"], rdb["b"]) + 62
    boundary(s, xb0, 26, right - xb0, bottom - 26, "EXE Group Management System", "Software System")

    # people -> single-page app: the top and bottom people enter from above / below
    lw = label_size(s, REL_L2[0])[0]
    edge(s, [(ppl[0]["r"], yTop), (xSpa, yTop), (xSpa, spa["t"])], REL_L2[0], None, (xSpa + 8 + lw / 2, (yTop + spa["t"]) / 2))
    lw = label_size(s, REL_L2[1])[0]
    edge(s, [(ppl[1]["r"], yMid), (spa["l"], yMid)], REL_L2[1], None, (ppl[1]["r"] + 8 + lw / 2, yMid - 8 - label_size(s, REL_L2[1])[1] / 2))
    lw = label_size(s, REL_L2[2])[0]
    edge(s, [(ppl[2]["r"], yBot), (xSpa, yBot), (xSpa, spa["b"])], REL_L2[2], None, (xSpa + 8 + lw / 2, (yBot + spa["b"]) / 2))

    # spa -> gateway
    edge(s, [(spa["r"], yMid), (gw["l"], yMid)], *api, ((spa["r"] + gw["l"]) / 2, yMid - 8 - label_size(s, *api)[1] / 2))

    # gateway -> services: one routing bus, one label next to it
    line(s, [(gw["r"], yMid), (jx, yMid)], arrow=False)
    line(s, [(jx, yTop), (jx, yBot)], arrow=False)
    s.add(f'<circle cx="{jx:.1f}" cy="{yMid}" r="5" fill="{EDGE}"/>')
    for target in (ids, grp, jrs):
        line(s, [(jx, target["cy"]), (target["l"], target["cy"])])
    rw_, rh_ = label_size(s, *route)
    label(s, (jx - 8 - rw_ / 2, (yTop + gw["t"]) / 2 + 20), *route)

    # join request service -> group service (synchronous gRPC)
    gx = grp["l"] + 26
    cw, _ = label_size(s, ["Checks group,", "adds member"], "gRPC")
    edge(s, [(gx, jrs["t"]), (gx, grp["b"])], ["Checks group,", "adds member"], "gRPC", (gx + 8 + cw / 2, (grp["b"] + jrs["t"]) / 2))

    # services -> their own databases
    mid = (grp["r"] + idb["l"]) / 2
    h3 = label_size(s, *rw)[1]
    edge(s, [(ids["r"], yTop), (idb["l"], yTop)], *rw, (mid, yTop - 8 - h3 / 2))
    edge(s, [(grp["r"], gdb["cy"]), (gdb["l"], gdb["cy"])], *rw, (mid, gdb["cy"] - 8 - h3 / 2))
    edge(s, [(jrs["r"], rdb["cy"]), (rdb["l"], rdb["cy"])], *rw, (mid, rdb["cy"] + 8 + h3 / 2))

    # asynchronous events: Group Service = producer, Join Request Service = consumer
    yp, yc = grp["b"] - 18, jrs["t"] + 16
    h2 = label_size(s, *pub)[1]
    edge(s, [(grp["r"], yp), (evs["left_at"](yp), yp)], *pub, (mid, yp - 8 - h2 / 2), asynchronous=True)
    edge(s, [(jrs["r"], yc), (evs["left_at"](yc), yc)], *con, (mid, yc + 8 + h2 / 2), asynchronous=True)

    key_bottom = legend(s, 8, ppl[2]["b"] + 44, ["person", "container", "database", "stream", "sync", "async"])
    s.w, s.h = right + 6, max(bottom, key_bottom) + 10
    return s


# ---------- Level 1: System Context ----------

def level1():
    s = Svg(900, 566, FONTS["l1"])
    xP = 112
    yPeople = [124, 304, 484]
    ppl = [person(s, xP, y, n, d, w=196, h=134 if len(n) > 1 else 118) for y, (n, d) in zip(yPeople, PEOPLE)]
    sysb = box(s, 712, 304, 330, 210, ["EXE Group", "Management System"], "Software System", None,
               ["Group formation, join", "requests and class", "monitoring for EXE courses"],
               fill=SYSTEM_FILL, stroke=SYSTEM_STROKE)
    xe = sysb["l"] + 70                       # the top and bottom people enter the system from above / below
    mid = (ppl[0]["r"] + xe) / 2
    edge(s, [(ppl[0]["r"], yPeople[0]), (xe, yPeople[0]), (xe, sysb["t"])], REL_L1[0], None, (mid, yPeople[0] - 30))
    edge(s, [(ppl[1]["r"], yPeople[1]), (sysb["l"], yPeople[1])], REL_L1[1], None, ((ppl[1]["r"] + sysb["l"]) / 2, yPeople[1] - 30))
    edge(s, [(ppl[2]["r"], yPeople[2]), (xe, yPeople[2]), (xe, sysb["b"])], REL_L1[2], None, (mid, yPeople[2] + 30))
    legend(s, 680, 456, ["person", "system", "rel"])
    return s


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "."
    os.makedirs(out, exist_ok=True)
    for name, diagram in (("fig2_c4_l2_container.svg", level2()), ("fig1_c4_l1_context.svg", level1())):
        with open(os.path.join(out, name), "w", encoding="utf-8", newline="\n") as f:
            f.write(diagram.render())
        print("wrote", name, f"({diagram.w:.0f} x {diagram.h:.0f})")
