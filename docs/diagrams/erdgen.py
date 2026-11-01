"""Hand-laid-out ER diagrams (conceptual + one physical diagram per database) rendered as SVG.

Usage: python erdgen.py <out_dir>
Writes conceptual_erd.svg, physical_identitydb.svg, physical_groupdb.svg and physical_requestdb.svg.
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
    "RequestDb": ("#E6F4EA", "#2F7D4A", "#C9E5D1"),
}
TYPE_ALIAS = {"uniqueidentifier": "guid"}
NO_FK_REFS = {("OutboxEvents", "AggregateId"): "→ Groups (no FK)"}

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
    ew = lambda name, minimum=120: max(minimum, text_width(name, CF["entity"], "700") + 40)
    y0, y1, y2, y3, y4 = 46, 176, 306, 456, 586  # row centres
    x0, wu = 24, 140                 # Identity column (ROLE above a tall USER)
    xc, wc = x0 + wu + 218, 200      # main column of the Group context
    c = lambda y, w=wc: Box(xc, y - eh / 2, w, eh)

    role = Box(x0, y0 - eh / 2, wu, eh)
    user = Box(x0, y1 - 32, wu, y4 + 32 - (y1 - 32))
    sem = Box(xc + (wc - ew("SEMESTER")) / 2, y0 - eh / 2, ew("SEMESTER"), eh)
    exe, enr, grp, jrq = c(y1), c(y2), c(y3), c(y4)
    gmw = ew("GROUP_MEMBER")
    gm = Box(xc + wc + 95 - gmw / 2, (y2 + y3) / 2 - eh / 2, gmw, eh)
    crs = Box(gm.cx - ew("COURSE", 130) / 2, y0 - eh / 2, ew("COURSE", 130), eh)
    chan = gm.r + 38                 # vertical channel of EXE_CLASS -> GROUP, right of GROUP_MEMBER

    # connectors first, boxes on top
    lf = CF["label"]
    connector(svg, [(role.cx, role.b), (user.cx, user.t)], "many", "many")
    label(svg, role.cx + 8, (role.b + user.t) / 2, "assigned to", lf, "start")
    connector(svg, [(sem.cx, sem.b), (sem.cx, exe.t)], "one", "many")
    label(svg, sem.cx + 8, (sem.b + exe.t) / 2, "contains", lf, "start")
    connector(svg, [(crs.cx, crs.b), (crs.cx, y1 - 13), (exe.r, y1 - 13)], "one", "many")
    label(svg, crs.cx + 8, (crs.b + y1 - 13) / 2, "offered in", lf, "start")
    connector(svg, [(exe.cx, exe.b), (exe.cx, enr.t)], "one", "many")
    label(svg, exe.cx + 8, (exe.b + enr.t) / 2, "has roster", lf, "start")
    connector(svg, [(exe.r, y1 + 13), (chan, y1 + 13), (chan, y3 + 13), (grp.r, y3 + 13)], "one", "many")
    label(svg, chan + 8, (y2 + y3) / 2 - 40, "hosts", lf, "start")
    connector(svg, [(enr.r, y2), (gm.cx, y2), (gm.cx, gm.t)], "one", "zero_one")
    label(svg, (enr.r + gm.cx) / 2 + 4, y2 - 14, "joins as", lf)
    connector(svg, [(grp.r, y3 - 13), (gm.cx, y3 - 13), (gm.cx, gm.b)], "one", "many")
    label(svg, (grp.r + gm.cx) / 2 + 4, y3 - 27, "includes", lf)
    connector(svg, [(grp.cx, grp.b), (grp.cx, jrq.t)], "one", "many", dashed=True)
    label(svg, grp.cx + 8, (grp.b + jrq.t) / 2, "receives", lf, "start")
    mid = (user.r + xc) / 2
    for y, text in ((y1, "teaches (Lecturer)"), (y2, "enrolled as (Student)"), (y3, "leads (Team Leader)")):
        connector(svg, [(user.r, y), (xc, y)], "one", "many", dashed=True)
        label(svg, mid, y - 13, text, lf)
    connector(svg, [(user.r, y4 - 13), (xc, y4 - 13)], "one", "many", dashed=True)
    label(svg, mid, y4 - 27, "submits (Student)", lf)
    connector(svg, [(user.r, y4 + 13), (xc, y4 + 13)], "zero_one", "many", dashed=True)
    label(svg, mid, y4 + 27, "decides (Team Leader)", lf)

    for box, name, ctx in ((role, "ROLE", "IdentityDb"), (user, "USER", "IdentityDb"), (sem, "SEMESTER", "GroupDb"),
                           (crs, "COURSE", "GroupDb"), (exe, "EXE_CLASS", "GroupDb"), (enr, "CLASS_ENROLLMENT", "GroupDb"),
                           (grp, "GROUP", "GroupDb"), (gm, "GROUP_MEMBER", "GroupDb"), (jrq, "JOIN_REQUEST", "RequestDb")):
        entity(svg, box, name, ctx)

    width = chan + 70
    bottom = legend(svg, x0, user.b + 30, width - 2 * x0, [
        ("swatch", CONTEXT["IdentityDb"][:2], "Identity context (IdentityDb)"),
        ("swatch", CONTEXT["GroupDb"][:2], "Group context (GroupDb)"),
        ("swatch", CONTEXT["RequestDb"][:2], "Join Request context (RequestDb)"), BREAK,
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
    for _, cols, _flt in table.get("unique_indexes", []):
        n += 1
        groups.append((f"UX{n}", cols))
    return groups


def table_rows(t):
    groups = key_groups(t)
    rows = []
    for c in t["columns"]:
        codes = c["key"].split(", ") if c["key"] else []
        member = [lbl for lbl, cols in groups if c["name"] in cols]
        keys = [k for k in ("PK", "FK") if k in codes] + (["UK"] if member else [])
        notes = list(member)
        if "LR" in codes:
            notes.append(f"LR → {spec.LR_TARGET[(t['name'], c['name'])]}")
        if (t["name"], c["name"]) in NO_FK_REFS:
            notes.append(NO_FK_REFS[(t["name"], c["name"])])
        if c["null"]:
            notes.append("NULL")
        rows.append((", ".join(keys), c["name"], TYPE_ALIAS.get(c["type"], c["type"]), ", ".join(notes), "PK" in codes))
    return rows


class Table(Box):
    def __init__(self, t):
        self.tdef = t
        self.rows = table_rows(t)
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
    ("text", None, "AKn / UXn = columns of the same alternate key / unique index (names and filters in section 9.3)"), BREAK,
    ("text", None, "LR → T = logical reference to table T in another database (no FK)"), BREAK,
    ("text", None, "guid = uniqueidentifier; columns are NOT NULL unless marked NULL"), BREAK,
]


def tables_of(db_name):
    db = next(d for d in spec.DATABASES if d["name"] == db_name)
    return {t["name"]: Table(t) for t in db["tables"]}


def vlink(svg, upper, lower, start, end, text):
    """Vertical connector between two boxes stacked in one column (left-aligned)."""
    x = upper.x + min(upper.w, lower.w) / 2
    connector(svg, [(x, upper.b), (x, lower.t)], start, end)
    label(svg, x + 8, (upper.b + lower.t) / 2, text, PF["label"], "start")


def row_y(table, column):
    """Vertical centre of a column's row, so connectors can start at the key column itself."""
    i = [c["name"] for c in table.tdef["columns"]].index(column)
    return table.y + HEAD_H + (i + 0.5) * ROW_H


def finish(svg, tables, ctx, legend_items, margin=20, legend_at=None):
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
    return finish(svg, [users, ur, roles], "IdentityDb", KEY_TEXT + [NOTATION[0], NOTATION[2]])  # no zero-or-one here


def physical_groupdb():
    svg, T = Svg(), tables_of("GroupDb")
    vgap, hgap, m = 70, 110, 20
    wa = max(T[n].w for n in ("Semesters", "ExeClasses", "ClassEnrollments", "GroupMembers"))
    xa, xb = m, m + wa + hgap
    gx = xa + wa + hgap / 2  # vertical routing channel between the two columns
    sem = T["Semesters"].at(xa, m)
    crs = T["Courses"].at(xb, m)
    y2 = m + max(sem.h, crs.h) + vgap
    exe = T["ExeClasses"].at(xa, y2)
    grp = T["Groups"].at(xb, y2)
    y3 = y2 + max(exe.h, grp.h) + vgap
    enr = T["ClassEnrollments"].at(xa, y3)
    amr = T["AddMemberRequests"].at(xb, y3)
    y4 = y3 + max(enr.h, amr.h) + vgap
    gm = T["GroupMembers"].at(xa, y4)
    obx = T["OutboxEvents"].at(xb, y4)

    # rule: side connectors attach at the key-column rows, top/bottom connectors at the box edge
    vlink(svg, sem, exe, "one", "many", "SemesterId")
    ya, xc = row_y(crs, "CourseId"), (sem.r + exe.r) / 2          # down into ExeClasses, right of Semesters
    connector(svg, [(crs.l, ya), (xc, ya), (xc, exe.t)], "one", "many")
    label(svg, (xc + crs.l) / 2, ya - 14, "CourseId", PF["label"])
    yf, yt = row_y(exe, "ClassId"), row_y(grp, "ClassId")
    connector(svg, [(exe.r, yf), (gx, yf), (gx, yt), (grp.l, yt)], "one", "many")
    label(svg, (exe.r + gx) / 2, yf - 14, "ClassId", PF["label"])
    vlink(svg, exe, enr, "one", "many", "ClassId")
    vlink(svg, grp, amr, "one", "many", "GroupId")
    xs, ym = grp.l + 40, (grp.b + amr.t) / 2                        # leaves Groups at the bottom, left of GroupId
    ygm = gm.y + HEAD_H + 2 * ROW_H                                 # between the GroupId and ClassId rows
    connector(svg, [(xs, grp.b), (xs, ym), (gx, ym), (gx, ygm), (gm.r, ygm)], "one", "many")
    label(svg, gx, (ym + ygm) / 2, ["GroupId,", "ClassId"], PF["label"])
    vlink(svg, enr, gm, "one", "zero_one", "ClassId, StudentId")
    return finish(svg, [sem, crs, exe, grp, enr, amr, gm, obx], "GroupDb", KEY_TEXT + NOTATION)


def physical_requestdb():
    svg, T = Svg(), tables_of("RequestDb")
    jr = T["JoinRequests"].at(20, 20)
    pe = T["ProcessedEvents"].at(jr.r + 70, 20)
    # no relationships in this database: the key sits in the free space under ProcessedEvents
    return finish(svg, [jr, pe], "RequestDb", KEY_TEXT, legend_at=(pe.x, pe.b + 40, pe.w))


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "."
    os.makedirs(out, exist_ok=True)
    for name, make in (("conceptual_erd", conceptual), ("physical_identitydb", physical_identitydb),
                       ("physical_groupdb", physical_groupdb), ("physical_requestdb", physical_requestdb)):
        with open(os.path.join(out, name + ".svg"), "w", encoding="utf-8", newline="\n") as f:
            f.write(make())
        print("wrote", name + ".svg")
