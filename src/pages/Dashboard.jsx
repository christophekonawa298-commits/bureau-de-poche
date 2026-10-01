import { useEffect, useMemo, useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, BriefcaseBusiness, CalendarDays, Clock3, FileText, Users, WalletCards } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { getClients } from '../services/clients'
import { getExpenses } from '../services/expenses'
import { getInvoices } from '../services/invoices'
import { getJobs } from '../services/jobs'
import { getCashPayments } from '../services/payments'
import { getQuotes } from '../services/quotes'
import { getAppointments } from '../services/appointments'

const periodOptions = [
  { value: 'today', label: "Aujourd'hui" },
  { value: 'month', label: 'Ce mois' },
  { value: 'year', label: 'Cette année' },
]
const dashboardPeriodStorageKey = 'bureau-de-poche.dashboard-period'

function getSavedPeriod() {
  let savedPeriod
  try {
    savedPeriod = window.sessionStorage.getItem(dashboardPeriodStorageKey)
  } catch {
    return 'month'
  }
  return periodOptions.some((option) => option.value === savedPeriod) ? savedPeriod : 'month'
}

function savePeriod(period) {
  try {
    window.sessionStorage.setItem(dashboardPeriodStorageKey, period)
  } catch {
    return
  }
}

function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function getPeriodRange(period) {
  const today = new Date()
  const end = dateKey(today)
  if (period === 'today') return { start: end, end, label: "Aujourd'hui" }
  if (period === 'year') return { start: `${today.getFullYear()}-01-01`, end, label: 'Cette année' }
  return { start: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`, end, label: 'Ce mois' }
}

function inRange(value, range) {
  return Boolean(value && value >= range.start && value <= range.end)
}

function formatMoney(value, currency) {
  try {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: currency || 'XAF' }).format(Number(value || 0))
  } catch {
    return `${Number(value || 0).toLocaleString('fr-FR')} ${currency || 'XAF'}`
  }
}

function formatDate(value) {
  if (!value) return ''
  return new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

function record(value) {
  return Array.isArray(value) ? value[0] : value
}

function appointmentDayLabel(value) {
  const date = new Date(value)
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)
  const key = dateKey(date)
  if (key === dateKey(today)) return "Aujourd'hui"
  if (key === dateKey(tomorrow)) return 'Demain'
  return date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
}

function appointmentTime(value) {
  return new Date(value).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function Dashboard() {
  const { business } = useAuth()
  const [period, setPeriod] = useState(getSavedPeriod)
  const [data, setData] = useState({ invoices: [], payments: [], expenses: [], clients: [], jobs: [], quotes: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [upcomingAppointments, setUpcomingAppointments] = useState([])
  const [appointmentsLoading, setAppointmentsLoading] = useState(true)
  const [appointmentsError, setAppointmentsError] = useState('')

  useEffect(() => {
    const businessId = business?.id
    if (!businessId) return
    let active = true
    Promise.all([
      getInvoices(businessId),
      getCashPayments(businessId),
      getExpenses(businessId),
      getClients(businessId),
      getJobs(businessId),
      getQuotes(businessId),
    ]).then(([invoices, payments, expenses, clients, jobs, quotes]) => {
      if (active) {
        setData({ invoices, payments, expenses, clients, jobs, quotes })
        setError('')
      }
    }).catch((loadError) => {
      if (active) setError(loadError.message || 'Impossible de charger les données du tableau de bord.')
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [business?.id])

  useEffect(() => {
    const businessId = business?.id
    if (!businessId) return
    let active = true
    getAppointments(businessId, { upcomingOnly: true, limit: 5 })
      .then(nextAppointments => {
        if (active) {
          setUpcomingAppointments(nextAppointments)
          setAppointmentsError('')
        }
      })
      .catch(appointmentsLoadError => {
        if (active) setAppointmentsError(appointmentsLoadError.message || 'Impossible de charger les rendez-vous.')
      })
      .finally(() => {
        if (active) setAppointmentsLoading(false)
      })
    return () => { active = false }
  }, [business?.id])

  useEffect(() => {
    savePeriod(period)
  }, [period])

  const range = useMemo(() => getPeriodRange(period), [period])
  const issuedInvoices = data.invoices.filter((invoice) => inRange(invoice.issue_date, range) && !['draft', 'cancelled'].includes(invoice.status))
  const periodPayments = data.payments.filter((payment) => inRange(payment.payment_date, range))
  const periodExpenses = data.expenses.filter((expense) => inRange(expense.expense_date, range))
  const billed = issuedInvoices.reduce((total, invoice) => total + Number(invoice.total || 0), 0)
  const collected = periodPayments.reduce((total, payment) => total + Number(payment.amount || 0), 0)
  const outstanding = issuedInvoices.reduce((total, invoice) => total + Number(invoice.remainingAmount || 0), 0)
  const expensesTotal = periodExpenses.reduce((total, expense) => total + Number(expense.amount || 0), 0)
  const balance = collected - expensesTotal
  const activeJobs = data.jobs.filter((job) => job.status === 'in_progress')
  const unpaidInvoices = data.invoices.filter((invoice) => !['draft', 'cancelled'].includes(invoice.status) && invoice.remainingAmount > 0)
  const overdueInvoices = unpaidInvoices.filter((invoice) => invoice.due_date && invoice.due_date < dateKey(new Date()))
  const pendingQuotes = data.quotes.filter((quote) => quote.status === 'sent')

  const activity = useMemo(() => {
    const latest = [
      data.payments[0] && {
        id: `payment-${data.payments[0].id}`,
        date: data.payments[0].payment_date,
        title: `Paiement reçu${record(data.payments[0].clients)?.name ? ` · ${record(data.payments[0].clients).name}` : ''}`,
        detail: formatMoney(data.payments[0].amount, business?.currency),
        href: '/caisse',
        kind: 'income',
      },
      data.invoices[0] && {
        id: `invoice-${data.invoices[0].id}`,
        date: data.invoices[0].issue_date,
        title: `Facture ${data.invoices[0].number}`,
        detail: formatMoney(data.invoices[0].total, business?.currency),
        href: '/factures',
        kind: 'invoice',
      },
      data.expenses[0] && {
        id: `expense-${data.expenses[0].id}`,
        date: data.expenses[0].expense_date,
        title: data.expenses[0].description || data.expenses[0].category || 'Dépense enregistrée',
        detail: formatMoney(data.expenses[0].amount, business?.currency),
        href: '/depenses',
        kind: 'expense',
      },
      data.jobs[0] && {
        id: `job-${data.jobs[0].id}`,
        date: data.jobs[0].created_at,
        title: data.jobs[0].title,
        detail: 'Nouveau chantier',
        href: '/chantiers',
        kind: 'job',
      },
    ].filter(Boolean)
    return latest.sort((left, right) => right.date.localeCompare(left.date)).slice(0, 4)
  }, [data, business?.currency])

  const financialCards = [
    { label: 'Chiffre facturé', value: billed, icon: FileText },
    { label: 'Total encaissé', value: collected, icon: ArrowDownLeft },
    { label: 'Reste à encaisser', value: outstanding, icon: WalletCards },
    { label: 'Total des dépenses', value: expensesTotal, icon: ArrowUpRight },
    { label: 'Solde de caisse', value: balance, icon: WalletCards, balance: true },
  ]

  const actions = [
    { label: 'Clients', count: data.clients.length, href: '/clients', icon: Users },
    { label: 'Chantiers en cours', count: activeJobs.length, href: '/chantiers', icon: BriefcaseBusiness },
    { label: 'Factures avec solde', count: unpaidInvoices.length, href: '/factures', icon: FileText },
    { label: 'Factures échues', count: overdueInvoices.length, href: '/factures', icon: FileText },
    { label: 'Devis en attente', count: pendingQuotes.length, href: '/devis', icon: FileText },
  ]

  return <section className="content dashboard-content">
    <div className="dashboard-heading">
      <div className="welcome"><div><h1>Bonjour, bienvenue.</h1><p>{business?.name ?? 'Votre activité'}, simplement depuis votre poche.</p></div><p className="date-note">{business?.email || business?.phone || 'Votre espace professionnel'}</p></div>
      <label className="dashboard-period">Période<select className="filter-select" value={period} onChange={(event) => setPeriod(event.target.value)}>{periodOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select><span>{range.label} · {formatDate(range.start)}{range.start !== range.end ? ` – ${formatDate(range.end)}` : ''}</span></label>
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="dashboard-financial-grid">
      {financialCards.map(({ label, value, icon: Icon, balance: isBalance }) => <article className={`dashboard-metric${isBalance ? ' dashboard-balance' : ''}`} key={label}>
        <div className="card-label"><Icon size={17} className="empty-icon" /> {label}</div>
        <strong>{loading ? '...' : error ? '—' : formatMoney(value, business?.currency)}</strong>
      </article>)}
    </div>
    <section className="dashboard-appointments">
      <div className="dashboard-section-heading"><h2>Prochains rendez-vous</h2><Link className="dashboard-agenda-link" to="/agenda">Voir l’agenda</Link></div>
      {appointmentsLoading ? <p className="dashboard-empty">Chargement des rendez-vous...</p> : appointmentsError ? <p className="dashboard-empty">Rendez-vous indisponibles pour le moment.</p> : upcomingAppointments.length === 0 ? <div className="dashboard-no-appointments"><p>Aucun rendez-vous prévu</p><Link className="secondary-button" to="/agenda">Planifier un rendez-vous</Link></div> : <div className="dashboard-upcoming-list">
        {upcomingAppointments.map(appointment => {
          const client = record(appointment.clients)
          const job = record(appointment.jobs)
          const isToday = appointmentDayLabel(appointment.start_at) === "Aujourd'hui"
          return <article className={`dashboard-upcoming-row${isToday ? ' today' : ''}`} key={appointment.id}>
            <span className="dashboard-appointment-icon"><CalendarDays size={18} /></span>
            <div className="dashboard-upcoming-main"><div className="dashboard-upcoming-title"><strong>{appointment.title}</strong>{isToday && <span className="today-label">Aujourd’hui</span>}</div><p><Clock3 size={14} /> {appointmentDayLabel(appointment.start_at)} · {appointmentTime(appointment.start_at)}{appointment.end_at ? ` – ${appointmentTime(appointment.end_at)}` : ''}</p><small>{[client?.company_name || client?.name, job?.title, appointment.type].filter(Boolean).join(' · ') || 'Aucun client ou chantier associé'}</small></div>
          </article>
        })}
      </div>}
    </section>
    <div className="dashboard-lower-grid">
      <section className="dashboard-section">
        <div className="dashboard-section-heading"><h2>À suivre</h2><span>Votre activité</span></div>
        <div className="dashboard-action-list">
          {actions.map(({ label, count, href, icon: Icon }) => <Link className="dashboard-action" to={href} key={label}><Icon size={17} /><span>{label}</span><strong>{loading ? '...' : error ? '—' : count}</strong></Link>)}
        </div>
      </section>
      <section className="dashboard-section">
        <div className="dashboard-section-heading"><h2>Activité récente</h2><span>Dernière opération par module</span></div>
        {loading ? <p className="dashboard-empty">Chargement de l’activité...</p> : error ? <p className="dashboard-empty">Activité indisponible pour le moment.</p> : activity.length === 0 ? <p className="dashboard-empty">Aucune opération enregistrée pour le moment.</p> : <div className="dashboard-activity-list">
          {activity.map((item) => <Link className="dashboard-activity" to={item.href} key={item.id}><span className={`dashboard-activity-mark ${item.kind}`} /><span className="dashboard-activity-main"><strong>{item.title}</strong><small>{formatDate(item.date)}</small></span><span className="dashboard-activity-detail">{item.detail}</span></Link>)}
        </div>}
      </section>
    </div>
  </section>
}

export default Dashboard