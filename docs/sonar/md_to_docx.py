#!/usr/bin/env python3
"""Convierte GUIA_SONARQUBE_SATRE.md en un DOCX con portada, indice y tablas.

Uso:
    python docs/sonar/md_to_docx.py
    python docs/sonar/md_to_docx.py --input ... --output ...

El conversor entiende el subconjunto de Markdown usado en la guia:
titulos, parrafos, listas, tablas, bloques de codigo, citas y el marcador
<!-- TOC -->. No pretende ser un conversor Markdown universal.
"""

from __future__ import annotations

import argparse
import re
from pathlib import Path
from typing import Iterable

from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor

# ---------------------------------------------------------------------------
# Paleta y constantes
# ---------------------------------------------------------------------------
NAVY = RGBColor(0x1F, 0x38, 0x64)
BLUE = RGBColor(0x2E, 0x54, 0x96)
DARK = RGBColor(0x26, 0x32, 0x38)
GRAY = RGBColor(0x5A, 0x67, 0x72)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
CODE = RGBColor(0xB0, 0x3A, 0x2E)

NAVY_HEX = "1F3864"
BLUE_HEX = "2E5496"
LIGHT_BLUE_HEX = "EAF1FB"
LIGHT_GRAY_HEX = "F6F8FA"
BORDER_HEX = "D0D7DE"
ZEBRA_HEX = "F4F6F9"
ORANGE_HEX = "FFF4E5"
ORANGE_BORDER_HEX = "C55A11"
GREEN_HEX = "E8F5E9"
GREEN_BORDER_HEX = "2E7D32"

BODY_FONT = "Calibri"
CODE_FONT = "Consolas"
BODY_SIZE = 10.5


# ---------------------------------------------------------------------------
# Utilidades XML
# ---------------------------------------------------------------------------
def set_cell_shading(cell, hex_fill: str) -> None:
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = tc_pr.find(qn("w:shd"))
    if shd is None:
        shd = OxmlElement("w:shd")
        tc_pr.append(shd)
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), hex_fill)


def set_cell_margins(cell, top=60, start=90, bottom=60, end=90) -> None:
    tc_pr = cell._tc.get_or_add_tcPr()
    mar = tc_pr.find(qn("w:tcMar"))
    if mar is None:
        mar = OxmlElement("w:tcMar")
        tc_pr.append(mar)
    for tag, value in (("top", top), ("start", start), ("bottom", bottom), ("end", end)):
        node = mar.find(qn(f"w:{tag}"))
        if node is None:
            node = OxmlElement(f"w:{tag}")
            mar.append(node)
        node.set(qn("w:w"), str(value))
        node.set(qn("w:type"), "dxa")


def set_table_borders(table, color=BORDER_HEX, size=4) -> None:
    tbl_pr = table._tbl.tblPr
    borders = tbl_pr.find(qn("w:tblBorders"))
    if borders is None:
        borders = OxmlElement("w:tblBorders")
        tbl_pr.append(borders)
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        element = borders.find(qn(f"w:{edge}"))
        if element is None:
            element = OxmlElement(f"w:{edge}")
            borders.append(element)
        element.set(qn("w:val"), "single")
        element.set(qn("w:sz"), str(size))
        element.set(qn("w:space"), "0")
        element.set(qn("w:color"), color)


def set_cell_border(cell, **kwargs) -> None:
    """Permite definir bordes por lado: top, left, bottom, right (sz, color)."""
    tc_pr = cell._tc.get_or_add_tcPr()
    tc_borders = tc_pr.find(qn("w:tcBorders"))
    if tc_borders is None:
        tc_borders = OxmlElement("w:tcBorders")
        tc_pr.append(tc_borders)
    for edge, attrs in kwargs.items():
        element = tc_borders.find(qn(f"w:{edge}"))
        if element is None:
            element = OxmlElement(f"w:{edge}")
            tc_borders.append(element)
        for key, value in attrs.items():
            element.set(qn(f"w:{key}"), str(value))


def shade_run(run, hex_fill: str) -> None:
    r_pr = run._element.get_or_add_rPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), hex_fill)
    r_pr.append(shd)


def add_field(paragraph, instruction: str) -> None:
    run = paragraph.add_run()
    begin = OxmlElement("w:fldChar")
    begin.set(qn("w:fldCharType"), "begin")
    instr = OxmlElement("w:instrText")
    instr.set(qn("xml:space"), "preserve")
    instr.text = instruction
    separate = OxmlElement("w:fldChar")
    separate.set(qn("w:fldCharType"), "separate")
    text = OxmlElement("w:t")
    text.text = "Actualice el índice"
    end = OxmlElement("w:fldChar")
    end.set(qn("w:fldCharType"), "end")
    run._r.append(begin)
    run._r.append(instr)
    run._r.append(separate)
    run._r.append(text)
    run._r.append(end)


def add_page_number_field(paragraph) -> None:
    run = paragraph.add_run()
    begin = OxmlElement("w:fldChar")
    begin.set(qn("w:fldCharType"), "begin")
    instr = OxmlElement("w:instrText")
    instr.set(qn("xml:space"), "preserve")
    instr.text = " PAGE "
    end = OxmlElement("w:fldChar")
    end.set(qn("w:fldCharType"), "end")
    run._r.append(begin)
    run._r.append(instr)
    run._r.append(end)


def add_num_pages_field(paragraph) -> None:
    run = paragraph.add_run()
    begin = OxmlElement("w:fldChar")
    begin.set(qn("w:fldCharType"), "begin")
    instr = OxmlElement("w:instrText")
    instr.set(qn("xml:space"), "preserve")
    instr.text = " NUMPAGES "
    end = OxmlElement("w:fldChar")
    end.set(qn("w:fldCharType"), "end")
    run._r.append(begin)
    run._r.append(instr)
    run._r.append(end)


def set_repeat_table_header(row) -> None:
    tr_pr = row._tr.get_or_add_trPr()
    tbl_header = OxmlElement("w:tblHeader")
    tbl_header.set(qn("w:val"), "true")
    tr_pr.append(tbl_header)


def prevent_row_split(row) -> None:
    tr_pr = row._tr.get_or_add_trPr()
    cant_split = OxmlElement("w:cantSplit")
    tr_pr.append(cant_split)


def add_bottom_border(paragraph, color=BLUE_HEX, size=8) -> None:
    p_pr = paragraph._p.get_or_add_pPr()
    p_bdr = p_pr.find(qn("w:pBdr"))
    if p_bdr is None:
        p_bdr = OxmlElement("w:pBdr")
        p_pr.append(p_bdr)
    bottom = OxmlElement("w:bottom")
    bottom.set(qn("w:val"), "single")
    bottom.set(qn("w:sz"), str(size))
    bottom.set(qn("w:space"), "4")
    bottom.set(qn("w:color"), color)
    p_bdr.append(bottom)


# ---------------------------------------------------------------------------
# Markdown: lectura y bloques
# ---------------------------------------------------------------------------
def parse_front_matter(lines: list[str]) -> tuple[dict[str, str], int]:
    if not lines or lines[0].strip() != "---":
        return {}, 0
    meta: dict[str, str] = {}
    for index in range(1, len(lines)):
        line = lines[index].strip()
        if line == "---":
            return meta, index + 1
        if ":" in line:
            key, value = line.split(":", 1)
            value = value.strip().strip('"').strip("'")
            meta[key.strip()] = value
    return meta, 0


def is_table_start(lines: list[str], index: int) -> bool:
    if index + 1 >= len(lines):
        return False
    first = lines[index].strip()
    second = lines[index + 1].strip()
    if not (first.startswith("|") and second.startswith("|")):
        return False
    return bool(re.match(r"^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$", second))


def split_table_row(line: str) -> list[str]:
    text = line.strip()
    if text.startswith("|"):
        text = text[1:]
    if text.endswith("|"):
        text = text[:-1]
    cells: list[str] = []
    current: list[str] = []
    in_code = False
    escaped = False
    for char in text:
        if escaped:
            current.append(char)
            escaped = False
            continue
        if char == "\\":
            escaped = True
            continue
        if char == "`":
            in_code = not in_code
            current.append(char)
            continue
        if char == "|" and not in_code:
            cells.append("".join(current).strip())
            current = []
            continue
        current.append(char)
    cells.append("".join(current).strip())
    return cells


def parse_table(lines: list[str], index: int) -> tuple[list[list[str]], int]:
    header = split_table_row(lines[index])
    separator = split_table_row(lines[index + 1])
    alignments: list[str] = []
    for cell in separator:
        cell = cell.strip()
        if cell.startswith(":") and cell.endswith(":"):
            alignments.append("center")
        elif cell.endswith(":"):
            alignments.append("right")
        else:
            alignments.append("left")

    rows: list[list[str]] = [header]
    index += 2
    while index < len(lines) and lines[index].strip().startswith("|"):
        row = split_table_row(lines[index])
        # Normaliza el numero de columnas.
        if len(row) < len(header):
            row += [""] * (len(header) - len(row))
        elif len(row) > len(header):
            row = row[: len(header)]
        rows.append(row)
        index += 1
    return [rows, alignments], index  # type: ignore[return-value]


# ---------------------------------------------------------------------------
# Renderizado inline
# ---------------------------------------------------------------------------
INLINE_RE = re.compile(r"(\*\*.+?\*\*|`[^`]+`|\*[^*\n]+\*)")


def add_inline(paragraph, text: str, size: float = BODY_SIZE, color=DARK, bold=False) -> None:
    position = 0
    for match in INLINE_RE.finditer(text):
        if match.start() > position:
            run = paragraph.add_run(text[position : match.start()])
            run.font.name = BODY_FONT
            run.font.size = Pt(size)
            run.font.color.rgb = color
            run.bold = bold
        token = match.group(0)
        if token.startswith("**") and token.endswith("**"):
            run = paragraph.add_run(token[2:-2])
            run.font.name = BODY_FONT
            run.font.size = Pt(size)
            run.font.color.rgb = color
            run.bold = True
        elif token.startswith("`") and token.endswith("`"):
            run = paragraph.add_run(token[1:-1])
            run.font.name = CODE_FONT
            run.font.size = Pt(size - 0.7)
            run.font.color.rgb = CODE
            shade_run(run, "F3F4F6")
        elif token.startswith("*") and token.endswith("*"):
            run = paragraph.add_run(token[1:-1])
            run.font.name = BODY_FONT
            run.font.size = Pt(size)
            run.font.color.rgb = color
            run.italic = True
        position = match.end()
    if position < len(text):
        run = paragraph.add_run(text[position:])
        run.font.name = BODY_FONT
        run.font.size = Pt(size)
        run.font.color.rgb = color
        run.bold = bold


# ---------------------------------------------------------------------------
# Documento
# ---------------------------------------------------------------------------
class GuideBuilder:
    def __init__(self, meta: dict[str, str]):
        self.meta = meta
        self.doc = Document()
        self._configure_document()
        self._configure_styles()

    def _configure_document(self) -> None:
        section = self.doc.sections[0]
        section.page_width = Cm(21.0)
        section.page_height = Cm(29.7)
        section.top_margin = Cm(2.0)
        section.bottom_margin = Cm(1.8)
        section.left_margin = Cm(2.2)
        section.right_margin = Cm(2.2)
        section.header_distance = Cm(1.0)
        section.footer_distance = Cm(0.9)
        section.different_first_page_header_footer = True

        props = self.doc.core_properties
        props.title = self.meta.get("title", "Guía práctica de SonarQube")
        props.subject = self.meta.get("subtitle", "Proyecto SATRE")
        props.author = self.meta.get("author", "Equipo SATRE")
        props.keywords = "SonarQube, SATRE, calidad, cobertura, Quality Gate"
        props.comments = "Guía de instalación, análisis y mejora continua"

    def _configure_styles(self) -> None:
        styles = self.doc.styles
        normal = styles["Normal"]
        normal.font.name = BODY_FONT
        normal.font.size = Pt(BODY_SIZE)
        normal.font.color.rgb = DARK
        normal.paragraph_format.space_after = Pt(5)
        normal.paragraph_format.line_spacing = 1.12
        normal.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY

        for name, size, color in (
            ("Heading 1", 19, NAVY),
            ("Heading 2", 13.5, BLUE),
            ("Heading 3", 11.5, NAVY),
        ):
            style = styles[name]
            style.font.name = BODY_FONT
            style.font.size = Pt(size)
            style.font.color.rgb = color
            style.font.bold = True
            style.paragraph_format.keep_with_next = True
            style.paragraph_format.space_before = Pt(12 if name != "Heading 1" else 0)
            style.paragraph_format.space_after = Pt(6)
            style.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.LEFT
            # Asegura la fuente en todos los alfabetos.
            r_pr = style.element.get_or_add_rPr()
            r_fonts = r_pr.find(qn("w:rFonts"))
            if r_fonts is None:
                r_fonts = OxmlElement("w:rFonts")
                r_pr.append(r_fonts)
            for attr in ("w:ascii", "w:hAnsi", "w:cs", "w:eastAsia"):
                r_fonts.set(qn(attr), BODY_FONT)

        for name in ("List Bullet", "List Bullet 2", "List Number"):
            try:
                style = styles[name]
                style.font.name = BODY_FONT
                style.font.size = Pt(BODY_SIZE)
                style.font.color.rgb = DARK
                style.paragraph_format.space_after = Pt(2)
            except KeyError:
                pass

    # -- Portada -----------------------------------------------------------
    def add_cover(self) -> None:
        for _ in range(2):
            self.doc.add_paragraph()

        band = self.doc.add_table(rows=1, cols=1)
        band.alignment = WD_TABLE_ALIGNMENT.CENTER
        band.autofit = False
        cell = band.cell(0, 0)
        cell.width = Cm(16.6)
        set_cell_shading(cell, NAVY_HEX)
        set_cell_margins(cell, top=420, start=360, bottom=420, end=360)
        set_table_borders(band, color=NAVY_HEX, size=4)

        p = cell.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.LEFT
        run = p.add_run("SONARQUBE")
        run.font.name = BODY_FONT
        run.font.size = Pt(11)
        run.font.bold = True
        run.font.color.rgb = RGBColor(0x9D, 0xC3, 0xE6)
        p.paragraph_format.space_after = Pt(6)

        p = cell.add_paragraph()
        run = p.add_run(self.meta.get("title", "GUÍA PRÁCTICA DE SONARQUBE"))
        run.font.name = BODY_FONT
        run.font.size = Pt(27)
        run.font.bold = True
        run.font.color.rgb = WHITE
        p.paragraph_format.space_after = Pt(8)
        p.paragraph_format.line_spacing = 1.0

        p = cell.add_paragraph()
        run = p.add_run(self.meta.get("subtitle", "Proyecto SATRE"))
        run.font.name = BODY_FONT
        run.font.size = Pt(13)
        run.font.color.rgb = RGBColor(0xD6, 0xE4, 0xF0)
        p.paragraph_format.space_after = Pt(0)

        self.doc.add_paragraph().paragraph_format.space_after = Pt(14)

        p = self.doc.add_paragraph()
        run = p.add_run(
            "Instalación, análisis estático, cobertura, Quality Gate, "
            "evidencias y plan de mejora para un monorepo Laravel + React + FastAPI."
        )
        run.font.name = BODY_FONT
        run.font.size = Pt(12)
        run.font.color.rgb = GRAY
        p.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.LEFT
        p.paragraph_format.space_after = Pt(24)

        meta_rows = [
            ("Proyecto", self.meta.get("project", "SATRE")),
            ("Clave Sonar", self.meta.get("key", "uc-group4612142_satre")),
            ("Versión", self.meta.get("version", "1.0")),
            ("Fecha", self.meta.get("date", "Octubre 2026")),
            ("Autor", self.meta.get("author", "Equipo SATRE — COAR Junín")),
        ]
        table = self.doc.add_table(rows=len(meta_rows), cols=2)
        table.autofit = False
        table.alignment = WD_TABLE_ALIGNMENT.LEFT
        table.columns[0].width = Cm(3.6)
        table.columns[1].width = Cm(12.6)
        for row_index, (label, value) in enumerate(meta_rows):
            row = table.rows[row_index]
            prevent_row_split(row)
            left, right = row.cells
            left.width = Cm(3.6)
            right.width = Cm(12.6)
            set_cell_margins(left, top=40, bottom=40, start=0, end=80)
            set_cell_shading(left, "FFFFFF")
            set_cell_shading(right, "FFFFFF")
            p_left = left.paragraphs[0]
            run = p_left.add_run(label.upper())
            run.font.name = BODY_FONT
            run.font.size = Pt(8)
            run.font.bold = True
            run.font.color.rgb = GRAY
            p_right = right.paragraphs[0]
            run = p_right.add_run(value)
            run.font.name = BODY_FONT
            run.font.size = Pt(10)
            run.font.color.rgb = DARK
        # Quita los bordes de la tabla de metadatos.
        set_table_borders(table, color="FFFFFF", size=0)

        self.doc.add_paragraph().paragraph_format.space_after = Pt(12)
        note = self.doc.add_paragraph()
        run = note.add_run(
            "Documento de evidencia técnica. Adaptado de la Guía práctica de SonarQube "
            "para la línea base V1.0 del proyecto SATRE."
        )
        run.font.name = BODY_FONT
        run.font.size = Pt(8.5)
        run.font.italic = True
        run.font.color.rgb = GRAY
        note.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.LEFT
        add_bottom_border(note, color=BORDER_HEX, size=6)

        self.doc.add_page_break()

    # -- Encabezado y pie --------------------------------------------------
    def add_header_footer(self) -> None:
        section = self.doc.sections[0]
        header = section.header
        p = header.paragraphs[0]
        p.text = ""
        p.paragraph_format.tab_stops.add_tab_stop(Cm(16.6), alignment=2)  # type: ignore[arg-type]
        run = p.add_run("Guía práctica de SonarQube")
        run.font.name = BODY_FONT
        run.font.size = Pt(8.5)
        run.font.color.rgb = GRAY
        run = p.add_run("\tSATRE · V1.0")
        run.font.name = BODY_FONT
        run.font.size = Pt(8.5)
        run.font.color.rgb = GRAY
        add_bottom_border(p, color=BORDER_HEX, size=4)

        footer = section.footer
        p = footer.paragraphs[0]
        p.text = ""
        p.paragraph_format.tab_stops.add_tab_stop(Cm(16.6), alignment=2)  # type: ignore[arg-type]
        run = p.add_run("Equipo SATRE — COAR Junín")
        run.font.name = BODY_FONT
        run.font.size = Pt(8)
        run.font.color.rgb = GRAY
        p.add_run("\t")
        run = p.add_run("Página ")
        run.font.name = BODY_FONT
        run.font.size = Pt(8)
        run.font.color.rgb = GRAY
        add_page_number_field(p)
        run = p.add_run(" de ")
        run.font.name = BODY_FONT
        run.font.size = Pt(8)
        run.font.color.rgb = GRAY
        add_num_pages_field(p)

    # -- TOC ---------------------------------------------------------------
    def add_toc(self) -> None:
        p = self.doc.add_paragraph()
        add_field(p, 'TOC \\o "1-3" \\h \\z \\u')
        p.paragraph_format.space_after = Pt(4)
        note = self.doc.add_paragraph()
        run = note.add_run(
            "Si el índice aparece vacío o desactualizado: clic derecho sobre él → "
            "Actualizar campo → Actualizar toda la tabla."
        )
        run.font.name = BODY_FONT
        run.font.size = Pt(8)
        run.font.italic = True
        run.font.color.rgb = GRAY
        note.paragraph_format.space_after = Pt(10)

    # -- Bloques -----------------------------------------------------------
    def add_heading(self, text: str, level: int) -> None:
        if level == 1:
            self.doc.add_page_break()
            p = self.doc.add_heading(level=1)
            run = p.add_run(text)
            add_bottom_border(p, color=BLUE_HEX, size=10)
        else:
            p = self.doc.add_heading(level=level)
            p.add_run(text)

    def add_paragraph(self, text: str) -> None:
        p = self.doc.add_paragraph()
        add_inline(p, text)
        p.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY

    def add_bullets(self, items: list[str], level: int = 1) -> None:
        for item in items:
            if item.startswith("[ ]") or item.startswith("[x]") or item.startswith("[X]"):
                checked = item[1].lower() == "x"
                text = item[3:].strip()
                p = self.doc.add_paragraph()
                p.paragraph_format.left_indent = Cm(0.75)
                p.paragraph_format.first_line_indent = Cm(-0.45)
                p.paragraph_format.space_after = Pt(2)
                run = p.add_run("☑ " if checked else "☐ ")
                run.font.name = "Segoe UI Symbol"
                run.font.size = Pt(10)
                run.font.color.rgb = BLUE
                add_inline(p, text)
                continue

            style = "List Bullet" if level == 1 else "List Bullet 2"
            p = self.doc.add_paragraph(style=style)
            add_inline(p, item)
            p.paragraph_format.space_after = Pt(2)
            p.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.LEFT

    def add_numbered(self, items: list[str]) -> None:
        for number, item in enumerate(items, start=1):
            p = self.doc.add_paragraph()
            p.paragraph_format.left_indent = Cm(0.85)
            p.paragraph_format.first_line_indent = Cm(-0.55)
            p.paragraph_format.space_after = Pt(2)
            p.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.LEFT
            run = p.add_run(f"{number}. ")
            run.font.name = BODY_FONT
            run.font.size = Pt(BODY_SIZE)
            run.font.bold = True
            run.font.color.rgb = BLUE
            add_inline(p, item)

    def add_code(self, code: str) -> None:
        table = self.doc.add_table(rows=1, cols=1)
        table.autofit = False
        table.alignment = WD_TABLE_ALIGNMENT.CENTER
        cell = table.cell(0, 0)
        cell.width = Cm(16.4)
        set_cell_shading(cell, LIGHT_GRAY_HEX)
        set_cell_margins(cell, top=90, bottom=90, start=110, end=110)
        set_table_borders(table, color=BORDER_HEX, size=4)
        set_cell_border(cell, left={"val": "single", "sz": 18, "color": BLUE_HEX, "space": 0})

        # La primera linea del parrafo de la celda ya existe.
        first = True
        for line in code.splitlines() or [""]:
            paragraph = cell.paragraphs[0] if first else cell.add_paragraph()
            first = False
            paragraph.paragraph_format.space_before = Pt(0)
            paragraph.paragraph_format.space_after = Pt(0)
            paragraph.paragraph_format.line_spacing = 1.0
            paragraph.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.LEFT
            run = paragraph.add_run(line if line else " ")
            run.font.name = CODE_FONT
            run.font.size = Pt(8.5)
            run.font.color.rgb = DARK
        # Espacio despues del bloque.
        spacer = self.doc.add_paragraph()
        spacer.paragraph_format.space_after = Pt(2)
        spacer.paragraph_format.line_spacing = 0.6

    def add_callout(self, lines: list[str]) -> None:
        text = " ".join(line.strip() for line in lines if line.strip())
        lower = text.lower()
        if any(word in lower for word in ("importante", "advertencia", "cuidado", "privacidad")):
            fill, border = ORANGE_HEX, ORANGE_BORDER_HEX
        elif any(word in lower for word in ("decisión", "decision", "realidad práctica", "tip")):
            fill, border = GREEN_HEX, GREEN_BORDER_HEX
        else:
            fill, border = LIGHT_BLUE_HEX, BLUE_HEX

        table = self.doc.add_table(rows=1, cols=1)
        table.autofit = False
        table.alignment = WD_TABLE_ALIGNMENT.CENTER
        cell = table.cell(0, 0)
        cell.width = Cm(16.4)
        set_cell_shading(cell, fill)
        set_cell_margins(cell, top=90, bottom=90, start=120, end=120)
        set_table_borders(table, color=fill, size=2)
        set_cell_border(cell, left={"val": "single", "sz": 24, "color": border, "space": 0})

        p = cell.paragraphs[0]
        p.paragraph_format.space_after = Pt(0)
        p.paragraph_format.line_spacing = 1.1
        add_inline(p, text, size=9.5)

        spacer = self.doc.add_paragraph()
        spacer.paragraph_format.space_after = Pt(2)
        spacer.paragraph_format.line_spacing = 0.6

    def add_table(self, rows: list[list[str]], alignments: list[str]) -> None:
        if not rows:
            return
        columns = len(rows[0])
        table = self.doc.add_table(rows=len(rows), cols=columns)
        table.alignment = WD_TABLE_ALIGNMENT.CENTER
        table.autofit = True
        table.allow_autofit = True
        set_table_borders(table, color=BORDER_HEX, size=4)

        font_size = 8.8 if columns <= 3 else 8.0 if columns <= 5 else 7.4
        for row_index, row_values in enumerate(rows):
            row = table.rows[row_index]
            prevent_row_split(row)
            if row_index == 0:
                set_repeat_table_header(row)
            for column_index, value in enumerate(row_values):
                cell = row.cells[column_index]
                set_cell_margins(cell, top=50, bottom=50, start=80, end=80)
                if row_index == 0:
                    set_cell_shading(cell, NAVY_HEX)
                elif row_index % 2 == 0:
                    set_cell_shading(cell, ZEBRA_HEX)
                paragraph = cell.paragraphs[0]
                paragraph.paragraph_format.space_after = Pt(0)
                paragraph.paragraph_format.space_before = Pt(0)
                paragraph.paragraph_format.line_spacing = 1.0
                alignment = alignments[column_index] if column_index < len(alignments) else "left"
                paragraph.alignment = (
                    WD_ALIGN_PARAGRAPH.CENTER
                    if alignment == "center"
                    else WD_ALIGN_PARAGRAPH.RIGHT
                    if alignment == "right"
                    else WD_ALIGN_PARAGRAPH.LEFT
                )
                if row_index == 0:
                    run = paragraph.add_run(value.replace("**", ""))
                    run.font.name = BODY_FONT
                    run.font.size = Pt(font_size)
                    run.font.bold = True
                    run.font.color.rgb = WHITE
                else:
                    add_inline(paragraph, value, size=font_size, color=DARK)

        spacer = self.doc.add_paragraph()
        spacer.paragraph_format.space_after = Pt(2)
        spacer.paragraph_format.line_spacing = 0.6

    def add_rule(self) -> None:
        p = self.doc.add_paragraph()
        p.paragraph_format.space_before = Pt(3)
        p.paragraph_format.space_after = Pt(3)
        add_bottom_border(p, color=BORDER_HEX, size=4)

    # -- Render ------------------------------------------------------------
    def render(self, lines: list[str]) -> None:
        index = 0
        total = len(lines)
        while index < total:
            line = lines[index]
            stripped = line.strip()

            if not stripped:
                index += 1
                continue

            if stripped == "<!-- TOC -->":
                self.add_toc()
                index += 1
                continue

            if stripped == "<!-- pagebreak -->":
                self.doc.add_page_break()
                index += 1
                continue

            if stripped.startswith("```"):
                index += 1
                code_lines: list[str] = []
                while index < total and not lines[index].strip().startswith("```"):
                    code_lines.append(lines[index])
                    index += 1
                index += 1  # cierre
                self.add_code("\n".join(code_lines))
                continue

            if stripped.startswith("#"):
                match = re.match(r"^(#{1,4})\s+(.*)$", stripped)
                if match:
                    level = max(1, min(3, len(match.group(1)) - 1))
                    self.add_heading(match.group(2).strip(), level)
                    index += 1
                    continue

            if is_table_start(lines, index):
                (rows, alignments), index = parse_table(lines, index)
                self.add_table(rows, alignments)
                continue

            if stripped.startswith(">"):
                quote_lines: list[str] = []
                while index < total and lines[index].strip().startswith(">"):
                    quote_lines.append(lines[index].strip().lstrip(">").strip())
                    index += 1
                self.add_callout(quote_lines)
                continue

            if stripped == "---":
                self.add_rule()
                index += 1
                continue

            bullet_match = re.match(r"^(\s*)-\s+(.*)$", line)
            if bullet_match:
                items: list[str] = []
                level = 2 if len(bullet_match.group(1)) >= 2 else 1
                while index < total:
                    match = re.match(r"^(\s*)-\s+(.*)$", lines[index])
                    if not match:
                        break
                    items.append(match.group(2).strip())
                    index += 1
                self.add_bullets(items, level=level)
                continue

            number_match = re.match(r"^\s*(\d+)\.\s+(.*)$", line)
            if number_match:
                items = []
                while index < total:
                    match = re.match(r"^\s*\d+\.\s+(.*)$", lines[index])
                    if not match:
                        break
                    items.append(match.group(1).strip())
                    index += 1
                self.add_numbered(items)
                continue

            # Parrafo: acumula lineas hasta un bloque.
            paragraph_lines = [stripped]
            index += 1
            while index < total:
                candidate = lines[index].strip()
                if not candidate:
                    break
                if (
                    candidate.startswith("#")
                    or candidate.startswith("```")
                    or candidate.startswith(">")
                    or candidate == "---"
                    or candidate == "<!-- TOC -->"
                    or candidate == "<!-- pagebreak -->"
                    or re.match(r"^\s*-\s+", lines[index])
                    or re.match(r"^\s*\d+\.\s+", lines[index])
                    or is_table_start(lines, index)
                ):
                    break
                paragraph_lines.append(candidate)
                index += 1
            self.add_paragraph(" ".join(paragraph_lines))

    def finish(self, output: Path) -> None:
        # Word actualiza los campos (TOC y numeracion) al abrir.
        settings = self.doc.settings.element
        update = settings.find(qn("w:updateFields"))
        if update is None:
            update = OxmlElement("w:updateFields")
            settings.append(update)
        update.set(qn("w:val"), "true")
        self.doc.save(output)


def main() -> None:
    parser = argparse.ArgumentParser(description="Convierte la guía Markdown a DOCX")
    base = Path(__file__).resolve().parent
    parser.add_argument("--input", default=str(base / "GUIA_SONARQUBE_SATRE.md"))
    parser.add_argument("--output", default=str(base / "GUIA_SONARQUBE_SATRE.docx"))
    args = parser.parse_args()

    source = Path(args.input)
    output = Path(args.output)
    lines = source.read_text(encoding="utf-8").splitlines()
    meta, start = parse_front_matter(lines)

    builder = GuideBuilder(meta)
    builder.add_cover()
    builder.add_header_footer()
    builder.render(lines[start:])
    builder.finish(output)

    print(f"Generado: {output}")
    print(f"Párrafos: {len(builder.doc.paragraphs)} | Tablas: {len(builder.doc.tables)}")


if __name__ == "__main__":
    main()
