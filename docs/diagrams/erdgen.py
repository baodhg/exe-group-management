"""Hand-laid-out ER diagrams (conceptual + one physical diagram per database) rendered as SVG.

Usage: python erdgen.py <out_dir>
Writes fig3_conceptual_erd.svg and fig4-fig6 physical diagrams, one per database (GroupDb in two parts: 5a, 5b).
Tables, columns and keys come from spec.py; this file only sets positions and connector routes.
Connectors are orthogonal (horizontal and vertical segments) with crow's-foot cardinality marks.
Text widths are measured with the Segoe UI font files (Windows) through Pillow.
"""
import math
import os
import sys
from xml.sax.saxutils import escape

from PIL import ImageFont

import spec

FONT = "'Segoe UI', Arial, Helvetica, sans-serif"
FONT_FILES = {"400": "segoeui.ttf", "600": "seguisb.ttf", "700": "segoeuib.ttf"}
FONT_DIR = os.path.join(os.environ.get("WINDIR", r"C:\Windows"), "Fonts")
_MEASURE = {}

TEXT, MUTED, EDGE, ZEBRA = "#1F2937", "#4B5563", "#374151", "#F6F8FB"
# database / bounded context -> (fill, stroke, header fill)
CONTEXT = {
    "IdentityDb": ("#FDF0E1", "#B45309", "#F8DCB8"),
    "GroupDb": ("#E3F0FB", "#2E6295", "#C6DBF1"),
    "ChatDb": ("#F3EAFD", "#7C3AED", "#E2D2FA"),
}
TYPE_ALIAS = {"uniqueidentifier": "guid"}
NO_FK_REFS = {("GroupDb", "OutboxEvents", "AggregateId"): "course, room or request id (no FK)"}

# physical diagrams: font sizes and table metrics (SVG units)
PF = {"title": 15, "row": 14, "key": 12.5, "note": 13, "label": 13, "legend": 13}
ROW_H, HEAD_H, PADX, GAP = 24, 30, 10, 12
# conceptual diagram
CF = {"entity": 16, "label": 13.5, "legend": 13.5}


def text_width(text, size, weight="400"):
    if weight not in _MEASURE:
        _MEASURE[weight] = ImageFont.truetype(os.path.join(FONT_DIR, FONT_FILES[weight]), 100)
    return _MEASURE[weight].getlength(text) * size / 100


class Svg:
    def __init__(self):
        self.parts, self.overlay = [], []  # overlay = labels, drawn on top of the connectors

    def add(self, s, overlay=False):
        (self.overlay if overlay else self.parts).append(s)

    def text(self, x, y, s, size, weight="400", fill=TEXT, anchor="start", overlay=False):
        self.add(f'<text x="{x:.1f}" y="{y:.1f}" font-family="{FONT}" font-size="{size}" font-weight="{weight}" '
                 f'fill="{fill}" text-anchor="{anchor}">{escape(s)}</text>', overlay)

    def render(self, w, h):
        return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w:.0f}" height="{h:.0f}" viewBox="0 0 {w:.0f} {h:.0f}">'
                f'<rect width="{w:.0f}" height="{h:.0f}" fill="#FFFFFF"/>' + "".join(self.parts)
                + "".join(self.overlay) + "</svg>")


class Box:
    def __init__(self, x, y, w, h):
        self.x, self.y, self.w, self.h = x, y, w, h

    l = property(lambda s: s.x)
    r = property(lambda s: s.x + s.w)
    t = property(lambda s: s.y)
    b = property(lambda s: s.y + s.h)
    cx = property(lambda s: s.x + s.w / 2)
    cy = property(lambda s: s.y + s.h / 2)


# ---------- connectors ----------

def cardinality(svg, p, q, kind):
    """Crow's-foot mark at p (on the box edge); q is the next point of the connector."""
    dx, dy = q[0] - p[0], q[1] - p[1]
    n = math.hypot(dx, dy)
    ux, uy = dx / n, dy / n
    px, py = -uy, ux

    def at(d, off):
        return p[0] + ux * d + px * off, p[1] + uy * d + py * off

    def seg(a, b):
        svg.add(f'<path d="M{a[0]:.1f},{a[1]:.1f} L{b[0]:.1f},{b[1]:.1f}" stroke="{EDGE}" stroke-width="1.5" fill="none"/>')

    def circle(d):
        c = at(d, 0)
        svg.add(f'<circle cx="{c[0]:.1f}" cy="{c[1]:.1f}" r="4.5" fill="#FFFFFF" stroke="{EDGE}" stroke-width="1.5"/>')

    if kind == "one":  # exactly one
        for d in (9, 15):
            seg(at(d, -7), at(d, 7))
    elif kind == "zero_one":
        seg(at(9, -7), at(9, 7))
        circle(19)
    elif kind == "many":  # zero or many
        for off in (-8, 0, 8):
            seg(at(0, off), at(14, 0))
        circle(20)
    else:
        raise ValueError(kind)


def point_along(pts, dist):
    """Point at distance dist along a polyline, and the index of the segment it lies on."""
    for i in range(len(pts) - 1):
        (x1, y1), (x2, y2) = pts[i], pts[i + 1]
        seg = math.hypot(x2 - x1, y2 - y1)
        if dist <= seg:
            t = dist / seg if seg else 0
            return (x1 + (x2 - x1) * t, y1 + (y2 - y1) * t), i
        dist -= seg
    return pts[-1], len(pts) - 2


def connector(svg, pts, start, end, dashed=False):
    def path(p, extra=""):
        d = "M" + " L".join(f"{x:.1f},{y:.1f}" for x, y in p)
        svg.add(f'<path d="{d}" fill="none" stroke="{EDGE}" stroke-width="1.5"{extra}/>')

    if dashed:  # solid stubs under the cardinality marks, dashes only in the middle
        a, i = point_along(pts, 26)
        b, k = point_along(pts[::-1], 26)
        j = len(pts) - 2 - k
        path(pts[:i + 1] + [a])
        path([a] + pts[i + 1:j + 1] + [b], ' stroke-dasharray="7 5"')
        path([b] + pts[j + 1:])
    else:
        path(pts)
    cardinality(svg, pts[0], pts[1], start)
    cardinality(svg, pts[-1], pts[-2], end)


def label(svg, x, y, lines, size, anchor="middle"):
    """Relationship label with a white background; (x, y) is the centre (or the left edge for anchor=start)."""
    lines = [lines] if isinstance(lines, str) else lines
    w = max(text_width(t, size, "600") for t in lines) + 8
    lh = size * 1.25
    h = lh * len(lines) + 2
    left = x - w / 2 if anchor == "middle" else x
    svg.add(f'<rect x="{left:.1f}" y="{y - h / 2:.1f}" width="{w:.1f}" height="{h:.1f}" fill="#FFFFFF"/>', True)
    for i, t in enumerate(lines):
        ty = y - h / 2 + 1 + lh * (i + 0.5) + size * 0.35
        svg.text(left + w / 2, ty, t, size, "600", TEXT, "middle", True)
    return w, h


# ---------- legend ----------

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


def legend(svg, x, y, width, items, size):
    """items: (kind, arg, text) with kind in swatch | line | mark | text | break.
    Items flow left to right and wrap at width; a text item longer than width is word-wrapped."""
    cx, cy, row_h = x, y, size * 1.9
    for kind, arg, txt in items:
        if kind == "break":
            if cx > x:
                cx, cy = x, cy + row_h
            continue
        sym_w = {"swatch": 26, "line": 34, "mark": 48, "text": 0}[kind]
        w = sym_w + (8 if sym_w else 0) + text_width(txt, size)
        if cx > x and cx + w > x + width:
            cx, cy = x, cy + row_h
        mid = cy + size * 0.55
        if kind == "swatch":
            fill, stroke = arg
            svg.add(f'<rect x="{cx:.1f}" y="{mid - 7:.1f}" width="26" height="14" rx="2" fill="{fill}" stroke="{stroke}" stroke-width="1.4"/>')
        elif kind == "line":
            dash = ' stroke-dasharray="7 5"' if arg == "dashed" else ""
            svg.add(f'<path d="M{cx:.1f},{mid:.1f} L{cx + 34:.1f},{mid:.1f}" stroke="{EDGE}" stroke-width="1.5"{dash}/>')
        elif kind == "mark":  # sample connector ending at an entity edge (grey tick)
            svg.add(f'<path d="M{cx:.1f},{mid:.1f} L{cx + 44:.1f},{mid:.1f}" stroke="{EDGE}" stroke-width="1.5"/>')
            svg.add(f'<path d="M{cx + 45.5:.1f},{mid - 9:.1f} L{cx + 45.5:.1f},{mid + 9:.1f}" stroke="#9CA3AF" stroke-width="3"/>')
            cardinality(svg, (cx + 44, mid), (cx, mid), arg)
        if kind == "text" and w > width:
            lines = wrap(txt, size, width)
            for i, line in enumerate(lines):
                svg.text(cx, mid + size * 0.35 + i * size * 1.35, line, size, "400", TEXT)
            cy += (len(lines) - 1) * size * 1.35
            cx = x + width  # force a new row
            continue
        svg.text(cx + sym_w + (8 if sym_w else 0), mid + size * 0.35, txt, size, "400", TEXT)
        cx += w + 26
    return cy + row_h  # bottom of the legend


BREAK = ("break", None, None)


NOTATION = [("mark", "one", "exactly one"), ("mark", "zero_one", "zero or one"), ("mark", "many", "zero or many")]


# ---------- conceptual ERD ----------

def entity(svg, box, name, ctx):
    fill, stroke, _ = CONTEXT[ctx]
    svg.add(f'<rect x="{box.x:.1f}" y="{box.y:.1f}" width="{box.w:.1f}" height="{box.h:.1f}" rx="6" '
            f'fill="{fill}" stroke="{stroke}" stroke-width="1.6"/>')
    svg.text(box.cx, box.cy + CF["entity"] * 0.35, name, CF["entity"], "700", TEXT, "middle")


def conceptual():
    svg = Svg()
    eh = 46
    ytop = 22                                          # lane above the top row (lecturer -> course)
    r0, r1, r2, r3, r4 = 86, 206, 326, 446, 566        # row centres
    cL, cML, cM, cR, cRR = 130, 320, 500, 710, 930      # column centres

    def at(cx, cy, name, minimum=120):
        w = max(minimum, text_width(name, CF["entity"], "700") + 40)
        return Box(cx - w / 2, cy - eh / 2, w, eh)

    subject, course, chat = at(cL, r0, "SUBJECT"), at(cL, r1, "COURSE"), at(cL, r3, "CHAT_MESSAGE")
    room, member = at(cML, r2, "ROOM"), at(cML, r3, "ROOM_MEMBER")
    semester = Box(cM - 100, r0 - eh / 2, 200, eh)     # wider than GROUP_TYPE: its side routes pass outside it
    gtype, request, enrol = at(cM, r1, "GROUP_TYPE"), at(cM, r3, "JOIN_REQUEST"), at(cM, r4, "ENROLLMENT")
    skill, student, major = at(cR, r0, "SKILL"), at(cR, r1, "STUDENT"), at(cR, r2, "MAJOR")
    role, user = at(cRR, r0, "ROLE"), at(cRR, r1, "USER")
    lane_l, lane_r = 18, (major.r + user.l) / 2
    lf = CF["label"]

    # identity
    connector(svg, [(role.cx, role.b), (user.cx, user.t)], "many", "many")
    lw = text_width("assigned to", lf, "600") + 8
    label(svg, role.cx - 8 - lw, (role.b + user.t) / 2, "assigned to", lf, "start")   # left: the lane passes right
    connector(svg, [(user.l, r1 - 8), (student.r, r1 - 8)], "one", "many", dashed=True)
    label(svg, (student.r + user.l) / 2, r1 - 24, "is (Student)", lf)
    # a lecturer (user) teaches courses: lane above the top row, entering the course from the left
    x_u, x_c = user.r + 36, 32                       # corners clear of the cardinality marks
    connector(svg, [(user.r, r1), (x_u, r1), (x_u, ytop), (x_c, ytop), (x_c, r1 - 12), (course.l, r1 - 12)],
              "zero_one", "many", dashed=True)
    label(svg, (cM + cR) / 2, ytop, "teaches (Lecturer)", lf)
    # academic structure
    connector(svg, [(subject.cx, subject.b), (course.cx, course.t)], "one", "many")
    label(svg, subject.cx + 8, (subject.b + course.t) / 2, "taught as", lf, "start")
    xs = semester.l + 12
    connector(svg, [(xs, semester.b), (xs, r1 - 12), (course.r, r1 - 12)], "one", "many")
    label(svg, (course.r + xs) / 2, r1 - 26, "offers", lf)
    connector(svg, [(semester.cx, semester.b), (gtype.cx, gtype.t)], "many", "many")
    label(svg, semester.cx + 8, (semester.b + gtype.t) / 2, "allows", lf, "start")
    xe = semester.r - 12
    connector(svg, [(xe, semester.b), (xe, r1 - 12), (student.l, r1 - 12)], "one", "many")
    label(svg, xe + 8, (semester.b + r1 - 12) / 2, "includes", lf, "start")
    # student profile
    connector(svg, [(skill.cx, skill.b), (student.cx, student.t)], "many", "many")
    label(svg, skill.cx + 8, (skill.b + student.t) / 2, "rates 1–5", lf, "start")
    connector(svg, [(major.cx, major.t), (student.cx, student.b)], "one", "many")
    label(svg, major.cx + 8, (student.b + major.t) / 2, "studies", lf, "start")
    xg = gtype.r - 15
    connector(svg, [(xg, gtype.b), (xg, r2), (major.l, r2)], "many", "many")
    label(svg, xg + 8, (gtype.b + r2) / 2 - 4, "requires ≥ n", lf, "start")
    connector(svg, [(student.r, r1 + 12), (lane_r, r1 + 12), (lane_r, r4), (enrol.r, r4)], "one", "many")
    label(svg, lane_r + 8, (r2 + r3) / 2, "enrolls", lf, "start")
    connector(svg, [(course.l, r1 + 10), (lane_l, r1 + 10), (lane_l, r4 + 12), (enrol.l, r4 + 12)], "one", "many")
    label(svg, lane_l + 8, (r2 + r3) / 2 - 10, "has roster", lf, "start")
    # rooms
    xc = course.r - 20
    connector(svg, [(xc, course.b), (xc, r2 - 12), (room.l, r2 - 12)], "one", "many")
    label(svg, (xc + room.l) / 2 + 4, r2 - 26, "has", lf)
    xt = room.cx + 30
    connector(svg, [(gtype.l, r1 + 12), (xt, r1 + 12), (xt, room.t)], "one", "many")
    label(svg, xt + 8, (r1 + 12 + room.t) / 2 + 4, "typed as", lf, "start")
    xk, xl = room.cx + 18, room.cx - 18
    connector(svg, [(xk, room.b), (xk, member.t)], "one", "many")
    label(svg, xk + 8, (room.b + member.t) / 2, "contains", lf, "start")
    connector(svg, [(xl, room.b), (xl, member.t)], "zero_one", "zero_one")
    lw = text_width("led by", lf, "600") + 8
    label(svg, xl - 8 - lw, (room.b + member.t) / 2, "led by", lf, "start")
    connector(svg, [(member.cx, member.b), (member.cx, r4 - 12), (enrol.l, r4 - 12)], "zero_one", "one")
    label(svg, member.cx + 8, (member.b + r4 - 12) / 2, "joins as", lf, "start")
    connector(svg, [(room.r, r2), (request.cx, r2), (request.cx, request.t)], "one", "many")
    label(svg, (room.r + request.cx) / 2, r2 - 14, "receives", lf)
    connector(svg, [(request.cx, request.b), (enrol.cx, enrol.t)], "many", "one")
    label(svg, request.cx + 8, (request.b + enrol.t) / 2, "submits", lf, "start")
    connector(svg, [(room.l, r2 + 12), (chat.cx, r2 + 12), (chat.cx, chat.t)], "one", "many", dashed=True)
    label(svg, chat.cx + 8, (r2 + 12 + chat.t) / 2, "holds", lf, "start")

    for box, name, ctx in ((role, "ROLE", "IdentityDb"), (user, "USER", "IdentityDb"),
                           (subject, "SUBJECT", "GroupDb"), (semester, "SEMESTER", "GroupDb"),
                           (course, "COURSE", "GroupDb"), (gtype, "GROUP_TYPE", "GroupDb"),
                           (skill, "SKILL", "GroupDb"), (student, "STUDENT", "GroupDb"), (major, "MAJOR", "GroupDb"),
                           (room, "ROOM", "GroupDb"), (member, "ROOM_MEMBER", "GroupDb"),
                           (enrol, "ENROLLMENT", "GroupDb"), (request, "JOIN_REQUEST", "GroupDb"),
                           (chat, "CHAT_MESSAGE", "ChatDb")):
        entity(svg, box, name, ctx)

    width = user.r + 50
    bottom = legend(svg, 18, enrol.b + 30, width - 36, [
        ("swatch", CONTEXT["IdentityDb"][:2], "Identity (IdentityDb)"),
        ("swatch", CONTEXT["GroupDb"][:2], "Group (GroupDb)"),
        ("swatch", CONTEXT["ChatDb"][:2], "Realtime (ChatDb)"), BREAK,
        ("line", "solid", "Relationship inside one database"),
        ("line", "dashed", "Cross-service logical reference (no FK)"), BREAK,
    ] + NOTATION, CF["legend"])
    return svg.render(width, bottom + 8)


# ---------- physical ERDs ----------

def key_groups(table):
    """Number the alternate keys and unique indexes of a table: AK1, UX2, ..."""
    groups, n = [], 0
    for _, cols in table.get("alternate_keys", []):
        n += 1
        groups.append((f"AK{n}", cols))
    for _, cols, flt in table.get("unique_indexes", []):
        n += 1
        groups.append((f"UX{n}*" if flt else f"UX{n}", cols))   # * = filtered index (explained in the key)
    return groups


def table_rows(t, outside=(), db=None):
    """outside: tables drawn in another figure; an FK to them gets a note on its first column."""
    groups = key_groups(t)
    away = {fk[1][0]: fk[2] for fk in t.get("fks", []) if fk[2] in outside}
    rows = []
    for c in t["columns"]:
        codes = c["key"].split(", ") if c["key"] else []
        member = [lbl for lbl, cols in groups if c["name"] in cols]
        keys = [k for k in ("PK", "FK") if k in codes] + (["UK"] if member else [])
        notes = list(member)
        if c["name"] in away:
            notes.append(f"→ {away[c['name']]}")
        if "LR" in codes:
            target = spec.LR_TARGET.get((db, t["name"], c["name"])) or spec.LR_TARGET[(t["name"], c["name"])]
            notes.append(f"LR → {target}")
        if (db, t["name"], c["name"]) in NO_FK_REFS:
            notes.append(NO_FK_REFS[(db, t["name"], c["name"])])
        if c["null"]:
            notes.append("NULL")
        rows.append((", ".join(keys), c["name"], TYPE_ALIAS.get(c["type"], c["type"]), ", ".join(notes), "PK" in codes))
    return rows


class Table(Box):
    def __init__(self, t, outside=(), db=None):
        self.tdef = t
        self.rows = table_rows(t, outside, db)
        self.wk = max(text_width(r[0], PF["key"], "700") for r in self.rows)
        self.wn = max(text_width(r[1], PF["row"], "600" if r[4] else "400") for r in self.rows)
        self.wt = max(text_width(r[2], PF["row"]) for r in self.rows)
        self.wnote = max(text_width(r[3], PF["note"]) for r in self.rows)
        w = PADX + self.wk + GAP + self.wn + GAP + self.wt + (GAP + self.wnote if self.wnote else 0) + PADX
        w = max(w, text_width(t["name"], PF["title"], "700") + 2 * PADX)
        super().__init__(0, 0, w, HEAD_H + ROW_H * len(self.rows))

    def at(self, x, y):
        self.x, self.y = x, y
        return self

    def draw(self, svg, ctx):
        fill, stroke, head = CONTEXT[ctx]
        x, y, w, h, r = self.x, self.y, self.w, self.h, 5
        svg.add(f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" rx="{r}" fill="#FFFFFF"/>')
        svg.add(f'<path d="M{x:.1f},{y + HEAD_H:.1f} V{y + r:.1f} Q{x:.1f},{y:.1f} {x + r:.1f},{y:.1f} H{x + w - r:.1f} '
                f'Q{x + w:.1f},{y:.1f} {x + w:.1f},{y + r:.1f} V{y + HEAD_H:.1f} Z" fill="{head}"/>')
        svg.text(x + w / 2, y + HEAD_H / 2 + PF["title"] * 0.35, self.tdef["name"], PF["title"], "700", TEXT, "middle")
        xk = x + PADX
        xn = xk + self.wk + GAP
        xt = xn + self.wn + GAP
        xo = xt + self.wt + GAP
        for i, (keys, name, typ, note, is_pk) in enumerate(self.rows):
            ry = y + HEAD_H + i * ROW_H
            if i % 2 == 1:
                last = i == len(self.rows) - 1
                if last:  # keep the rounded bottom corners
                    svg.add(f'<path d="M{x:.1f},{ry:.1f} H{x + w:.1f} V{ry + ROW_H - r:.1f} Q{x + w:.1f},{ry + ROW_H:.1f} '
                            f'{x + w - r:.1f},{ry + ROW_H:.1f} H{x + r:.1f} Q{x:.1f},{ry + ROW_H:.1f} {x:.1f},{ry + ROW_H - r:.1f} Z" fill="{ZEBRA}"/>')
                else:
                    svg.add(f'<rect x="{x:.1f}" y="{ry:.1f}" width="{w:.1f}" height="{ROW_H}" fill="{ZEBRA}"/>')
            base = ry + ROW_H / 2 + PF["row"] * 0.35
            if keys:
                svg.text(xk, ry + ROW_H / 2 + PF["key"] * 0.35, keys, PF["key"], "700", stroke)
            svg.text(xn, base, name, PF["row"], "600" if is_pk else "400", TEXT)
            svg.text(xt, base, typ, PF["row"], "400", MUTED)
            if note:
                svg.text(xo, ry + ROW_H / 2 + PF["note"] * 0.35, note, PF["note"], "400", MUTED)
        svg.add(f'<path d="M{x:.1f},{y + HEAD_H:.1f} H{x + w:.1f}" stroke="{stroke}" stroke-width="1"/>')
        svg.add(f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" rx="{r}" fill="none" stroke="{stroke}" stroke-width="1.6"/>')


KEY_TEXT = [
    ("text", None, "PK / FK / UK = primary key / foreign key / member of a unique key"), BREAK,
    ("text", None, "AKn / UXn = columns of the same alternate key / unique index"), BREAK,
    ("text", None, "LR → T = logical reference to table T in another database (no FK)"), BREAK,
    ("text", None, "guid = uniqueidentifier; columns are NOT NULL unless marked NULL"), BREAK,
]


def tables_of(db_name, names=None):
    """Tables of one database; with names, only those (FKs to the others become notes)."""
    db = next(d for d in spec.DATABASES if d["name"] == db_name)
    shown = [t for t in db["tables"] if names is None or t["name"] in names]
    outside = {t["name"] for t in db["tables"]} - {t["name"] for t in shown}
    return {t["name"]: Table(t, outside, db_name) for t in shown}


def vlink(svg, upper, lower, start, end, text, x=None):
    """Vertical connector between two stacked boxes (x defaults to the middle of their overlap)."""
    if x is None:
        x = (max(upper.l, lower.l) + min(upper.r, lower.r)) / 2
    connector(svg, [(x, upper.b), (x, lower.t)], start, end)
    label(svg, x + 8, (upper.b + lower.t) / 2, text, PF["label"], "start")


def row_y(table, column):
    """Vertical centre of a column's row, so connectors can start at the key column itself."""
    i = [c["name"] for c in table.tdef["columns"]].index(column)
    return table.y + HEAD_H + (i + 0.5) * ROW_H


FILTERED_KEY = [("text", None, "UXn* = filtered unique index: covers only the rows that match its filter"), BREAK]


def finish(svg, tables, ctx, legend_items, margin=20, legend_at=None):
    if any(flt for tb in tables for _, _, flt in tb.tdef.get("unique_indexes", [])):
        i = legend_items.index(KEY_TEXT[2]) + 2                     # right after the "AKn / UXn" line
        legend_items = legend_items[:i] + FILTERED_KEY + legend_items[i:]
    for tb in tables:
        tb.draw(svg, ctx)
    width = max(tb.r for tb in tables) + margin
    lx, ly, lw = legend_at or (margin, max(tb.b for tb in tables) + 26, width - 2 * margin)
    bottom = legend(svg, lx, ly, lw, legend_items, PF["legend"])
    return svg.render(width, max(bottom + 6, max(tb.b for tb in tables) + margin))


def physical_identitydb():
    svg, T = Svg(), tables_of("IdentityDb")
    users = T["Users"].at(20, 20)
    ur = T["UserRoles"].at(users.r + 120, users.y)
    roles = T["Roles"].at(ur.x, ur.b + 78)
    y = row_y(users, "UserId")
    connector(svg, [(users.r, y), (ur.l, y)], "one", "many")
    label(svg, (users.r + ur.l) / 2, y - 14, "UserId", PF["label"])
    x = ur.x + min(ur.w, roles.w) / 2
    connector(svg, [(x, roles.t), (x, ur.b)], "one", "many")
    label(svg, x + 8, (ur.b + roles.t) / 2, "RoleId", PF["label"], "start")
    rt = T["RefreshTokens"].at(20, users.b + 78)
    vlink(svg, users, rt, "one", "many", "UserId", x=users.x + 60)
    return finish(svg, [users, ur, roles, rt], "IdentityDb", KEY_TEXT + [NOTATION[0], NOTATION[2]])


ACADEMIC = ("Semesters", "Subjects", "Majors", "Skills", "SemesterStudents", "StudentSkills", "Courses", "CourseEnrollments")


def physical_groupdb_academic():
    svg, T = Svg(), tables_of("GroupDb", ACADEMIC)
    vgap, hgap, m = 70, 140, 20
    wa = max(T[n].w for n in ("Subjects", "Courses", "CourseEnrollments"))
    xa, xb = m, m + wa + hgap
    gx = xa + wa + hgap / 2
    sem, subj, ss, maj = T["Semesters"], T["Subjects"], T["SemesterStudents"], T["Majors"]
    sem.at(gx - sem.w / 2, m)                                   # centred over the gap, above both columns
    subj.at(xa, m)
    y2 = m + max(subj.h, sem.h, maj.h) + vgap
    crs = T["Courses"].at(xa, y2)
    ss.at(xb, y2 + 2 * ROW_H)
    maj.at(ss.r - maj.w, m)                                    # right-aligned above SemesterStudents
    y3 = y2 + max(crs.h, ss.h + 2 * ROW_H) + vgap
    enr = T["CourseEnrollments"].at(xa, y3)
    sk = T["StudentSkills"].at(xb, y3)
    skl = T["Skills"].at(xb, sk.b + vgap)

    vlink(svg, subj, crs, "one", "many", "SubjectId", x=(subj.l + min(subj.r, sem.l - 30)) / 2)
    vlink(svg, sem, crs, "one", "many", "SemesterId")
    vlink(svg, sem, ss, "one", "many", "SemesterId")
    vlink(svg, maj, ss, "one", "many", "MajorId")
    vlink(svg, crs, enr, "one", "many", "CourseId, SemesterId")
    ya, yb = row_y(ss, "StudentId"), row_y(enr, "StudentId")
    connector(svg, [(ss.l, ya), (gx, ya), (gx, yb), (enr.r, yb)], "one", "many")
    label(svg, gx, (ya + yb) / 2, ["SemesterId,", "StudentId"], PF["label"])
    vlink(svg, ss, sk, "one", "many", "SemesterId, StudentId")
    vlink(svg, sk, skl, "many", "one", "SkillId")
    return finish(svg, [subj, sem, maj, crs, ss, enr, sk, skl], "GroupDb", KEY_TEXT + [NOTATION[0], NOTATION[2]])


ROOMS = ("GroupTypes", "GroupTypeMajors", "SemesterGroupTypes", "Rooms", "RoomMembers", "JoinRequests", "OutboxEvents")


def physical_groupdb_rooms():
    svg, T = Svg(), tables_of("GroupDb", ROOMS)
    vgap, hgap, m = 70, 110, 20
    wa = max(T[n].w for n in ("GroupTypes", "SemesterGroupTypes", "Rooms", "RoomMembers"))
    xa, xb = m, m + wa + hgap
    gt = T["GroupTypes"].at(xa, m)
    gtm = T["GroupTypeMajors"].at(xb, m)                          # GroupTypeId rows aligned
    sgt = T["SemesterGroupTypes"].at(xa, max(gt.b, gtm.b) + vgap)
    rooms = T["Rooms"].at(xa, sgt.b + vgap)
    jr = T["JoinRequests"].at(xb, rooms.y - ROW_H)              # RoomId rows aligned
    members = T["RoomMembers"].at(xa, rooms.b + vgap)
    obx = T["OutboxEvents"].at(xb, max(members.y, jr.b + vgap))

    y = row_y(gt, "GroupTypeId")
    connector(svg, [(gt.r, y), (gtm.l, y)], "one", "many")
    label(svg, (gt.r + gtm.l) / 2, y - 14, "GroupTypeId", PF["label"])
    vlink(svg, gt, sgt, "one", "many", "GroupTypeId")
    vlink(svg, sgt, rooms, "one", "many", "SemesterId, GroupTypeId")
    y = row_y(rooms, "RoomId")
    connector(svg, [(rooms.r, y), (jr.l, y)], "one", "many")
    label(svg, (rooms.r + jr.l) / 2, y - 24, ["RoomId,", "CourseId"], PF["label"])   # two lines: the gap is narrow
    vlink(svg, rooms, members, "one", "many", "RoomId, CourseId")
    key = KEY_TEXT + [("text", None, "→ T = foreign key to table T shown in GroupDb (1/2)"), BREAK, NOTATION[0], NOTATION[2]]
    return finish(svg, [gt, gtm, sgt, rooms, jr, members, obx], "GroupDb", key)


def physical_chatdb():
    svg, T = Svg(), tables_of("ChatDb")
    conv = T["Conversations"].at(20, 20)
    cm = T["ConversationMembers"].at(conv.r + 110, 20)          # ConversationId rows aligned
    msg = T["Messages"].at(20, conv.b + 70)
    note = T["Notifications"].at(cm.x, cm.b + 70)
    pe = T["ProcessedEvents"].at(cm.x, note.b + 40)
    y = row_y(conv, "ConversationId")
    connector(svg, [(conv.r, y), (cm.l, y)], "one", "many")
    label(svg, (conv.r + cm.l) / 2, y - 14, "ConversationId", PF["label"])
    vlink(svg, conv, msg, "one", "many", "ConversationId")
    return finish(svg, [conv, cm, msg, note, pe], "ChatDb", KEY_TEXT + [NOTATION[0], NOTATION[2]])


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "."
    os.makedirs(out, exist_ok=True)
    for name, make in (("fig3_conceptual_erd", conceptual), ("fig4_physical_identitydb", physical_identitydb),
                       ("fig5a_physical_groupdb_academic", physical_groupdb_academic),
                       ("fig5b_physical_groupdb_rooms", physical_groupdb_rooms),
                       ("fig6_physical_chatdb", physical_chatdb)):
        with open(os.path.join(out, name + ".svg"), "w", encoding="utf-8", newline="\n") as f:
            f.write(make())
        print("wrote", name + ".svg")
