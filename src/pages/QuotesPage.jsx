import { useEffect, useMemo, useState } from 'react'
import { FileText, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { getBusinessLogoSignedUrl } from '../services/businesses'
import { createQuotePdf } from '../lib/pdf'
import { createQuote, deleteQuote, getQuote, getQuoteClients, getQuoteJobs, getQuotes, updateQuote } from '../services/quotes'

const quoteStatuses = { draft: 'Brouillon', sent: 'Envoyé', accepted: 'Accepté', rejected: 'Refusé', expired: 'Expiré' }
const today = new Date().toISOString().slice(0, 10)
const emptyQuote = { client_id: '', job_id: '', issue_date: today, valid_until: '', status: 'draft', discount: 0, tax: 0, notes: '' }
const emptyLine = { description: '', quantity: 1, unit_price: 0 }

function money(value) { return `${Number(value ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} XAF` }
function lineAmount(line) { return Number(line.quantity || 0) * Number(line.unit_price || 0) }
function quoteNumber() { return `DEV-${Date.now()}` }

function QuotesPage() {
  const { business } = useAuth()
  const [quotes, setQuotes] = useState([])
  const [clients, setClients] = useState([])
  const [jobs, setJobs] = useState([])
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
    try { const [nextQuotes, nextClients, nextJobs] = await Promise.all([getQuotes(business.id), getQuoteClients(business.id), getQuoteJobs(business.id)]); setQuotes(nextQuotes); setClients(nextClients); setJobs(nextJobs) } catch (loadError) { setError(loadError.message || 'Impossible de charger les devis.') } finally { setLoading(false) }
  }
  useEffect(() => { if (business?.id) loadData() }, [business?.id])
  const filtered = useMemo(() => quotes.filter((quote) => { const term = search.trim().toLowerCase(); return (!term || [quote.number, quote.clients?.name, quote.clients?.company_name].some((value) => value?.toLowerCase().includes(term))) && (status === 'all' || quote.status === status) }), [quotes, search, status])
  function openCreate() { setEditing(null); setFormError(''); setFormOpen(true) }
  function openEdit(quote) { setEditing(quote); setFormError(''); setSelected(null); setFormOpen(true) }
  async function openDetails(quote) { try { setSelected(await getQuote(quote.id, business.id)) } catch (detailError) { setError(detailError.message || 'Impossible de charger le devis.') } }
  async function submit(data, items) {
    setSaving(true); setFormError('')
    try { if (editing) await updateQuote(editing.id, business.id, data, items); else await createQuote(business.id, { ...data, number: quoteNumber() }, items); setFormOpen(false); await loadData() } catch (saveError) { setFormError(saveError.message || 'Impossible d’enregistrer le devis.') } finally { setSaving(false) }
  }
  async function remove(quote) { if (!window.confirm(`Supprimer définitivement le devis « ${quote.number} » ?`)) return; try { await deleteQuote(quote.id, business.id); setSelected(null); await loadData() } catch (deleteError) { setError(deleteError.message || 'Impossible de supprimer le devis.') } }

  return <section className="content module-content"><div className="module-header"><div><p className="eyebrow">Vos propositions commerciales</p><h1>Devis</h1><p className="module-subtitle">Préparez vos propositions liées à vos clients et chantiers.</p></div><button className="primary-button module-new-button" type="button" onClick={openCreate}><Plus size={17} /> Nouveau devis</button></div><div className="module-toolbar"><label className="search-field"><Search size={17} /><span className="sr-only">Rechercher</span><input type="search" placeholder="Rechercher par numéro ou client" value={search} onChange={(event) => setSearch(event.target.value)} /></label><select className="filter-select" value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">Tous les statuts</option>{Object.entries(quoteStatuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>{error && <p className="form-error" role="alert">{error}</p>}{loading ? <p className="module-state">Chargement des devis...</p> : filtered.length === 0 ? <div className="module-empty"><FileText size={30} /><h2>{search || status !== 'all' ? 'Aucun résultat' : 'Aucun devis pour le moment'}</h2><p>{search || status !== 'all' ? 'Modifiez vos critères de recherche.' : 'Créez votre première proposition commerciale.'}</p>{!search && status === 'all' && <button className="secondary-button" type="button" onClick={openCreate}>Ajouter un devis</button>}</div> : <div className="entity-list">{filtered.map((quote) => <article className="entity-row" key={quote.id} onClick={() => openDetails(quote)}><div className="entity-icon"><FileText size={19} /></div><div className="entity-main"><h2>{quote.number}</h2><p>{quote.clients?.name ?? 'Client indisponible'}{quote.jobs?.title && <> · {quote.jobs.title}</>}</p><p className="entity-meta">Émis le {formatDate(quote.issue_date)} · Valide jusqu’au {quote.valid_until ? formatDate(quote.valid_until) : 'non définie'}</p></div><div className="entity-side"><span className={`status-badge ${quote.status}`}>{quoteStatuses[quote.status]}</span><strong>{money(quote.total)}</strong></div></article>)}</div>}{formOpen && <QuoteForm quote={editing} clients={clients} jobs={jobs} saving={saving} error={formError} onClose={() => setFormOpen(false)} onSubmit={submit} />}{selected && <QuoteDetails quote={selected} business={business} onClose={() => setSelected(null)} onEdit={() => openEdit(selected)} onDelete={() => remove(selected)} />}</section>
}

function QuoteForm({ quote, clients, jobs, saving, error, onClose, onSubmit }) {
  const [form, setForm] = useState({ ...emptyQuote, ...(quote ?? {}) })
  const [lines, setLines] = useState(quote?.quote_items?.map(({ description, quantity, unit_price }) => ({ description, quantity, unit_price })) ?? [{ ...emptyLine }])
  const [localError, setLocalError] = useState('')
  const subtotal = lines.reduce((sum, line) => sum + lineAmount(line), 0)
  const total = Math.max(0, subtotal - Number(form.discount || 0) + Number(form.tax || 0))
  const availableJobs = jobs.filter((job) => !form.client_id || job.client_id === form.client_id)
  function update(field, value) { setForm((current) => ({ ...current, [field]: value, ...(field === 'client_id' ? { job_id: '' } : {}) })) }
  function updateLine(index, field, value) { setLines((current) => current.map((line, lineIndex) => lineIndex === index ? { ...line, [field]: value } : line)) }
  function submit(event) { event.preventDefault(); setLocalError(''); const cleanLines = lines.map((line) => ({ description: line.description.trim(), quantity: Number(line.quantity), unit_price: Number(line.unit_price), amount: lineAmount(line) })); if (!form.client_id || cleanLines.some((line) => !line.description)) { setLocalError('Le client et la description de chaque ligne sont obligatoires.'); return } if (cleanLines.some((line) => line.quantity < 0 || line.unit_price < 0)) { setLocalError('Les quantités et prix doivent être positifs ou nuls.'); return } onSubmit({ client_id: form.client_id, job_id: form.job_id || null, issue_date: form.issue_date || today, valid_until: form.valid_until || null, status: form.status, subtotal, discount: Number(form.discount || 0), tax: Number(form.tax || 0), total, notes: form.notes?.trim() || null }, cleanLines) }
  return <div className="modal-backdrop"><section className="client-modal" role="dialog" aria-modal="true" aria-labelledby="quote-form-title"><div className="modal-header"><div><p className="eyebrow">{quote ? 'Modifier le devis' : 'Nouveau devis'}</p><h2 id="quote-form-title">{quote?.number ?? 'Créer un devis'}</h2></div><button className="icon-button" type="button" aria-label="Fermer" onClick={onClose}><X size={20} /></button></div><form className="client-form" onSubmit={submit}><label>Client *<select value={form.client_id} onChange={(event) => update('client_id', event.target.value)} required><option value="">Sélectionner un client</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label><label>Chantier<select value={form.job_id ?? ''} onChange={(event) => update('job_id', event.target.value)}><option value="">Aucun chantier</option>{availableJobs.map((job) => <option key={job.id} value={job.id}>{job.title}</option>)}</select></label><div className="form-two-columns"><label>Date d’émission<input type="date" value={form.issue_date} onChange={(event) => update('issue_date', event.target.value)} required /></label><label>Valide jusqu’au<input type="date" value={form.valid_until ?? ''} onChange={(event) => update('valid_until', event.target.value)} /></label></div><label>Statut<select value={form.status} onChange={(event) => update('status', event.target.value)}>{Object.entries(quoteStatuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><div className="quote-lines"><div className="quote-lines-header"><strong>Lignes du devis</strong><button className="secondary-button" type="button" onClick={() => setLines((current) => [...current, { ...emptyLine }])}><Plus size={14} /> Ajouter une ligne</button></div>{lines.map((line, index) => <div className="quote-line" key={index}><input aria-label="Description" placeholder="Description" value={line.description} onChange={(event) => updateLine(index, 'description', event.target.value)} required /><input aria-label="Quantité" type="number" min="0" step="0.01" value={line.quantity} onChange={(event) => updateLine(index, 'quantity', event.target.value)} /><input aria-label="Prix unitaire" type="number" min="0" step="0.01" value={line.unit_price} onChange={(event) => updateLine(index, 'unit_price', event.target.value)} /><strong>{money(lineAmount(line))}</strong>{lines.length > 1 && <button className="icon-button" type="button" aria-label="Supprimer la ligne" onClick={() => setLines((current) => current.filter((_, lineIndex) => lineIndex !== index))}><Trash2 size={15} /></button>}</div>)}</div><div className="quote-summary"><label>Remise<input type="number" min="0" step="0.01" value={form.discount} onChange={(event) => update('discount', event.target.value)} /></label><label>Taxe<input type="number" min="0" step="0.01" value={form.tax} onChange={(event) => update('tax', event.target.value)} /></label><strong>Total : {money(total)}</strong></div><label>Notes<textarea value={form.notes ?? ''} onChange={(event) => update('notes', event.target.value)} rows="3" /></label>{(error || localError) && <p className="form-error" role="alert">{error || localError}</p>}<div className="modal-actions"><button className="secondary-button" type="button" onClick={onClose}>Annuler</button><button className="primary-button" type="submit" disabled={saving}>{saving ? 'Enregistrement...' : 'Enregistrer'}</button></div></form></section></div>
}

function QuoteDetails({ quote, business, onClose, onEdit, onDelete }) {
  const [pdfError, setPdfError] = useState('')
  const [pdfLoading, setPdfLoading] = useState(false)

  async function exportPdf() {
    if (pdfLoading) return
    setPdfError('')
    setPdfLoading(true)
    try {
      const logoUrl = business?.logo_url ? await getBusinessLogoSignedUrl(business.id, business.logo_url) : null
      const pdfBlob = await createQuotePdf({ quote, business, logoUrl })
      const objectUrl = URL.createObjectURL(pdfBlob)
      const link = document.createElement('a')
      link.href = objectUrl
      link.download = `Devis_${quote.number}.pdf`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
    } catch (error) {
      setPdfError(error.message || 'Impossible de générer le PDF du devis.')
    } finally {
      setPdfLoading(false)
    }
  }

  return <div className="modal-backdrop"><section className="client-modal" role="dialog" aria-modal="true" aria-labelledby="quote-details-title"><div className="modal-header"><div><p className="eyebrow">Fiche devis</p><h2 id="quote-details-title">{quote.number}</h2></div><button className="icon-button" type="button" aria-label="Fermer" onClick={onClose}><X size={20} /></button></div><div className="details-grid"><Detail label="Client" value={quote.clients?.name ?? 'Non renseigné'} /><Detail label="Chantier" value={quote.jobs?.title ?? 'Aucun chantier'} /><Detail label="Dates" value={`${formatDate(quote.issue_date)} · ${quote.valid_until ? formatDate(quote.valid_until) : 'validité non définie'}`} /></div><div className="details-meta"><span className={`status-badge ${quote.status}`}>{quoteStatuses[quote.status]}</span><strong>{money(quote.total)}</strong></div><div className="quote-detail-lines">{quote.quote_items?.map((line) => <div key={line.id}><span>{line.description} · {line.quantity} × {money(line.unit_price)}</span><strong>{money(line.amount)}</strong></div>)}</div><div className="quote-totals"><span>Sous-total <strong>{money(quote.subtotal)}</strong></span><span>Remise <strong>{money(quote.discount)}</strong></span><span>Taxe <strong>{money(quote.tax)}</strong></span><span>Total <strong>{money(quote.total)}</strong></span></div>{quote.notes && <div className="notes-block"><strong>Notes</strong><p>{quote.notes}</p></div>}{pdfError && <p className="form-error" role="alert">{pdfError}</p>}<div className="future-sections"><button className="secondary-button" type="button" onClick={exportPdf} disabled={pdfLoading}>{pdfLoading ? 'Génération...' : 'Impression / export PDF'}</button></div><div className="modal-actions"><button className="danger-button" type="button" onClick={onDelete}><Trash2 size={16} /> Supprimer</button><button className="primary-button" type="button" onClick={onEdit}><Pencil size={16} /> Modifier</button></div></section></div>
}

function Detail({ label, value }) { return <div className="detail-item"><div><span>{label}</span><strong>{value}</strong></div></div> }
function formatDate(value) { return new Date(`${value}T00:00:00`).toLocaleDateString('fr-FR') }

export default QuotesPage
