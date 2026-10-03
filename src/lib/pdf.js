import { jsPDF } from 'jspdf'

const pageWidth = 595.28
const pageHeight = 841.89
const margin = 40

function formatDate(value) {
  if (!value) return 'Non définie'
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return 'Non définie'
  return date.toLocaleDateString('fr-FR')
}

function formatMoney(value, currency = 'XAF') {
  const amount = Number(value ?? 0)
  const formatted = Number.isInteger(amount)
    ? amount.toLocaleString('fr-FR', { maximumFractionDigits: 0 })
    : amount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return `${formatted.replace(/\u202F/g, ' ').replace(/\u00A0/g, ' ').replace(/\s+/g, ' ')} ${currency}`
}

async function fetchImageDataUrl(url) {
  if (!url) return null

  try {
    const response = await fetch(url)
    if (!response.ok) return null
    const blob = await response.blob()
    return await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result)
      reader.onerror = () => reject(new Error('Impossible de lire l’image du logo.'))
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

function drawTable(doc, rows, startY, leftX) {
  const tableLeft = leftX
  const tableWidth = 440
  const descriptionWidth = 220
  const quantityWidth = 55
  const unitPriceWidth = 90
  const amountWidth = 75
  const quantityX = tableLeft + descriptionWidth + quantityWidth / 2
  const unitPriceX = tableLeft + descriptionWidth + quantityWidth + unitPriceWidth / 2
  const amountX = tableLeft + descriptionWidth + quantityWidth + unitPriceWidth + amountWidth

  const headerY = startY
  doc.setFillColor(242, 245, 247)
  doc.roundedRect(tableLeft, headerY, tableWidth, 22, 4, 4, 'F')
  doc.setFontSize(9)
  doc.setTextColor(26, 32, 44)
  doc.text('Désignation', tableLeft + 8, headerY + 14)
  doc.text('Qté', quantityX, headerY + 14, { align: 'center' })
  doc.text('PU', unitPriceX, headerY + 14, { align: 'center' })
  doc.text('Montant', amountX - 8, headerY + 14, { align: 'right' })

  let currentY = headerY + 28
  rows.forEach((row) => {
    if (currentY > pageHeight - 100) {
      doc.addPage()
      currentY = margin
    }

    const descriptionLines = doc.splitTextToSize(String(row.description || '—'), descriptionWidth - 12)
    const height = Math.max(descriptionLines.length * 12, 18)
    doc.setDrawColor(220, 224, 228)
    doc.line(tableLeft, currentY + height, tableLeft + tableWidth, currentY + height)

    doc.setFontSize(9)
    doc.setTextColor(35, 35, 35)
    doc.text(descriptionLines, tableLeft + 8, currentY + 12)
    doc.text(String(row.quantity ?? 0), quantityX, currentY + 12, { align: 'center' })
    doc.text(String(row.unitPrice ?? '0 XAF'), unitPriceX, currentY + 12, { align: 'center' })
    doc.text(String(row.amount ?? '0 XAF'), amountX - 8, currentY + 12, { align: 'right' })

    currentY += height + 8
  })

  return currentY
}

function addTotals(doc, totals, startY, leftX) {
  let baseline = startY
  doc.setFontSize(10)
  doc.setTextColor(35, 35, 35)

  totals.forEach((item) => {
    const label = item.label
    const value = item.value
    doc.text(label, leftX + 220, baseline, { align: 'right' })
    doc.text(value, leftX + 440, baseline, { align: 'right' })
    baseline += 18
  })
}

export async function createInvoicePdf({ invoice, business, logoUrl }) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const currency = business?.currency || 'XAF'
  const logoDataUrl = await fetchImageDataUrl(logoUrl)
  let y = margin

  if (logoDataUrl) {
    try {
      const imageProps = doc.getImageProperties(logoDataUrl)
      const maxWidth = 110
      const maxHeight = 60
      const ratio = Math.min(maxWidth / imageProps.width, maxHeight / imageProps.height)
      const logoWidth = imageProps.width * ratio
      const logoHeight = imageProps.height * ratio
      doc.addImage(logoDataUrl, 'PNG', margin, y, logoWidth, logoHeight)
      y += logoHeight + 16
    } catch {
      // le logo est non bloquant : on continue sans image.
    }
  }

  const companyName = business?.name || 'Entreprise'
  const companyLines = [
    companyName,
    business?.phone ? business.phone : null,
    business?.email ? business.email : null,
    business?.address ? business.address : null,
  ].filter(Boolean)

  if (companyLines.length) {
    doc.setFontSize(11)
    doc.setTextColor(35, 35, 35)
    const rightX = pageWidth - margin
    const companyY = y + 4
    doc.text(companyLines, rightX, companyY, { align: 'right' })
  }

  y = Math.max(y + 26, 115)
  doc.setFontSize(24)
  doc.setTextColor(18, 55, 89)
  doc.text('FACTURE', margin, y)

  const documentNumber = invoice?.number || 'FAC-0000'
  const issueDate = formatDate(invoice?.issue_date)
  const clientName = invoice?.clients?.company_name || invoice?.clients?.name || 'Client non renseigné'
  const clientAddress = invoice?.clients?.address || ''
  const clientPhone = invoice?.clients?.phone || ''
  const clientEmail = invoice?.clients?.email || ''
  const jobTitle = invoice?.jobs?.title || ''

  y += 30
  doc.setFontSize(11)
  doc.setTextColor(60, 60, 60)
  doc.text(`N° : ${documentNumber}`, margin, y)
  doc.text(`Date : ${issueDate}`, margin + 160, y)

  y += 32
  doc.setFontSize(12)
  doc.setTextColor(35, 35, 35)
  doc.text('Client', margin, y)
  const clientDetails = [clientName, clientPhone, clientEmail, clientAddress].filter(Boolean)
  y += 16
  doc.setFontSize(10)
  doc.setTextColor(55, 55, 55)
  clientDetails.forEach((line) => {
    if (y > pageHeight - 50) {
      doc.addPage()
      y = margin
    }
    doc.text(String(line), margin, y)
    y += 14
  })

  if (jobTitle) {
    y += 6
    doc.setTextColor(35, 35, 35)
    doc.text(`Chantier : ${jobTitle}`, margin, y)
    y += 18
  }

  const rows = (invoice?.invoice_items ?? []).map((line) => ({
    description: line.description,
    quantity: Number(line.quantity || 0).toLocaleString('fr-FR', { maximumFractionDigits: 2 }),
    unitPrice: formatMoney(Number(line.unit_price || 0), currency),
    amount: formatMoney(Number(line.amount || 0), currency),
  }))

  const tableStartY = y + 8
  const endTableY = drawTable(doc, rows, tableStartY, margin)

  const totals = []
  if (invoice?.subtotal != null || invoice?.discount != null || invoice?.tax != null) {
    totals.push({ label: 'Sous-total', value: formatMoney(invoice?.subtotal || 0, currency) })
    totals.push({ label: 'Remise', value: formatMoney(invoice?.discount || 0, currency) })
    totals.push({ label: 'Taxe', value: formatMoney(invoice?.tax || 0, currency) })
  }
  
  const paidAmount = Number(invoice?.paidAmount ?? 0)
  const remainingAmount = Number(invoice?.remainingAmount ?? 0)
  if (paidAmount > 0 || remainingAmount > 0 || invoice?.total != null) {
    totals.push({ label: 'Montant payé', value: formatMoney(paidAmount, currency) })
    totals.push({ label: 'Reste à payer', value: formatMoney(remainingAmount, currency) })
  }
  totals.push({ label: 'Total', value: formatMoney(invoice?.total || 0, currency) })

  const totalsY = endTableY + 26
  addTotals(doc, totals, totalsY, margin)

  if (invoice?.notes) {
    const notesY = totalsY + totals.length * 18 + 20
    doc.setFontSize(10)
    doc.setTextColor(55, 55, 55)
    const noteLines = doc.splitTextToSize(`Notes : ${invoice.notes}`, 500)
    doc.text(noteLines, margin, notesY)
  }

  return doc.output('blob')
}

export async function createQuotePdf({ quote, business, logoUrl }) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const currency = business?.currency || 'XAF'
  const logoDataUrl = await fetchImageDataUrl(logoUrl)
  let y = margin

  if (logoDataUrl) {
    try {
      const imageProps = doc.getImageProperties(logoDataUrl)
      const maxWidth = 110
      const maxHeight = 60
      const ratio = Math.min(maxWidth / imageProps.width, maxHeight / imageProps.height)
      const logoWidth = imageProps.width * ratio
      const logoHeight = imageProps.height * ratio
      doc.addImage(logoDataUrl, 'PNG', margin, y, logoWidth, logoHeight)
      y += logoHeight + 16
    } catch {
      // le logo est non bloquant : on continue sans image.
    }
  }

  const companyName = business?.name || 'Entreprise'
  const companyLines = [
    companyName,
    business?.phone ? business.phone : null,
    business?.email ? business.email : null,
    business?.address ? business.address : null,
  ].filter(Boolean)

  if (companyLines.length) {
    const rightX = pageWidth - margin
    doc.setFontSize(11)
    doc.setTextColor(35, 35, 35)
    doc.text(companyLines, rightX, y + 4, { align: 'right' })
  }

  y = Math.max(y + 26, 115)
  doc.setFontSize(24)
  doc.setTextColor(18, 55, 89)
  doc.text('DEVIS', margin, y)

  const documentNumber = quote?.number || 'DEV-0000'
  const issueDate = formatDate(quote?.issue_date)
  const clientName = quote?.clients?.company_name || quote?.clients?.name || 'Client non renseigné'
  const clientAddress = quote?.clients?.address || ''
  const clientPhone = quote?.clients?.phone || ''
  const clientEmail = quote?.clients?.email || ''
  const jobTitle = quote?.jobs?.title || ''
  const validity = quote?.valid_until ? formatDate(quote.valid_until) : 'Non définie'

  y += 30
  doc.setFontSize(11)
  doc.setTextColor(60, 60, 60)
  doc.text(`N° : ${documentNumber}`, margin, y)
  doc.text(`Date : ${issueDate}`, margin + 160, y)

  y += 32
  doc.setFontSize(12)
  doc.setTextColor(35, 35, 35)
  doc.text('Client', margin, y)
  const clientDetails = [clientName, clientPhone, clientEmail, clientAddress].filter(Boolean)
  y += 16
  doc.setFontSize(10)
  doc.setTextColor(55, 55, 55)
  clientDetails.forEach((line) => {
    if (y > pageHeight - 50) {
      doc.addPage()
      y = margin
    }
    doc.text(String(line), margin, y)
    y += 14
  })

  if (jobTitle) {
    y += 6
    doc.setTextColor(35, 35, 35)
    doc.text(`Chantier : ${jobTitle}`, margin, y)
    y += 18
  }

  doc.text(`Validité : ${validity}`, margin, y)
  y += 18

  const rows = (quote?.quote_items ?? []).map((line) => ({
    description: line.description,
    quantity: Number(line.quantity || 0).toLocaleString('fr-FR', { maximumFractionDigits: 2 }),
    unitPrice: formatMoney(Number(line.unit_price || 0), currency),
    amount: formatMoney(Number(line.amount || 0), currency),
  }))

  const tableStartY = y + 8
  const endTableY = drawTable(doc, rows, tableStartY, margin)

  const totals = []
  if (quote?.subtotal != null || quote?.discount != null || quote?.tax != null) {
    totals.push({ label: 'Sous-total', value: formatMoney(quote?.subtotal || 0, currency) })
    totals.push({ label: 'Remise', value: formatMoney(quote?.discount || 0, currency) })
    totals.push({ label: 'Taxe', value: formatMoney(quote?.tax || 0, currency) })
  }
  totals.push({ label: 'Total', value: formatMoney(quote?.total || 0, currency) })

  const totalsY = endTableY + 26
  addTotals(doc, totals, totalsY, margin)

  if (quote?.notes) {
    const notesY = totalsY + totals.length * 18 + 20
    doc.setFontSize(10)
    doc.setTextColor(55, 55, 55)
    const noteLines = doc.splitTextToSize(`Notes : ${quote.notes}`, 500)
    doc.text(noteLines, margin, notesY)
  }

  return doc.output('blob')
}
