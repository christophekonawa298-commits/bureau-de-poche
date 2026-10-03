import { useEffect, useMemo, useState } from 'react'
import { FileText, Pencil, Plus, Search, Trash2, WalletCards, X } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { getBusinessLogoSignedUrl } from '../services/businesses'
import { createInvoice, deleteInvoice, getInvoice, getInvoiceClients, getInvoiceJobs, getInvoiceQuotes, getInvoices, updateInvoice } from '../services/invoices'
import { createPayment, deletePayment, getPayments, updatePayment } from '../services/payments'
import { createInvoicePdf } from '../lib/pdf'

const statuses = { draft: 'Brouillon', sent: 'Envoyée', paid: 'Payée', overdue: 'En retard', cancelled: 'Annulée' }
const methods = { cash: 'Espèces', transfer: 'Virement', mobile_money: 'Mobile Money', cheque: 'Chèque', other: 'Autre' }
const today = new Date().toISOString().slice(0, 10)
const emptyInvoice = { client_id: '', job_id: '', quote_id: '', issue_date: today, due_date: '', status: 'draft', discount: 0, tax: 0, notes: '' }
const emptyLine = { description: '', quantity: 1, unit_price: 0 }

function money(value) { return `${Number(value ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} XAF` }
function lineAmount(line) { return Number(line.quantity || 0) * Number(line.unit_price || 0) }
function invoiceNumber() { return `FAC-${Date.now()}` }
function formatDate(value) { return value ? new Date(`${value}T00:00:00`).toLocaleDateString('fr-FR') : 'non définie' }

function InvoicesPage() {
  const { business } = useAuth()
  const [invoices, setInvoices] = useState([])
  const [clients, setClients] = useState([])
  const [jobs, setJobs] = useState([])
  const [quotes, setQuotes] = useState([])
  const [selected, setSelected] = useState(null)
  const [editing, setEditing] = useState(null)
  const [formOpen, setFormOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [formError, setFormError] = useState('')

  async function loadData() {
    setLoading(true); setError('')
    try { const [nextInvoices, nextClients, nextJobs, nextQuotes] = await Promise.all([getInvoices(business.id), getInvoiceClients(business.id), getInvoiceJobs(business.id), getInvoiceQuotes(business.id)]); setInvoices(nextInvoices); setClients(nextClients); setJobs(nextJobs); setQuotes(nextQuotes) } catch (loadError) { setError(loadError.message || 'Impossible de charger les factures.') } finally { setLoading(false) }
  }
  useEffect(() => { if (business?.id) loadData() }, [business?.id])
  const filtered = useMemo(() => invoices.filter((invoice) => { const term = search.trim().toLowerCase(); return (!term || [invoice.number, invoice.clients?.name, invoice.clients?.company_name].some((value) => value?.toLowerCase().includes(term))) && (status === 'all' || (status === 'paid' ? invoice.remainingAmount === 0 : invoice.status === status)) }), [invoices, search, status])
  function openCreate(prefill = null) { setEditing(prefill); setFormError(''); setFormOpen(true) }
  function openEdit(invoice) { setEditing(invoice); setSelected(null); setFormError(''); setFormOpen(true) }
  async function openDetails(invoice) { try { setSelected(await getInvoice(invoice.id, business.id)) } catch (detailError) { setError(detailError.message || 'Impossible de charger la facture.') } }
  async function submit(data, items) { setSaving(true); setFormError(''); try { if (editing?.id) await updateInvoice(editing.id, business.id, data, items); else await createInvoice(business.id, { ...data, number: invoiceNumber() }, items); setFormOpen(false); await loadData() } catch (saveError) { setFormError(saveError.message || 'Impossible d’enregistrer la facture.') } finally { setSaving(false) } }
  async function remove(invoice) { if (!window.confirm(`Supprimer définitivement la facture « ${invoice.number} » ?`)) return; try { await deleteInvoice(invoice.id, business.id); setSelected(null); await loadData() } catch (deleteError) { setError(deleteError.message || 'Impossible de supprimer la facture.') } }

  return <section className="content module-content"><div className="module-header"><div><p className="eyebrow">Suivi de votre facturation</p><h1>Factures</h1><p className="module-subtitle">Suivez les montants facturés, encaissés et restant dus.</p></div><button className="primary-button module-new-button" type="button" onClick={() => openCreate()}><Plus size={17} /> Nouvelle facture</button></div><div className="module-toolbar"><label className="search-field"><Search size={17} /><span className="sr-only">Rechercher</span><input type="search" placeholder="Rechercher par numéro ou client" value={search} onChange={(event) => setSearch(event.target.value)} /></label><select className="filter-select" value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">Tous les statuts</option>{Object.entries(statuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>{error && <p className="form-error" role="alert">{error}</p>}{loading ? <p className="module-state">Chargement des factures...</p> : filtered.length === 0 ? <div className="module-empty"><FileText size={30} /><h2>{search || status !== 'all' ? 'Aucun résultat' : 'Aucune facture pour le moment'}</h2><p>{search || status !== 'all' ? 'Modifiez vos critères de recherche.' : 'Créez votre première facture.'}</p>{!search && status === 'all' && <button className="secondary-button" type="button" onClick={() => openCreate()}>Ajouter une facture</button>}</div> : <div className="entity-list">{filtered.map((invoice) => <article className="entity-row" key={invoice.id} onClick={() => openDetails(invoice)}><div className="entity-icon"><FileText size={19} /></div><div className="entity-main"><h2>{invoice.number}</h2><p>{invoice.clients?.name ?? 'Client indisponible'}{invoice.jobs?.title && <> · {invoice.jobs.title}</>}</p><p className="entity-meta">Émise le {formatDate(invoice.issue_date)} · Échéance {formatDate(invoice.due_date)}</p></div><div className="invoice-amounts"><span className={`status-badge ${invoice.remainingAmount === 0 ? 'paid' : invoice.status}`}>{invoice.remainingAmount === 0 ? 'Payée' : statuses[invoice.status]}</span><strong>{money(invoice.total)}</strong><small>Payé {money(invoice.paidAmount)} · Solde {money(invoice.remainingAmount)}</small></div></article>)}</div>}{formOpen && <InvoiceForm invoice={editing} clients={clients} jobs={jobs} quotes={quotes} saving={saving} error={formError} onClose={() => setFormOpen(false)} onSubmit={submit} />}{selected && <InvoiceDetails invoice={selected} businessId={business.id} business={business} onClose={() => setSelected(null)} onEdit={() => openEdit(selected)} onDelete={() => remove(selected)} onChanged={async () => { const refreshed = await getInvoice(selected.id, business.id); setSelected(refreshed); await loadData() }} />}</section>
}

function InvoiceForm({ invoice, clients, jobs, quotes, saving, error, onClose, onSubmit }) {
  const initial = invoice ?? emptyInvoice
  const [form, setForm] = useState({ ...emptyInvoice, ...initial })
  const [lines, setLines] = useState(invoice?.invoice_items?.map(({ description, quantity, unit_price }) => ({ description, quantity, unit_price })) ?? [{ ...emptyLine }])
  const [localError, setLocalError] = useState('')
  const subtotal = lines.reduce((sum, line) => sum + lineAmount(line), 0)
  const total = Math.max(0, subtotal - Number(form.discount || 0) + Number(form.tax || 0))
  const availableJobs = jobs.filter((job) => !form.client_id || job.client_id === form.client_id)
  const availableQuotes = quotes.filter((quote) => !form.client_id || quote.client_id === form.client_id)
  function update(field, value) { setForm((current) => ({ ...current, [field]: value, ...(field === 'client_id' ? { job_id: '', quote_id: '' } : {}) })) }
  function selectQuote(value) { const quote = quotes.find((item) => item.id === value); if (!quote) { update('quote_id', ''); return } setForm((current) => ({ ...current, quote_id: quote.id, client_id: quote.client_id, job_id: quote.job_id ?? '', discount: quote.discount ?? 0, tax: quote.tax ?? 0, notes: quote.notes ?? '' })); setLines((quote.quote_items ?? []).map(({ description, quantity, unit_price }) => ({ description, quantity, unit_price }))) }
  function updateLine(index, field, value) { setLines((current) => current.map((line, lineIndex) => lineIndex === index ? { ...line, [field]: value } : line)) }
  function submit(event) { event.preventDefault(); setLocalError(''); const cleanLines = lines.map((line) => ({ description: line.description.trim(), quantity: Number(line.quantity), unit_price: Number(line.unit_price), amount: lineAmount(line) })); if (!form.client_id || cleanLines.some((line) => !line.description)) { setLocalError('Le client et la description de chaque ligne sont obligatoires.'); return } if (cleanLines.some((line) => line.quantity < 0 || line.unit_price < 0 || Number.isNaN(line.quantity) || Number.isNaN(line.unit_price))) { setLocalError('Les quantités et prix doivent être positifs ou nuls.'); return } onSubmit({ client_id: form.client_id, job_id: form.job_id || null, quote_id: form.quote_id || null, issue_date: form.issue_date || today, due_date: form.due_date || null, status: form.status, subtotal, discount: Number(form.discount || 0), tax: Number(form.tax || 0), total, notes: form.notes?.trim() || null }, cleanLines) }
  return <div className="modal-backdrop"><section className="client-modal" role="dialog" aria-modal="true" aria-labelledby="invoice-form-title"><div className="modal-header"><div><p className="eyebrow">{invoice ? 'Modifier la facture' : 'Nouvelle facture'}</p><h2 id="invoice-form-title">{invoice?.number ?? 'Créer une facture'}</h2></div><button className="icon-button" type="button" aria-label="Fermer" onClick={onClose}><X size={20} /></button></div><form className="client-form" onSubmit={submit}><label>Client *<select value={form.client_id} onChange={(event) => update('client_id', event.target.value)} required><option value="">Sélectionner un client</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label><label>Chantier<select value={form.job_id ?? ''} onChange={(event) => update('job_id', event.target.value)}><option value="">Aucun chantier</option>{availableJobs.map((job) => <option key={job.id} value={job.id}>{job.title}</option>)}</select></label><label>Devis à reprendre<select value={form.quote_id ?? ''} onChange={(event) => selectQuote(event.target.value)}><option value="">Aucun devis</option>{availableQuotes.map((quote) => <option key={quote.id} value={quote.id}>{quote.number} · {money(quote.total)}</option>)}</select></label><div className="form-two-columns"><label>Date d’émission<input type="date" value={form.issue_date} onChange={(event) => update('issue_date', event.target.value)} required /></label><label>Date d’échéance<input type="date" value={form.due_date ?? ''} onChange={(event) => update('due_date', event.target.value)} /></label></div><label>Statut<select value={form.status} onChange={(event) => update('status', event.target.value)}>{Object.entries(statuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><div className="quote-lines"><div className="quote-lines-header"><strong>Lignes de facture</strong><button className="secondary-button" type="button" onClick={() => setLines((current) => [...current, { ...emptyLine }])}><Plus size={14} /> Ajouter une ligne</button></div>{lines.map((line, index) => <div className="quote-line" key={index}><input aria-label="Description" placeholder="Description" value={line.description} onChange={(event) => updateLine(index, 'description', event.target.value)} /><input aria-label="Quantité" type="number" min="0" step="0.01" value={line.quantity} onChange={(event) => updateLine(index, 'quantity', event.target.value)} /><input aria-label="Prix unitaire" type="number" min="0" step="0.01" value={line.unit_price} onChange={(event) => updateLine(index, 'unit_price', event.target.value)} /><strong>{money(lineAmount(line))}</strong>{lines.length > 1 && <button className="icon-button" type="button" aria-label="Supprimer la ligne" onClick={() => setLines((current) => current.filter((_, lineIndex) => lineIndex !== index))}><Trash2 size={15} /></button>}</div>)}</div><div className="quote-summary"><label>Remise<input type="number" min="0" step="0.01" value={form.discount} onChange={(event) => update('discount', event.target.value)} /></label><label>Taxe<input type="number" min="0" step="0.01" value={form.tax} onChange={(event) => update('tax', event.target.value)} /></label><strong>Total : {money(total)}</strong></div><label>Notes<textarea value={form.notes ?? ''} onChange={(event) => update('notes', event.target.value)} rows="3" /></label>{(error || localError) && <p className="form-error" role="alert">{error || localError}</p>}<div className="modal-actions"><button className="secondary-button" type="button" onClick={onClose}>Annuler</button><button className="primary-button" type="submit" disabled={saving}>{saving ? 'Enregistrement...' : 'Enregistrer'}</button></div></form></section></div>
}

function InvoiceDetails({ invoice, businessId, business, onClose, onEdit, onDelete, onChanged }) {
  const [payments, setPayments] = useState(invoice.payments ?? [])
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [editingPayment, setEditingPayment] = useState(null)
  const [paymentError, setPaymentError] = useState('')
  const [pdfError, setPdfError] = useState('')
  const [pdfLoading, setPdfLoading] = useState(false)

  async function refreshPayments() { setPayments(await getPayments(invoice.id, businessId)); await onChanged() }
  async function savePayment(data) { setPaymentError(''); try { if (editingPayment) await updatePayment(editingPayment.id, businessId, invoice.id, data); else await createPayment(businessId, invoice.id, data); setPaymentOpen(false); setEditingPayment(null); await refreshPayments() } catch (error) { setPaymentError(error.message || 'Impossible d’enregistrer le paiement.') } }
  async function removePayment(payment) { if (!window.confirm('Supprimer ce paiement ?')) return; try { await deletePayment(payment.id, businessId, invoice.id); await refreshPayments() } catch (error) { setPaymentError(error.message || 'Impossible de supprimer le paiement.') } }
  async function exportPdf() {
    if (pdfLoading) return
    setPdfError('')
    setPdfLoading(true)
    try {
      const logoUrl = business?.logo_url ? await getBusinessLogoSignedUrl(business.id, business.logo_url) : null
      const pdfBlob = await createInvoicePdf({ invoice, business, logoUrl })
      const objectUrl = URL.createObjectURL(pdfBlob)
      const link = document.createElement('a')
      link.href = objectUrl
      link.download = `Facture_${invoice.number}.pdf`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
    } catch (error) {
      setPdfError(error.message || 'Impossible de générer le PDF de la facture.')
    } finally {
      setPdfLoading(false)
    }
  }
  const paid = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
  const remaining = Math.max(Number(invoice.total || 0) - paid, 0)
  return <div className="modal-backdrop"><section className="client-modal" role="dialog" aria-modal="true" aria-labelledby="invoice-details-title"><div className="modal-header"><div><p className="eyebrow">Fiche facture</p><h2 id="invoice-details-title">{invoice.number}</h2></div><button className="icon-button" type="button" aria-label="Fermer" onClick={onClose}><X size={20} /></button></div><div className="details-grid"><Detail label="Client" value={invoice.clients?.name ?? 'Non renseigné'} /><Detail label="Chantier" value={invoice.jobs?.title ?? 'Aucun chantier'} /><Detail label="Devis lié" value={invoice.quotes?.number ?? 'Aucun devis'} /><Detail label="Dates" value={`${formatDate(invoice.issue_date)} · échéance ${formatDate(invoice.due_date)}`} /></div><div className="details-meta"><span className={`status-badge ${remaining === 0 ? 'paid' : invoice.status}`}>{remaining === 0 ? 'Payée' : statuses[invoice.status]}</span><strong>{money(invoice.total)}</strong></div><div className="quote-detail-lines">{invoice.invoice_items?.map((line) => <div key={line.id}><span>{line.description} · {line.quantity} × {money(line.unit_price)}</span><strong>{money(line.amount)}</strong></div>)}</div><div className="quote-totals"><span>Sous-total <strong>{money(invoice.subtotal)}</strong></span><span>Remise <strong>{money(invoice.discount)}</strong></span><span>Taxe <strong>{money(invoice.tax)}</strong></span><span>Montant payé <strong>{money(paid)}</strong></span><span>Solde restant <strong>{money(remaining)}</strong></span><span>Total <strong>{money(invoice.total)}</strong></span></div>{invoice.notes && <div className="notes-block"><strong>Notes</strong><p>{invoice.notes}</p></div>}<div className="payment-heading"><strong>Paiements</strong><button className="secondary-button" type="button" disabled={remaining <= 0} onClick={() => { setEditingPayment(null); setPaymentError(''); setPaymentOpen(true) }}><WalletCards size={15} /> Enregistrer un paiement</button></div>{pdfError && <p className="form-error" role="alert">{pdfError}</p>}<div className="future-sections"><button className="secondary-button" type="button" onClick={exportPdf} disabled={pdfLoading}>{pdfLoading ? 'Génération...' : 'Impression / export PDF'}</button></div>{payments.length === 0 ? <p className="module-state">Aucun paiement enregistré.</p> : <div className="payment-list">{payments.map((payment) => <div className="payment-row" key={payment.id}><div><strong>{money(payment.amount)}</strong><span>{formatDate(payment.payment_date)} · {methods[payment.method] ?? payment.method ?? 'Méthode non définie'}</span></div><div><button className="icon-button" type="button" aria-label="Modifier le paiement" onClick={() => { setEditingPayment(payment); setPaymentError(''); setPaymentOpen(true) }}><Pencil size={15} /></button><button className="icon-button" type="button" aria-label="Supprimer le paiement" onClick={() => removePayment(payment)}><Trash2 size={15} /></button></div></div>)}</div>}<div className="future-sections"><span>Impression / export PDF</span></div><div className="modal-actions"><button className="danger-button" type="button" onClick={onDelete}><Trash2 size={16} /> Supprimer</button><button className="primary-button" type="button" onClick={onEdit}><Pencil size={16} /> Modifier</button></div>{paymentOpen && <PaymentForm payment={editingPayment} error={paymentError} onClose={() => setPaymentOpen(false)} onSubmit={savePayment} />}</section></div>
}

function PaymentForm({ payment, error, onClose, onSubmit }) {
  function submit(event) { event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget).entries()); onSubmit({ amount: Number(values.amount), payment_date: values.payment_date, method: values.method, reference: values.reference.trim() || null, note: values.note.trim() || null }) }
  return <div className="payment-form-wrap"><div className="modal-header"><div><p className="eyebrow">Paiement</p><h3>{payment ? 'Modifier le paiement' : 'Enregistrer un paiement'}</h3></div><button className="icon-button" type="button" aria-label="Fermer le formulaire" onClick={onClose}><X size={18} /></button></div><form className="client-form" onSubmit={submit}><label>Montant *<input name="amount" type="number" min="0.01" step="0.01" defaultValue={payment?.amount ?? ''} required /></label><label>Date de paiement<input name="payment_date" type="date" defaultValue={payment?.payment_date ?? today} required /></label><label>Méthode<select name="method" defaultValue={payment?.method ?? 'cash'}>{Object.entries(methods).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label>Référence<input name="reference" defaultValue={payment?.reference ?? ''} /></label><label>Note<textarea name="note" defaultValue={payment?.note ?? ''} rows="2" /></label>{error && <p className="form-error" role="alert">{error}</p>}<div className="modal-actions"><button className="secondary-button" type="button" onClick={onClose}>Annuler</button><button className="primary-button" type="submit">Enregistrer</button></div></form></div>
}

function Detail({ label, value }) { return <div className="detail-item"><div><span>{label}</span><strong>{value}</strong></div></div> }

export default InvoicesPage
