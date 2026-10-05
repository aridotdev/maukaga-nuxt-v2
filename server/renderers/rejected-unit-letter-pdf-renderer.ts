import PDFDocument from 'pdfkit'
import {
  createRejectedUnitLetterTemplate,
  type RejectedUnitLetterTemplate,
  type RejectedUnitLetterTemplateField,
} from '../templates/rejected-unit-letter-template'
import type { RejectedUnitLetterViewModel } from '../services/rejected-unit-letter-service'

const PAGE_MARGIN = 48
const BODY_FONT = 'Helvetica'
const BOLD_FONT = 'Helvetica-Bold'
const ITALIC_FONT = 'Helvetica-Oblique'
const BODY_FONT_SIZE = 10
const SMALL_FONT_SIZE = 8
const LINE_GAP = 2
const TABLE_CELL_PADDING = 4
const TABLE_HEADER_FONT_SIZE = 8
const TABLE_BORDER_COLOR = '#9ca3af'
const TABLE_BORDER_WIDTH = 0.5

export function renderRejectedUnitLetterPdf(
  viewModel: RejectedUnitLetterViewModel,
): Promise<Buffer> {
  if (!viewModel.items.length) {
    return Promise.reject(new Error('At least one letter item is required'))
  }

  const template = createRejectedUnitLetterTemplate(viewModel)
  const document = new PDFDocument({
    size: 'A4',
    margin: PAGE_MARGIN,
    autoFirstPage: true,
  })
  const chunks: Buffer[] = []

  return new Promise((resolve, reject) => {
    document.on('data', chunk => chunks.push(Buffer.from(chunk)))
    document.on('end', () => resolve(Buffer.concat(chunks)))
    document.on('error', reject)

    drawLetter(document, template)
    document.end()
  })
}

function drawLetter(
  document: PDFKit.PDFDocument,
  template: RejectedUnitLetterTemplate,
): void {
  const contentWidth = document.page.width - PAGE_MARGIN * 2
  let y = PAGE_MARGIN

  document.font(BOLD_FONT).fontSize(14)
  y = drawCenteredText(document, template.title, y, contentWidth) + 12

  document.font(BODY_FONT).fontSize(BODY_FONT_SIZE)
  y = drawCenteredText(
    document,
    `${template.letterNumber.label}: ${template.letterNumber.value}`,
    y,
    contentWidth,
  ) + 18

  y = drawText(document, template.opening, PAGE_MARGIN, y, contentWidth) + 8
  y = drawFields(document, template.applicantFields, y, contentWidth) + 12
  y = drawText(document, template.detailIntro, PAGE_MARGIN, y, contentWidth) + 8
  y = drawTable(document, template, y, contentWidth) + 16
  y = drawText(document, template.statementHeading, PAGE_MARGIN, y, contentWidth) + 8

  for (const [index, statement] of template.statements.entries()) {
    y = drawWrappedParagraph(
      document,
      `${index + 1}. ${statement}`,
      PAGE_MARGIN,
      y,
      contentWidth,
    ) + 6
  }

  y = drawText(document, template.closing, PAGE_MARGIN, y, contentWidth) + 30
  drawSignature(document, template, y, contentWidth)
}

function drawFields(
  document: PDFKit.PDFDocument,
  fields: RejectedUnitLetterTemplateField[],
  startY: number,
  contentWidth: number,
): number {
  const labelWidth = 100
  let y = startY

  for (const field of fields) {
    const valueWidth = contentWidth - labelWidth
    const valueHeight = textHeight(document, field.value, valueWidth)

    y = ensureSpace(document, y, valueHeight)
    document.font(BODY_FONT).fontSize(BODY_FONT_SIZE)
    document.text(field.label, PAGE_MARGIN, y, {
      width: labelWidth,
      lineGap: LINE_GAP,
    })
    document.text(`:  ${field.value}`, PAGE_MARGIN + labelWidth, y, {
      width: valueWidth,
      lineGap: LINE_GAP,
    })
    y += valueHeight
  }

  return y
}

function drawTable(
  document: PDFKit.PDFDocument,
  template: RejectedUnitLetterTemplate,
  startY: number,
  contentWidth: number,
): number {
  const widths = [38, 72, 75, 80, 85, 62, contentWidth - 412]
  let y = startY

  const headerHeight = tableRowHeight(document, template.tableHeaders, widths, true)
  if (y + headerHeight > pageBottom(document)) {
    document.addPage({ size: 'A4', margin: PAGE_MARGIN })
    y = PAGE_MARGIN
  }
  y = drawTableRow(document, template.tableHeaders, widths, y, true)

  for (const row of template.tableRows) {
    const cells = [
      row.noItem,
      row.pemilik,
      row.model,
      row.produk,
      row.nomorSeri,
      row.keputusanAwal,
      row.alasan,
    ]
    const rowHeight = tableRowHeight(document, cells, widths, false)

    if (y + rowHeight > pageBottom(document)) {
      document.addPage({ size: 'A4', margin: PAGE_MARGIN })
      y = PAGE_MARGIN
      y = drawTableRow(document, template.tableHeaders, widths, y, true)
    }

    y = drawTableRow(document, cells, widths, y, false)
  }

  return y
}

function drawTableRow(
  document: PDFKit.PDFDocument,
  cells: readonly string[],
  widths: readonly number[],
  y: number,
  header: boolean,
): number {
  const rowHeight = tableRowHeight(document, cells, widths, header)
  let x = PAGE_MARGIN

  document.font(header ? BOLD_FONT : BODY_FONT)
  document.fontSize(header ? TABLE_HEADER_FONT_SIZE : SMALL_FONT_SIZE)

  for (const [index, cell] of cells.entries()) {
    const width = widths[index] ?? 0
    document
      .save()
      .lineWidth(TABLE_BORDER_WIDTH)
      .fillColor('#ffffff')
      .rect(x, y, width, rowHeight)
      .fillAndStroke('#ffffff', TABLE_BORDER_COLOR)
      .restore()

    document.fillColor('#111827').text(cell, x + TABLE_CELL_PADDING, y + TABLE_CELL_PADDING, {
      width: width - TABLE_CELL_PADDING * 2,
      height: rowHeight - TABLE_CELL_PADDING * 2,
      lineGap: 1,
    })
    x += width
  }

  return y + rowHeight
}

function tableRowHeight(
  document: PDFKit.PDFDocument,
  cells: readonly string[],
  widths: readonly number[],
  header: boolean,
): number {
  document.font(header ? BOLD_FONT : BODY_FONT)
  document.fontSize(header ? TABLE_HEADER_FONT_SIZE : SMALL_FONT_SIZE)

  const heights = cells.map((cell, index) =>
    textHeight(document, cell, (widths[index] ?? 0) - TABLE_CELL_PADDING * 2, 1),
  )
  return Math.max(22, Math.max(...heights) + TABLE_CELL_PADDING * 2)
}

function drawSignature(
  document: PDFKit.PDFDocument,
  template: RejectedUnitLetterTemplate,
  startY: number,
  contentWidth: number,
): void {
  const signatureColumnWidth = contentWidth / 2
  const rightColumnX = PAGE_MARGIN + signatureColumnWidth
  startY = ensureSpace(document, startY, 100)
  const signatureNameY = startY + 58

  document.font(BODY_FONT).fontSize(BODY_FONT_SIZE)
  document.text(template.signature.placeDate, PAGE_MARGIN, startY, {
    width: signatureColumnWidth,
  })
  document.text(template.signature.awareness, rightColumnX, startY, {
    width: signatureColumnWidth,
    align: 'center',
  })

  document.text(template.signature.applicantName, PAGE_MARGIN, signatureNameY, {
    width: signatureColumnWidth,
  })
  document.text(template.signature.departmentHeadLabel, rightColumnX, signatureNameY, {
    width: signatureColumnWidth,
    align: 'center',
  })
  document.text(template.signature.applicantLabel, PAGE_MARGIN, signatureNameY + 14, {
    width: signatureColumnWidth,
  })
  document
    .font(ITALIC_FONT)
    .fontSize(SMALL_FONT_SIZE)
    .text(template.signature.note, PAGE_MARGIN, signatureNameY + 30, {
      width: contentWidth,
      lineGap: 1,
    })
}

function drawCenteredText(
  document: PDFKit.PDFDocument,
  value: string,
  y: number,
  contentWidth: number,
): number {
  document.text(value, PAGE_MARGIN, y, {
    width: contentWidth,
    align: 'center',
    lineGap: LINE_GAP,
  })
  return y + textHeight(document, value, contentWidth)
}

function drawText(
  document: PDFKit.PDFDocument,
  value: string,
  x: number,
  y: number,
  width: number,
): number {
  document.font(BODY_FONT).fontSize(BODY_FONT_SIZE)
  y = ensureSpace(document, y, textHeight(document, value, width))
  document.text(value, x, y, { width, lineGap: LINE_GAP })
  return y + textHeight(document, value, width)
}

function drawWrappedParagraph(
  document: PDFKit.PDFDocument,
  value: string,
  x: number,
  y: number,
  width: number,
): number {
  document.font(BODY_FONT).fontSize(BODY_FONT_SIZE)
  const height = textHeight(document, value, width)
  y = ensureSpace(document, y, height)
  document.text(value, x, y, { width, lineGap: LINE_GAP })
  return y + height
}

function textHeight(
  document: PDFKit.PDFDocument,
  value: string,
  width: number,
  lineGap = LINE_GAP,
): number {
  return document.heightOfString(value, { width, lineGap })
}

function ensureSpace(
  document: PDFKit.PDFDocument,
  y: number,
  height: number,
): number {
  if (y + height <= pageBottom(document)) return y
  document.addPage({ size: 'A4', margin: PAGE_MARGIN })
  return PAGE_MARGIN
}

function pageBottom(document: PDFKit.PDFDocument): number {
  return document.page.height - PAGE_MARGIN
}
