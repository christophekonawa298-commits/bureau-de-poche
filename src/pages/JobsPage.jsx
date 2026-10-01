import { useEffect, useMemo, useState } from 'react'
import { Building2, CalendarDays, MapPin, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { getClients } from '../services/clients'
import { createJob, deleteJob, getJob, getJobs, updateJob } from '../services/jobs'

const statuses = { planned: 'Planifié', in_progress: 'En cours', completed: 'Terminé', cancelled: 'Annulé' }
const emptyJob = { client_id: '', title: '', description: '', location: '', start_date: '', expected_end_date: '', actual_end_date: '', status: 'planned', estimated_amount: '', notes: '' }

function clean(value) { return typeof value === 'string' ? value.trim() : value }

function JobsPage() {
  const { business } = useAuth()
  const [jobs, setJobs] = useState([])
  const [clients, setClients] = useState([])
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
    try { const [nextJobs, nextClients] = await Promise.all([getJobs(business.id), getClients(business.id)]); setJobs(nextJobs); setClients(nextClients) } catch (loadError) { setError(loadError.message || 'Impossible de charger les chantiers.') } finally { setLoading(false) }
  }
  useEffect(() => { if (business?.id) loadData() }, [business?.id])

  const filtered = useMemo(() => jobs.filter((job) => {
    const term = search.trim().toLowerCase()
    const matchesSearch = !term || [job.title, job.clients?.name, job.clients?.company_name].some((value) => value?.toLowerCase().includes(term))
    return matchesSearch && (status === 'all' || job.status === status)
  }), [jobs, search, status])

  function openCreate() { setEditing(null); setFormError(''); setFormOpen(true) }
  function openEdit(job) { setEditing(job); setFormError(''); setFormOpen(true); setSelected(null) }
  async function openDetails(job) { try { setSelected(await getJob(job.id, business.id)) } catch (detailError) { setError(detailError.message || 'Impossible de charger le chantier.') } }

  async function submit(event) {
    event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget).entries()); const data = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, clean(value)]))
    if (!data.client_id || !data.title) { setFormError('Le client et le titre sont obligatoires.'); return }
    if (data.estimated_amount && Number(data.estimated_amount) < 0) { setFormError('Le montant estimé doit être positif ou nul.'); return }
    if (data.start_date && data.expected_end_date && data.expected_end_date < data.start_date) { setFormError('La date de fin prévue doit être postérieure à la date de début.'); return }
    data.estimated_amount = data.estimated_amount ? Number(data.estimated_amount) : 0
    for (const key of ['description', 'location', 'start_date', 'expected_end_date', 'actual_end_date', 'notes']) if (!data[key]) data[key] = null
    setSaving(true); setFormError('')
    try { if (editing) await updateJob(editing.id, business.id, data); else await createJob(business.id, data); setFormOpen(false); await loadData() } catch (saveError) { setFormError(saveError.message || 'Impossible d’enregistrer le chantier.') } finally { setSaving(false) }
  }
  async function remove(job) { if (!window.confirm(`Supprimer définitivement le chantier « ${job.title} » ?`)) return; try { await deleteJob(job.id, business.id); setSelected(null); await loadData() } catch (deleteError) { setError(deleteError.message || 'Impossible de supprimer le chantier.') } }

  return <section className="content module-content"><div className="module-header"><div><p className="eyebrow">Suivi de votre activité</p><h1>Chantiers</h1><p className="module-subtitle">Organisez vos interventions et leur avancement.</p></div><button className="primary-button module-new-button" type="button" onClick={openCreate}><Plus size={17} /> Nouveau chantier</button></div><div className="module-toolbar"><label className="search-field"><Search size={17} /><span className="sr-only">Rechercher</span><input type="search" placeholder="Rechercher par titre ou client" value={search} onChange={(event) => setSearch(event.target.value)} /></label><select className="filter-select" value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">Tous les statuts</option>{Object.entries(statuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>{error && <p className="form-error" role="alert">{error}</p>}{loading ? <p className="module-state">Chargement des chantiers...</p> : filtered.length === 0 ? <div className="module-empty"><MapPin size={30} /><h2>{search || status !== 'all' ? 'Aucun résultat' : 'Aucun chantier pour le moment'}</h2><p>{search || status !== 'all' ? 'Modifiez vos critères de recherche.' : 'Créez votre premier chantier pour commencer.'}</p>{!search && status === 'all' && <button className="secondary-button" type="button" onClick={openCreate}>Ajouter un chantier</button>}</div> : <div className="entity-list">{filtered.map((job) => <article className="entity-row" key={job.id} onClick={() => openDetails(job)}><div className="entity-icon"><MapPin size={19} /></div><div className="entity-main"><h2>{job.title}</h2><p><Building2 size={14} /> {job.clients?.name ?? 'Client indisponible'}{job.location && <> · {job.location}</>}</p><p className="entity-meta">{job.start_date ? `Début ${formatDate(job.start_date)}` : 'Date de début non définie'} · Fin prévue {job.expected_end_date ? formatDate(job.expected_end_date) : 'non définie'}</p></div><div className="entity-side"><span className={`status-badge ${job.status}`}>{statuses[job.status]}</span><strong>{formatAmount(job.estimated_amount)}</strong></div></article>)}</div>}{formOpen && <JobForm job={editing} clients={clients} saving={saving} error={formError} onClose={() => setFormOpen(false)} onSubmit={submit} />}{selected && <JobDetails job={selected} onClose={() => setSelected(null)} onEdit={() => openEdit(selected)} onDelete={() => remove(selected)} />}</section>
}

function JobForm({ job, clients, saving, error, onClose, onSubmit }) {
  const values = job ?? emptyJob
  return <div className="modal-backdrop"><section className="client-modal" role="dialog" aria-modal="true" aria-labelledby="job-form-title"><div className="modal-header"><div><p className="eyebrow">{job ? 'Modifier le chantier' : 'Nouveau chantier'}</p><h2 id="job-form-title">{job ? job.title : 'Créer un chantier'}</h2></div><button className="icon-button" type="button" aria-label="Fermer" onClick={onClose}><X size={20} /></button></div><form className="client-form" onSubmit={onSubmit}><label>Client *<select name="client_id" defaultValue={values.client_id} required><option value="">Sélectionner un client</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}{client.company_name ? ` · ${client.company_name}` : ''}</option>)}</select></label><label>Titre *<input name="title" defaultValue={values.title} required /></label><label>Description<textarea name="description" defaultValue={values.description ?? ''} rows="3" /></label><label>Lieu<input name="location" defaultValue={values.location ?? ''} /></label><div className="form-two-columns"><label>Date de début<input type="date" name="start_date" defaultValue={values.start_date ?? ''} /></label><label>Fin prévue<input type="date" name="expected_end_date" defaultValue={values.expected_end_date ?? ''} /></label></div><div className="form-two-columns"><label>Fin réelle<input type="date" name="actual_end_date" defaultValue={values.actual_end_date ?? ''} /></label><label>Montant estimé<input type="number" name="estimated_amount" min="0" step="0.01" defaultValue={values.estimated_amount ?? ''} /></label></div><label>Statut<select name="status" defaultValue={values.status ?? 'planned'}>{Object.entries(statuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label>Notes<textarea name="notes" defaultValue={values.notes ?? ''} rows="3" /></label>{error && <p className="form-error" role="alert">{error}</p>}<div className="modal-actions"><button className="secondary-button" type="button" onClick={onClose}>Annuler</button><button className="primary-button" type="submit" disabled={saving}>{saving ? 'Enregistrement...' : 'Enregistrer'}</button></div></form></section></div>
}

function JobDetails({ job, onClose, onEdit, onDelete }) {
  return <div className="modal-backdrop"><section className="client-modal" role="dialog" aria-modal="true" aria-labelledby="job-details-title"><div className="modal-header"><div><p className="eyebrow">Fiche chantier</p><h2 id="job-details-title">{job.title}</h2></div><button className="icon-button" type="button" aria-label="Fermer" onClick={onClose}><X size={20} /></button></div><div className="details-grid"><Detail icon={Building2} label="Client" value={job.clients?.name ?? 'Non renseigné'} />{job.location && <Detail icon={MapPin} label="Lieu" value={job.location} />}{job.start_date && <Detail icon={CalendarDays} label="Dates" value={`${formatDate(job.start_date)}${job.expected_end_date ? ` → ${formatDate(job.expected_end_date)}` : ''}`} />}</div><div className="details-meta"><span className={`status-badge ${job.status}`}>{statuses[job.status]}</span><strong>{formatAmount(job.estimated_amount)}</strong></div>{job.description && <div className="notes-block"><strong>Description</strong><p>{job.description}</p></div>}{job.notes && <div className="notes-block"><strong>Notes</strong><p>{job.notes}</p></div>}<div className="future-sections"><span>Devis</span><span>Factures</span><span>Paiements</span><span>Dépenses</span><span>Documents</span></div><div className="modal-actions"><button className="danger-button" type="button" onClick={onDelete}><Trash2 size={16} /> Supprimer</button><button className="primary-button" type="button" onClick={onEdit}><Pencil size={16} /> Modifier</button></div></section></div>
}

function Detail({ icon: Icon, label, value }) { return <div className="detail-item"><Icon size={16} /><div><span>{label}</span><strong>{value}</strong></div></div> }
function formatDate(value) { return new Date(`${value}T00:00:00`).toLocaleDateString('fr-FR') }
function formatAmount(value) { return `${Number(value ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} XAF` }

export default JobsPage
