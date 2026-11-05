"""Grouping workflow (DRAFT v3.2, for the lecturer's review): course phases, room states and the main rules.

Usage: python workflow.py <out_dir>   -> writes figA_grouping_workflow.svg (UTF-8, no BOM)
Connectors are orthogonal; text widths are measured with the Segoe UI font files through Pillow.
"""
import os
import sys
from xml.sax.saxutils import escape

from PIL import ImageFont

FONT = "'Segoe UI', Arial, Helvetica, sans-serif"
FONT_FILES = {"400": "segoeui.ttf", "600": "seguisb.ttf", "700": "segoeuib.ttf"}
FONT_DIR = os.path.join(os.environ.get("WINDIR", r"C:\Windows"), "Fonts")
_MEASURE = {}

TEXT, MUTED, EDGE, RULE = "#1F2937", "#4B5563", "#374151", "#D1D5DB"
FILL, STROKE = "#E3F0FB", "#2E6295"            # GroupDb colours of the ER diagrams
FS = {"head": 15, "state": 16, "sub": 12.5, "label": 13, "trigger": 12.5, "note": 12.5}


def text_width(text, size, weight="400"):
    if weight not in _MEASURE:
        _MEASURE[weight] = ImageFont.truetype(os.path.join(FONT_DIR, FONT_FILES[weight]), 100)
    return _MEASURE[weight].getlength(text) * size / 100


def wrap(text, size, width):
    lines, cur = [], ""
    for word in text.split(" "):
        trial = f"{cur} {word}".strip()
        if cur and text_width(trial, size) > width:
            lines.append(cur)
            cur = word
        else:
            cur = trial
    return lines + [cur]


class Svg:
    def __init__(self):
        self.parts, self.top = [], []

    def add(self, s, top=False):
        (self.top if top else self.parts).append(s)

    def text(self, x, y, s, size, weight="400", fill=TEXT, anchor="start", top=False):
        self.add(f'<text x="{x:.1f}" y="{y:.1f}" font-family="{FONT}" font-size="{size}" font-weight="{weight}" '
                 f'fill="{fill}" text-anchor="{anchor}">{escape(s)}</text>', top)

    def render(self, w, h):
        return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w:.0f}" height="{h:.0f}" viewBox="0 0 {w:.0f} {h:.0f}">'
                '<defs><marker id="arr" viewBox="0 0 10 10" refX="9.5" refY="5" markerWidth="7.5" markerHeight="7.5" '
                f'orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="{EDGE}"/></marker></defs>'
                f'<rect width="{w:.0f}" height="{h:.0f}" fill="#FFFFFF"/>' + "".join(self.parts) + "".join(self.top) + "</svg>")


def state(svg, cx, cy, name, sub=None, w=150):
    h = 58 if sub else 44
    x, y = cx - w / 2, cy - h / 2
    svg.add(f'<rect x="{x:.1f}" y="{y:.1f}" width="{w}" height="{h}" rx="14" fill="{FILL}" stroke="{STROKE}" stroke-width="1.6"/>')
    if sub:
        svg.text(cx, cy - 3, name, FS["state"], "700", TEXT, "middle")
        svg.text(cx, cy + 16, sub, FS["sub"], "400", MUTED, "middle")
    else:
        svg.text(cx, cy + FS["state"] * 0.35, name, FS["state"], "700", TEXT, "middle")
    return dict(l=x, r=x + w, t=y, b=y + h, cx=cx, cy=cy)


def arrow(svg, pts):
    d = "M" + " L".join(f"{x:.1f},{y:.1f}" for x, y in pts)
    svg.add(f'<path d="{d}" fill="none" stroke="{EDGE}" stroke-width="1.6" marker-end="url(#arr)"/>')


def label(svg, x, y, lines, anchor="middle", weight="600", size=None, fill=TEXT):
    """Block of lines with a white background; (x, y) = centre, or left / right edge for start / end."""
    size = size or FS["label"]
    lines = [lines] if isinstance(lines, str) else lines
    w = max(text_width(t, size, weight) for t in lines) + 8
    lh = size * 1.3
    h = lh * len(lines) + 2
    left = {"middle": x - w / 2, "start": x, "end": x - w}[anchor]
    svg.add(f'<rect x="{left:.1f}" y="{y - h / 2:.1f}" width="{w:.1f}" height="{h:.1f}" fill="#FFFFFF"/>', True)
    for i, t in enumerate(lines):
        svg.text(left + w / 2, y - h / 2 + 1 + lh * (i + 0.5) + size * 0.35, t, size, weight, fill, "middle", True)
    return w, h


def workflow():
    svg = Svg()
    m = 24

    # ---- 1. course phases ----
    svg.text(m, 30, "1. Course phase (whole class)", FS["head"], "700")
    phases = ["Setup", "Published", "Expired", "Finalized"]
    steps = [("Publish", "admin or PublishAt"), ("Expire", "admin or ExpireAt"), ("Finalize", "admin, all placed")]
    notes = [
        ["Admin imports students,", "generates ⌈n ÷ max size × k⌉", "rooms and sets group types;", "students rate skills 1–5"],
        ["Students join, leave and", "apply; room leaders lock,", "review applications and", "remove members"],
        ["Students are frozen;", "pending applications are", "rejected; the admin moves", "and places students"],
        ["Rooms become numbered", "official groups; students", "and the lecturer see", "the read-only list"],
    ]
    wp = 150
    gap = max(max(text_width(a, FS["label"], "600"), text_width(b, FS["trigger"])) for a, b in steps) + 34
    y1 = 74
    boxes = []
    for i, name in enumerate(phases):
        cx = m + wp / 2 + i * (wp + gap)
        boxes.append(state(svg, cx, y1, name, w=wp))
    for i, (verb, who) in enumerate(steps):
        a, b = boxes[i], boxes[i + 1]
        arrow(svg, [(a["r"], y1), (b["l"], y1)])
        mx = (a["r"] + b["l"]) / 2
        label(svg, mx, y1 - 14, verb)
        label(svg, mx, y1 + 15, who, weight="400", size=FS["trigger"], fill=MUTED)
    for bx, lines in zip(boxes, notes):
        for k, t in enumerate(lines):
            svg.text(bx["cx"], bx["b"] + 24 + k * 17, t, FS["note"], "400", MUTED, "middle")
    width = boxes[-1]["r"] + m

    ysep = boxes[0]["b"] + 24 + 4 * 17 + 10
    svg.add(f'<path d="M{m},{ysep:.1f} H{width - m:.1f}" stroke="{RULE}" stroke-width="1.2"/>')

    # ---- 2. room states ----
    y2 = ysep + 34
    svg.text(m, y2, "2. Room status", FS["head"], "700")
    yr = y2 + 92
    lock, unlock = "leader locks", ["leader unlocks or", "room becomes empty"]
    span = max(text_width(lock, FS["label"], "600"), max(text_width(t, FS["label"], "600") for t in unlock)) + 40
    x_open = m + 104 + 75
    op = state(svg, x_open, yr, "Open", "anyone may join")
    lk = state(svg, op["r"] + span + 75, yr, "Locked", "apply to join")
    arrow(svg, [(op["r"], yr - 11), (lk["l"], yr - 11)])
    label(svg, (op["r"] + lk["l"]) / 2, yr - 25, lock)
    arrow(svg, [(lk["l"], yr + 11), (op["r"], yr + 11)])
    label(svg, (op["r"] + lk["l"]) / 2, yr + 40, unlock)

    # the two statuses above hold while the course is Published or Expired (UML composite state);
    # a full room keeps its status, it simply has no free seat
    bx, by = op["l"] - 18, op["t"] - 40
    bw, bh = lk["r"] + 18 - bx, yr + 82 - by
    svg.add(f'<rect x="{bx:.1f}" y="{by:.1f}" width="{bw:.1f}" height="{bh:.1f}" rx="16" fill="none" '
            f'stroke="{STROKE}" stroke-width="1.4" stroke-dasharray="8 5"/>')
    svg.text(bx + bw - 14, by + 22, "course Published or Expired", FS["sub"], "600", STROKE, "end")
    svg.add(f'<circle cx="{m + 8}" cy="{yr}" r="7" fill="{EDGE}"/>')
    arrow(svg, [(m + 15, yr), (op["l"], yr)])
    label(svg, (m + 15 + bx) / 2, yr - 22, ["generated", "in Setup"], weight="400", size=11.5, fill=MUTED)

    yf = by + bh + 80
    xf = (op["cx"] + lk["cx"]) / 2
    fn = state(svg, xf, yf, "Finalized", "official group", w=170)
    arrow(svg, [(xf, by + bh), (xf, fn["t"])])
    label(svg, xf + 8, (by + bh + fn["t"]) / 2, ["course finalized", "(rooms with members)"], anchor="start")

    # ---- 3. rules ----
    xr = bx + bw + 52
    wr = width - m - xr
    svg.text(xr, y2 + 34, "Rules", FS["head"], "700")
    rules = [
        "The first student to join becomes the leader; if the leader leaves, the earliest member takes over.",
        "A student is in at most one room per course; joining a room cancels their other applications.",
        "Until the course expires, students may leave a room, and the leader may remove a member with "
        "a reason; a removed student cannot join or apply to that room again.",
        "Applications exist only for Locked rooms; the leader approves or rejects them. A full room "
        "takes no one until a seat frees up.",
        "Every join or approval keeps enough free seats for the majors the group type still needs "
        "(minimum per major, minimum number of different majors).",
        "A room is eligible when it has at least the minimum group size and the majors its group "
        "type requires.",
        "Skills are self-rated strengths (1–5): shown to students and leaders and used for room "
        "suggestions; they never block a join.",
        "Finalize needs every student in a room and every non-empty room eligible (the admin may accept "
        "an exception). Empty rooms are removed; the others become numbered official groups that "
        "nobody can leave.",
    ]
    y = y2 + 62
    for r in rules:
        lines = wrap(r, FS["note"], wr - 16)
        svg.add(f'<circle cx="{xr + 4}" cy="{y - 4.5:.1f}" r="2.6" fill="{TEXT}"/>')
        for k, t in enumerate(lines):
            svg.text(xr + 16, y + k * 17, t, FS["note"], "400", TEXT)
        y += len(lines) * 17 + 9
    svg.add(f'<path d="M{xr - 28:.1f},{y2 + 18:.1f} V{max(y, fn["b"]) - 4:.1f}" stroke="{RULE}" stroke-width="1.2"/>')

    height = max(y, fn["b"] + m)
    return svg.render(width, height)


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "."
    os.makedirs(out, exist_ok=True)
    with open(os.path.join(out, "figA_grouping_workflow.svg"), "w", encoding="utf-8", newline="\n") as f:
        f.write(workflow())
    print("wrote figA_grouping_workflow.svg")
