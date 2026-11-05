"""Build the design document (Word) from spec.py and design.py.

Usage: python build_docx.py <folder with the figure PNGs> <out.docx>
The table of contents is a Word field: update it in Word (or with update_docx.ps1, which also exports the PDF).
"""
import os
import sys

from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor
from PIL import Image

import design
import spec

FONT, MONO = "Calibri", "Consolas"
DARK, BLUE, GREY = RGBColor(0x08, 0x42, 0x7B), RGBColor(0x11, 0x68, 0xBD), RGBColor(0x4B, 0x55, 0x63)
HEADER_FILL, CODE_FILL = "DCE9F7", "F3F4F6"
TEXT_WIDTH = 17.0  # cm, A4 with 2 cm margins
FIGURE_WIDTH = {"fig1": 15.0, "fig4": 13.5, "fig6": 15.5}


def shade(element_pr, fill):
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), fill)
    element_pr.append(shd)


def field(paragraph, instruction, placeholder=""):
    run = paragraph.add_run()
    for kind, text in (("begin", None), (None, instruction), ("separate", None), (None, placeholder), ("end", None)):
        if kind:
            el = OxmlElement("w:fldChar")
            el.set(qn("w:fldCharType"), kind)
        elif text is instruction:
            el = OxmlElement("w:instrText")
            el.set(qn("xml:space"), "preserve")
            el.text = text
        else:
            el = OxmlElement("w:t")
            el.text = text
        run._r.append(el)
    return run


def set_styles(doc):
    normal = doc.styles["Normal"]
    normal.font.name, normal.font.size = FONT, Pt(10.5)
    normal.element.rPr.rFonts.set(qn("w:eastAsia"), FONT)
    normal.paragraph_format.space_after = Pt(6)
    normal.paragraph_format.line_spacing = 1.1
    for name, size, color, before, after in (("Heading 1", 16, DARK, 18, 8), ("Heading 2", 13, BLUE, 14, 6),
                                             ("Heading 3", 11, DARK, 10, 4)):
        st = doc.styles[name]
        st.font.name, st.font.size, st.font.bold, st.font.color.rgb = FONT, Pt(size), True, color
        st.element.rPr.rFonts.set(qn("w:eastAsia"), FONT)
        st.element.rPr.rFonts.set(qn("w:ascii"), FONT)
        st.element.rPr.rFonts.set(qn("w:hAnsi"), FONT)
        pf = st.paragraph_format
        pf.space_before, pf.space_after, pf.keep_with_next = Pt(before), Pt(after), True
    cap = doc.styles["Caption"]
    cap.font.name, cap.font.size, cap.font.italic, cap.font.bold = FONT, Pt(9.5), True, False
    cap.font.color.rgb = GREY
    cap.paragraph_format.space_after = Pt(10)


def page_setup(doc):
    sec = doc.sections[0]
    sec.page_width, sec.page_height = Cm(21.0), Cm(29.7)
    sec.left_margin = sec.right_margin = Cm(2.0)
    sec.top_margin, sec.bottom_margin = Cm(2.0), Cm(2.0)
    sec.different_first_page_header_footer = True
    hp = sec.header.paragraphs[0]
    hp.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    r = hp.add_run(f"{spec.PROJECT['title']} · Design v{spec.PROJECT['version']}")
    r.font.size, r.font.color.rgb = Pt(8.5), GREY
    fp = sec.footer.paragraphs[0]
    fp.alignment = WD_ALIGN_PARAGRAPH.CENTER
    for part in ("Page ", ("PAGE", "1"), " of ", ("NUMPAGES", "1")):
        run = field(fp, *part) if isinstance(part, tuple) else fp.add_run(part)
        run.font.size, run.font.color.rgb = Pt(8.5), GREY


def para(doc, text, bold_lead=None, size=None, color=None, align=None, italic=False, after=None):
    p = doc.add_paragraph()
    if bold_lead:
        lead = p.add_run(bold_lead)
        lead.bold = True
        if size:
            lead.font.size = Pt(size)
    run = p.add_run(text)
    run.italic = italic
    if size:
        run.font.size = Pt(size)
    if color:
        run.font.color.rgb = color
    if align is not None:
        p.alignment = align
    if after is not None:
        p.paragraph_format.space_after = Pt(after)
    return p


def bullets(doc, items):
    for item in items:
        p = doc.add_paragraph(style="List Bullet")
        p.add_run(item)
        p.paragraph_format.space_after = Pt(3)


def steps(doc, items):
    for i, item in enumerate(items, 1):
        p = doc.add_paragraph()
        p.paragraph_format.left_indent, p.paragraph_format.first_line_indent = Cm(0.7), Cm(-0.7)
        p.paragraph_format.space_after = Pt(3)
        p.add_run(f"{i}.\t").bold = True
        p.add_run(item)
        p.paragraph_format.tab_stops.add_tab_stop(Cm(0.7))


def table(doc, headers, rows, widths, size=9, first_bold=False):
    t = doc.add_table(rows=1, cols=len(headers))
    t.style = "Table Grid"
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    scale = TEXT_WIDTH / sum(widths)
    widths = [w * scale for w in widths]
    tr_pr = t.rows[0]._tr.get_or_add_trPr()
    header_flag = OxmlElement("w:tblHeader")
    header_flag.set(qn("w:val"), "true")
    tr_pr.append(header_flag)
    for cell, text, w in zip(t.rows[0].cells, headers, widths):
        cell.width = Cm(w)
        shade(cell._tc.get_or_add_tcPr(), HEADER_FILL)
        p = cell.paragraphs[0]
        r = p.add_run(text)
        r.bold, r.font.size = True, Pt(size)
        p.paragraph_format.space_after = Pt(0)
    for row in rows:
        cells = t.add_row().cells
        for i, (cell, text, w) in enumerate(zip(cells, row, widths)):
            cell.width = Cm(w)
            p = cell.paragraphs[0]
            r = p.add_run(str(text))
            r.font.size = Pt(size)
            r.bold = first_bold and i == 0
            p.paragraph_format.space_after = Pt(0)
            p.paragraph_format.line_spacing = 1.0
    doc.add_paragraph().paragraph_format.space_after = Pt(2)
    return t


def figure(doc, folder, key):
    file, caption = design.FIGURES[key]
    path = os.path.join(folder, file)
    w, h = Image.open(path).size
    width = min(FIGURE_WIDTH.get(key, TEXT_WIDTH), 21.5 * w / h)
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.keep_with_next = True
    p.add_run().add_picture(path, width=Cm(width))
    doc.add_paragraph(caption, style="Caption").alignment = WD_ALIGN_PARAGRAPH.CENTER


def code(doc, text):
    p = doc.add_paragraph()
    shade(p._p.get_or_add_pPr(), CODE_FILL)
    p.paragraph_format.space_after = Pt(8)
    p.paragraph_format.line_spacing = 1.0
    lines = text.split("\n")
    for i, line in enumerate(lines):
        r = p.add_run(line)
        r.font.name, r.font.size = MONO, Pt(8.5)
        r._element.rPr.rFonts.set(qn("w:eastAsia"), MONO)
        if i < len(lines) - 1:
            r.add_break()


def heading(doc, text, level):
    doc.add_heading(text, level=level)


def cover(doc):
    pr = spec.PROJECT
    for _ in range(5):
        doc.add_paragraph()
    para(doc, pr["title"], size=28, color=DARK, after=4).runs[0].bold = True
    para(doc, "Design document", size=16, color=BLUE, after=24)
    for label, value in (("Course: ", pr["course"]), ("Assignment: ", "Final Assignment"),
                         ("Architecture: ", pr["style"]), ("Instructor: ", pr["instructor"]),
                         ("Semester: ", pr["semester"]), ("Version: ", f"{pr['version']} · {pr['date']}")):
        para(doc, value, bold_lead=label, size=11, after=3)
    doc.add_paragraph()
    para(doc, "Version history", size=11, after=4).runs[0].bold = True
    table(doc, ["Version", "Date", "Changes"], design.VERSIONS, [1.6, 3.2, 12.2])
    doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)
    para(doc, "Contents", size=16, color=DARK, after=8).runs[0].bold = True
    field(doc.add_paragraph(), 'TOC \\o "1-2" \\h \\z \\u', "Update this field (F9) to build the table of contents.")
    doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)


def physical_table(doc, db_name, t):
    heading(doc, t["name"], 3)
    para(doc, t["desc"], italic=True, after=4)
    rows = []
    for c in t["columns"]:
        default = c["default"] or ""
        rows.append([c["name"], c["type"], "NULL" if c["null"] else "", c["key"], default, c["desc"]])
    table(doc, ["Column", "Type", "Null", "Key", "Default", "Description"], rows, [3.3, 2.6, 1.1, 1.5, 2.6, 6.0],
          size=8.5, first_bold=True)
    parts = [f"PK_{t['name']} ({', '.join(t['pk'])})"]
    parts += [f"{name} ({', '.join(cols)})" for name, cols in t.get("alternate_keys", [])]
    lines = [("Keys: ", "; ".join(parts))]
    uniq = [f"{n} ({', '.join(c)})" + (f" WHERE {f}" if f else "") for n, c, f in t.get("unique_indexes", [])]
    if uniq:
        lines.append(("Unique indexes: ", "; ".join(uniq)))
    idx = [f"{n} ({', '.join(c)})" + (f" WHERE {f}" if f else "") for n, c, f in t.get("indexes", [])]
    if idx:
        lines.append(("Indexes: ", "; ".join(idx)))
    if t.get("checks"):
        lines.append(("Checks: ", "; ".join(f"{n}: {e}" for n, e in t["checks"])))
    if t.get("fks"):
        lines.append(("Foreign keys: ", "; ".join(f"{n} ({', '.join(c)}) -> {r} ({', '.join(rc)}), ON DELETE {a}"
                                                  for n, c, r, rc, a in t["fks"])))
    lrs = []
    for c in t["columns"]:
        if "LR" in c["key"]:
            target = spec.LR_TARGET.get((db_name, t["name"], c["name"])) or spec.LR_TARGET[(t["name"], c["name"])]
            lrs.append(f"{c['name']} -> {target}")
    if lrs:
        lines.append(("Logical references (no FK): ", "; ".join(lrs)))
    if t.get("seed"):
        lines.append(("Seed rows: ", ", ".join(name for _, name in t["seed"])))
    for lead, text in lines:
        para(doc, text, bold_lead=lead, size=8.5, after=2)
    doc.add_paragraph().paragraph_format.space_after = Pt(2)


def build(folder, out):
    doc = Document()
    set_styles(doc)
    page_setup(doc)
    cover(doc)

    heading(doc, "1. Context", 1)
    for text in design.CONTEXT:
        para(doc, text)

    heading(doc, "2. Problems", 1)
    table(doc, ["ID", "Problem", "Impact"], design.PROBLEMS, [1.2, 5.3, 10.5], first_bold=True)

    heading(doc, "3. Solutions", 1)
    table(doc, ["ID", "Solution", "How", "Solves"], design.SOLUTIONS, [1.2, 3.8, 9.8, 2.2], first_bold=True)

    heading(doc, "4. Main Actors", 1)
    para(doc, "The Admin is the moderator described in the lecturer's feedback; in the system it is the "
              "Administrator role. A Room Leader is a student, not a separate account.")
    table(doc, ["Actor", "Role in the token", "Description", "Main permissions"], design.ACTORS,
          [2.2, 2.6, 4.9, 7.3], first_bold=True)

    heading(doc, "5. Main Features", 1)
    heading(doc, "5.1 Features", 2)
    table(doc, ["ID", "Feature", "Actors", "Service"], design.FEATURES, [1.2, 9.3, 3.3, 3.2], first_bold=True)
    heading(doc, "5.2 Business rules", 2)
    para(doc, "The Group Service enforces these rules in its Services layer; the database keeps the invariants it "
              "can check (keys, filtered unique indexes, checks).")
    table(doc, ["ID", "Rule"], design.RULES, [1.6, 15.4], first_bold=True)
    heading(doc, "5.3 Statuses and codes", 2)
    for title, rows in design.STATUSES:
        para(doc, title, after=3).runs[0].bold = True
        table(doc, ["Value", "Meaning"], rows, [4.2, 12.8], first_bold=True)
    para(doc, "Reason codes stored on rejected or cancelled applications (JoinRequests.ReasonCode)", after=3).runs[0].bold = True
    table(doc, ["Code", "Meaning"], design.REASON_CODES, [4.6, 12.4], first_bold=True)
    para(doc, "Business error codes returned with HTTP 409 (nothing is stored)", after=3).runs[0].bold = True
    table(doc, ["Code", "Meaning"], design.APPLY_ERRORS, [4.6, 12.4], first_bold=True)
    heading(doc, "5.4 Grouping workflow", 2)
    para(doc, "Figure A puts the phases of a course, the statuses of a room and the main rules on one page.")
    figure(doc, folder, "figA")

    heading(doc, "6. System Architecture (C4 model, Levels 1 and 2)", 1)
    para(doc, "The architecture follows the C4 model; this document uses Level 1 (System Context) and Level 2 "
              "(Container). The same model, with component and deployment views, is kept as code in "
              "docs/architecture/workspace.dsl.")
    heading(doc, "6.1 Level 1: System Context", 2)
    figure(doc, folder, "fig1")
    para(doc, "Three kinds of people use the system through the browser. There is no external system: accounts and "
              "rosters are imported by the admin, and notifications are shown in the application.")
    heading(doc, "6.2 Level 2: Containers", 2)
    figure(doc, folder, "fig2")
    table(doc, ["Container", "Technology", "Responsibility", "Port / data"], design.CONTAINERS, [3.2, 3.4, 7.6, 2.8],
          first_bold=True)
    heading(doc, "6.3 Communication", 2)
    table(doc, ["Style", "Between", "Protocol", "Used for"], design.COMMUNICATION, [3.0, 4.6, 4.6, 4.8], first_bold=True)
    para(doc, design.COMMUNICATION_RULE, italic=True)
    heading(doc, "6.4 Key flows", 2)
    for title, items in design.FLOWS:
        heading(doc, title, 3)
        steps(doc, items)
    heading(doc, "6.5 Events (Redis stream group-events)", 2)
    para(doc, "The Group Service writes every event to OutboxEvents in the same transaction as the change; the "
              "OutboxPublisher adds it to the stream. Every payload also carries eventId, occurredAt and "
              "correlationId.")
    table(doc, ["Event", "Produced when", "Payload", "Realtime Service reaction"], design.EVENTS,
          [3.6, 3.6, 4.2, 5.6], first_bold=True)
    heading(doc, "6.6 Background jobs", 2)
    table(doc, ["Job", "Service", "Schedule", "What it does"], design.JOBS, [3.6, 2.0, 2.2, 9.2], first_bold=True)
    heading(doc, "6.7 gRPC contract: Recommendation Service", 2)
    para(doc, "The Recommendation Service is the system's independent gRPC service. It owns no data: the Group "
              "Service sends the student, the rooms and the rules in each call (src/Contracts, recommendation.proto).")
    code(doc, design.PROTO)
    para(doc, "Scoring", after=3).runs[0].bold = True
    bullets(doc, design.SCORING)
    heading(doc, "6.8 Layered architecture and API conventions", 2)
    bullets(doc, design.CONVENTIONS)

    heading(doc, "7. Technology", 1)
    table(doc, ["Area", "Technology"], design.TECH, [4.2, 12.8], first_bold=True)

    heading(doc, "8. ERD (conceptual)", 1)
    figure(doc, folder, "fig3")
    para(doc, "Colours show the database that owns an entity; dashed lines are logical references across services "
              "(no foreign key).")
    table(doc, ["Entity", "Meaning", "Database"], design.ENTITIES, [3.4, 11.0, 2.6], first_bold=True)

    heading(doc, "9. Physical Database", 1)
    para(doc, "One SQL Server database per service. database/schema.sql is generated from the same design data as "
              "these figures, and the EF Core migrations must produce the same tables, keys, indexes and checks. "
              "Key column: PK primary key, FK foreign key, UK member of a unique key, LR logical reference to another "
              "database (no FK). Filtered unique indexes (WHERE ...) cover only the rows that match.")
    sections = {"IdentityDb": ["fig4"], "GroupDb": ["fig5a", "fig5b"], "ChatDb": ["fig6"]}
    for i, db in enumerate(spec.DATABASES, 1):
        heading(doc, f"9.{i} {db['name']} ({db['owner']})", 2)
        for key in sections[db["name"]]:
            figure(doc, folder, key)
        for t in db["tables"]:
            physical_table(doc, db["name"], t)

    heading(doc, "Appendix A. REST API", 1)
    para(doc, "Every route is served by the gateway under /api/v1 (shown without the prefix) and answers with the "
              "envelope of section 6.8. List endpoints also accept search, sort, page, pageSize, fields and expand.")
    for title, rows in design.API:
        heading(doc, title, 2)
        table(doc, ["Method", "Route", "Roles", "Purpose"], rows, [2.2, 5.4, 3.9, 5.5], size=8.5)

    heading(doc, "Appendix B. Assignment requirements", 1)
    table(doc, ["Requirement (assignment brief)", "Where it is met"], design.REQUIREMENTS, [4.4, 12.6], first_bold=True)

    doc.core_properties.title = f"{spec.PROJECT['title']} – Design v{spec.PROJECT['version']}"
    doc.core_properties.author = "PRN232 team"
    doc.save(out)
    print("wrote", out)


if __name__ == "__main__":
    build(sys.argv[1], sys.argv[2])
