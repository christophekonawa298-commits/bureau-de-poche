import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, Clock3, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { getClients } from '../services/clients'
import { createAppointment, deleteAppointment, getAppointments, updateAppointment } from '../services/appointments'
import { getJobs } from '../services/jobs'

const statuses = { planned: 'Planifié', completed: 'Terminé', cancelled: 'Annulé' }
const appointmentTypes = ['Rendez-vous', 'Intervention', 'Appel', 'Autre']
const filters = [
  { value: 'all', label: 'Tous' },
  { value: 'today', label: "Aujourd'hui" },
  { value: 'upcoming', label: 'À venir' },
  { value: 'past', label: 'Passés' },
]

function localDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function toLocalInput(value) {
  if (!value) return ''
  const date = new Date(value)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

function formatDate(value) {
  return new Date(value).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function formatTime(value) {
  return new Date(value).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function relatedRecord(value) {
  return Array.isArray(value) ? value[0] : value
}

function appointmentTime(appointment) {
  const start = new Date(appointment.start_at).getTime()
  return Number.isFinite(start) ? start : 0
}

function groupAppointments(appointments, filter) {
  const now = new Date()
  const today = localDateKey(now)
  const matchesToday = appointment => localDateKey(new Date(appointment.start_at)) === today
  if (filter === 'today') return [{ label: "Aujourd'hui", items: appointments.filter(matchesToday).sort((a, b) => appointmentTime(a) - appointmentTime(b)) }]
  if (filter === 'upcoming') return [{ label: 'À venir', items: appointments.filter(appointment => appointmentTime(appointment) >= now.getTime()).sort((a, b) => appointmentTime(a) - appointmentTime(b)) }]
  if (filter === 'past') return [{ label: 'Passés', items: appointments.filter(appointment => appointmentTime(appointment) < now.getTime()).sort((a, b) => appointmentTime(b) - appointmentTime(a)) }]

  const todayItems = appointments.filter(matchesToday).sort((a, b) => appointmentTime(a) - appointmentTime(b))
  const upcomingItems = appointments.filter(appointment => !matchesToday(appointment) && appointmentTime(appointment) > now.getTime()).sort((a, b) => appointmentTime(a) - appointmentTime(b))
  const pastItems = appointments.filter(appointment => !matchesToday(appointment) && appointmentTime(appointment) <= now.getTime()).sort((a, b) => appointmentTime(b) - appointmentTime(a))
  return [
    { label: "Aujourd'hui", items: todayItems },
    { label: 'À venir', items: upcomingItems },
    { label: 'Passés', items: pastItems },
  ].filter(group => group.items.length)
}

function AgendaPage() {
  const { business } = useAuth()
  const [appointments, setAppointments] = useState([])
  const [clients, setClients] = useState([])
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [formError, setFormError] = useState('')
  const [editing, setEditing] = useState(null)
  const [formOpen, setFormOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    const businessId = business?.id
    if (!businessId) return
    let active = true
    Promise.all([getAppointments(businessId), getClients(businessId), getJobs(businessId)])
      .then(([nextAppointments, nextClients, nextJobs]) => {
        if (active) {
          setAppointments(nextAppointments)
          setClients(nextClients)
          setJobs(nextJobs)
          setError('')
        }
      })
      .catch(loadError => {
        if (active) setError(loadError.message || 'Impossible de charger les rendez-vous.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [business?.id])

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('fr')
    return appointments.filter(appointment => {
      if (!term) return true
      const client = relatedRecord(appointment.clients)
      const job = relatedRecord(appointment.jobs)
      return [appointment.title, appointment.type, appointment.notes, client?.name, client?.company_name, job?.title]
        .some(value => value?.toLocaleLowerCase('fr').includes(term))
    })
  }, [appointments, search])

  const groups = useMemo(() => groupAppointments(filtered, filter), [filtered, filter])
  const totalMatches = groups.reduce((total, group) => total + group.items.length, 0)

  async function refreshAppointments() {
    const nextAppointments = await getAppointments(business.id)
    setAppointments(nextAppointments)
  }

  function openCreate() {
    setEditing(null)
    setFormError('')
    setError('')
    setFormOpen(true)
  }

  function openEdit(appointment) {
    setEditing(appointment)
    setFormError('')
    setError('')
    setFormOpen(true)
  }

  async function submit(data) {
    setSaving(true)
    setFormError('')
    try {
      if (editing) await updateAppointment(editing.id, business.id, data)
      else await createAppointment(business.id, data)
      setFormOpen(false)
      await refreshAppointments()
    } catch (saveError) {
      setFormError(saveError.message || 'Impossible d’enregistrer le rendez-vous.')
    } finally {
      setSaving(false)
    }
  }

  async function remove(appointment) {
    if (!window.confirm(`Supprimer le rendez-vous « ${appointment.title} » ?`)) return
    setError('')
    try {
      await deleteAppointment(appointment.id, business.id)
      await refreshAppointments()
    } catch (deleteError) {
      setError(deleteError.message || 'Impossible de supprimer le rendez-vous.')
    }
  }

  return <section className="content module-content">
    <div className="module-header">
      <div><p className="eyebrow">Vos rendez-vous</p><h1>Agenda</h1><p className="module-subtitle">Planifiez vos rencontres et interventions.</p></div>
      <button className="primary-button module-new-button" type="button" onClick={openCreate}><Plus size={17} /> Nouveau rendez-vous</button>
    </div>
    <div className="module-toolbar agenda-toolbar">
      <label className="search-field"><Search size={17} /><span className="sr-only">Rechercher un rendez-vous</span><input type="search" placeholder="Rechercher titre, client ou chantier" value={search} onChange={event => setSearch(event.target.value)} /></label>
      <select className="filter-select" aria-label="Filtrer les rendez-vous" value={filter} onChange={event => setFilter(event.target.value)}>{filters.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}
    {loading ? <p className="module-state">Chargement des rendez-vous...</p> : totalMatches === 0 ? <div className="module-empty"><CalendarDays size={30} /><h2>{appointments.length ? 'Aucun résultat' : 'Aucun rendez-vous pour le moment'}</h2><p>{appointments.length ? 'Modifiez votre recherche ou votre filtre.' : 'Ajoutez un rendez-vous pour le retrouver ici.'}</p>{appointments.length === 0 && <button className="secondary-button" type="button" onClick={openCreate}>Nouveau rendez-vous</button>}</div> : <div className="appointment-groups">
      {groups.map(group => <section className="appointment-group" key={group.label}><h2>{group.label}</h2><div className="entity-list">{group.items.map(appointment => {
        const client = relatedRecord(appointment.clients)
        const job = relatedRecord(appointment.jobs)
        return <article className="entity-row appointment-row" key={appointment.id}>
          <span className="entity-icon"><CalendarDays size={19} /></span>
          <div className="entity-main"><h3>{appointment.title}</h3><p><Clock3 size={14} /> {formatDate(appointment.start_at)} · {formatTime(appointment.start_at)}{appointment.end_at ? ` – ${formatTime(appointment.end_at)}` : ''}</p><p className="entity-meta">{[client?.company_name || client?.name, job?.title, appointment.type].filter(Boolean).join(' · ') || 'Aucun client ou chantier associé'}</p>{appointment.notes && <p className="appointment-notes">{appointment.notes}</p>}</div>
          <div className="appointment-side"><span className={`status-badge ${appointment.status}`}>{statuses[appointment.status] || appointment.status}</span><div className="appointment-actions"><button className="icon-button" type="button" aria-label={`Modifier ${appointment.title}`} title="Modifier le rendez-vous" onClick={() => openEdit(appointment)}><Pencil size={16} /></button><button className="icon-button" type="button" aria-label={`Supprimer ${appointment.title}`} title="Supprimer le rendez-vous" onClick={() => remove(appointment)}><Trash2 size={16} /></button></div></div>
        </article>
      })}</div></section>)}
    </div>}
    {formOpen && <AppointmentForm appointment={editing} clients={clients} jobs={jobs} saving={saving} error={formError} onClose={() => setFormOpen(false)} onSubmit={submit} />}
  </section>
}

function AppointmentForm({ appointment, clients, jobs, saving, error, onClose, onSubmit }) {
  const [title, setTitle] = useState(appointment?.title ?? '')
  const [type, setType] = useState(appointment?.type ?? appointmentTypes[0])
  const [startAt, setStartAt] = useState(toLocalInput(appointment?.start_at))
  const [endAt, setEndAt] = useState(toLocalInput(appointment?.end_at))
  const [clientId, setClientId] = useState(appointment?.client_id ?? '')
  const [jobId, setJobId] = useState(appointment?.job_id ?? '')
  const [status, setStatus] = useState(appointment?.status ?? 'planned')
  const [notes, setNotes] = useState(appointment?.notes ?? '')
  const [localError, setLocalError] = useState('')
  const availableJobs = jobs.filter(job => !clientId || job.client_id === clientId)

  async function submit(event) {
    event.preventDefault()
    setLocalError('')
    if (!title.trim() || !startAt) {
      setLocalError('Le titre et la date de début sont obligatoires.')
      return
    }
    const startDate = new Date(startAt)
    const endDate = endAt ? new Date(endAt) : null
    if (Number.isNaN(startDate.getTime()) || (endDate && Number.isNaN(endDate.getTime()))) {
      setLocalError('Vérifiez les dates saisies.')
      return
    }
    if (endDate && endDate < startDate) {
      setLocalError('La fin doit être postérieure au début.')
      return
    }
    if (clientId && jobId && jobs.find(job => job.id === jobId)?.client_id !== clientId) {
      setLocalError('Le chantier sélectionné ne correspond pas au client choisi.')
      return
    }
    await onSubmit({
      client_id: clientId || null,
      job_id: jobId || null,
      title: title.trim(),
      type: type || null,
      start_at: startDate.toISOString(),
      end_at: endDate?.toISOString() ?? null,
      status,
      notes: notes.trim() || null,
    })
  }

  return <div className="modal-backdrop"><section className="client-modal" role="dialog" aria-modal="true" aria-labelledby="appointment-form-title"><div className="modal-header"><div><p className="eyebrow">{appointment ? 'Modifier le rendez-vous' : 'Nouveau rendez-vous'}</p><h2 id="appointment-form-title">{appointment ? appointment.title : 'Créer un rendez-vous'}</h2></div><button className="icon-button" type="button" aria-label="Fermer" onClick={onClose}><X size={20} /></button></div><form className="client-form" onSubmit={submit}>
    <label>Objet *<input value={title} onChange={event => setTitle(event.target.value)} maxLength={180} required /></label>
    <label>Type<select value={type} onChange={event => setType(event.target.value)}><option value="">Aucun type</option>{appointmentTypes.map(item => <option key={item} value={item}>{item}</option>)}</select></label>
    <div className="form-two-columns"><label>Début *<input type="datetime-local" value={startAt} onChange={event => setStartAt(event.target.value)} required /></label><label>Fin<input type="datetime-local" value={endAt} onChange={event => setEndAt(event.target.value)} /></label></div>
    <label>Client (facultatif)<select value={clientId} onChange={event => { setClientId(event.target.value); if (jobId && jobs.find(job => job.id === jobId)?.client_id !== event.target.value) setJobId('') }}><option value="">Aucun client</option>{clients.map(client => <option key={client.id} value={client.id}>{client.company_name || client.name}</option>)}</select></label>
    <label>Chantier (facultatif)<select value={jobId} onChange={event => setJobId(event.target.value)}><option value="">Aucun chantier</option>{availableJobs.map(job => <option key={job.id} value={job.id}>{job.title}</option>)}</select></label>
    <label>Statut<select value={status} onChange={event => setStatus(event.target.value)}>{Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    <label>Notes<textarea value={notes} onChange={event => setNotes(event.target.value)} rows="3" /></label>
    {(localError || error) && <p className="form-error" role="alert">{localError || error}</p>}
    <div className="modal-actions"><button className="secondary-button" type="button" onClick={onClose}>Annuler</button><button className="primary-button" type="submit" disabled={saving}>{saving ? 'Enregistrement...' : 'Enregistrer'}</button></div>
  </form></section></div>
}

export default AgendaPage