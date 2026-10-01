import { useEffect, useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, BriefcaseBusiness, FileText, Receipt, Users, WalletCards } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { getClients } from '../services/clients'
import { getExpenses } from '../services/expenses'
import { getInvoices } from '../services/invoices'
import { getJobs } from '../services/jobs'
import { getCashPayments } from '../services/payments'
import { getQuotes } from '../services/quotes'

const periodOptions = [
  { value: 'today', label: "Aujourd'hui" },
  { value: 'month', label: 'Ce mois' },
  { value: 'year', label: 'Cette année' },
  { value: 'all', label: 'Toute la période' },
]
const reportsPeriodStorageKey = 'bureau-de-poche.reports-period'
const invoiceStatuses = { draft: 'Brouillon', sent: 'Envoyée', paid: 'Payée', overdue: 'En retard', cancelled: 'Annulée' }

function getSavedPeriod() {
  try {
    const saved = window.sessionStorage.getItem(reportsPeriodStorageKey)
    return periodOptions.some(option => option.value === saved) ? saved : 'month'
  } catch {
    return 'month'
  }
}

function getPeriodLabel(period) {
  return periodOptions.find(option => option.value === period)?.label || 'Ce mois'
}

function dateInPeriod(value, period) {
  if (!value) return false
  if (period === 'all') return true
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value)
  if (Number.isNaN(date.getTime())) return false
  const now = new Date()
  if (period === 'today') return date.toDateString() === now.toDateString()
  if (period === 'month') return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
  return date.getFullYear() === now.getFullYear()
}

function formatMoney(value, currency) {
  try {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: currency || 'XAF' }).format(Number(value || 0))
  } catch {
    return `${Number(value || 0).toLocaleString('fr-FR')} ${currency || 'XAF'}`
  }
}

function relatedRecord(value) {
  return Array.isArray(value) ? value[0] : value
}

function rankedTotals(rows, getKey, getLabel, getAmount) {
  const totals = new Map()
  rows.forEach(row => {
    const key = getKey(row)
    if (!key) return
    const current = totals.get(key) || { key, label: getLabel(row), amount: 0, count: 0 }
    current.amount += getAmount(row)
    current.count += 1
    totals.set(key, current)
  })
  return [...totals.values()].sort((left, right) => right.amount - left.amount).slice(0, 5)
}

function ReportsPage() {
  const { business } = useAuth()
  const [period, setPeriod] = useState(getSavedPeriod)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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
    }).catch(loadError => {
      if (active) setError(loadError.message || 'Impossible de charger les rapports.')
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [business?.id])

  useEffect(() => {
    try {
      window.sessionStorage.setItem(reportsPeriodStorageKey, period)
    } catch {
      return
    }
  }, [period])

  const reportData = data || { invoices: [], payments: [], expenses: [], clients: [], jobs: [], quotes: [] }
  const issuedInvoices = reportData.invoices.filter(invoice => dateInPeriod(invoice.issue_date, period) && !['draft', 'cancelled'].includes(invoice.status))
  const periodPayments = reportData.payments.filter(payment => dateInPeriod(payment.payment_date, period))
  const periodExpenses = reportData.expenses.filter(expense => dateInPeriod(expense.expense_date, period))
  const periodClients = reportData.clients.filter(client => dateInPeriod(client.created_at, period))
  const periodJobs = reportData.jobs.filter(job => dateInPeriod(job.created_at, period))
  const periodQuotes = reportData.quotes.filter(quote => dateInPeriod(quote.issue_date, period))

  const billed = issuedInvoices.reduce((sum, invoice) => sum + Number(invoice.total || 0), 0)
  const collected = periodPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
  const outstanding = issuedInvoices.reduce((sum, invoice) => sum + Number(invoice.remainingAmount || 0), 0)
  const expensesTotal = periodExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0)
  const cashBalance = collected - expensesTotal

  const statusCounts = issuedInvoices.reduce((counts, invoice) => {
    counts[invoice.status] = (counts[invoice.status] || 0) + 1
    return counts
  }, {})
  const categoryTotals = rankedTotals(periodExpenses, expense => expense.category || 'uncategorized', expense => expense.category || 'Sans catégorie', expense => Number(expense.amount || 0))
  const clientTotals = rankedTotals(issuedInvoices, invoice => invoice.client_id, invoice => {
    const client = relatedRecord(invoice.clients)
    return client?.company_name || client?.name || 'Client'
  }, invoice => Number(invoice.total || 0))
  const jobTotals = rankedTotals(issuedInvoices, invoice => invoice.job_id, invoice => relatedRecord(invoice.jobs)?.title || 'Chantier', invoice => Number(invoice.total || 0))

  const financialMetrics = [
    { label: 'Chiffre facturé', value: billed, icon: FileText },
    { label: 'Total encaissé', value: collected, icon: ArrowDownLeft },
    { label: 'Reste à encaisser', value: outstanding, icon: WalletCards },
    { label: 'Total des dépenses', value: expensesTotal, icon: ArrowUpRight },
    { label: 'Solde de caisse', value: cashBalance, icon: WalletCards, balance: true },
  ]
  const activityMetrics = [
    { label: 'Nouveaux clients', value: periodClients.length, icon: Users },
    { label: 'Chantiers créés', value: periodJobs.length, icon: BriefcaseBusiness },
    { label: 'Devis émis', value: periodQuotes.length, icon: FileText },
    { label: 'Factures émises', value: issuedInvoices.length, icon: Receipt },
    { label: 'Paiements reçus', value: periodPayments.length, icon: ArrowDownLeft },
    { label: 'Dépenses saisies', value: periodExpenses.length, icon: ArrowUpRight },
  ]

  return <section className="content module-content reports-content">
    <div className="module-header reports-header">
      <div><p className="eyebrow">Synthèse de votre activité</p><h1>Rapports</h1><p className="module-subtitle">Vos principaux chiffres, sans comptabilité complexe.</p></div>
      <label className="report-period">Période<select className="filter-select" value={period} onChange={event => setPeriod(event.target.value)}>{periodOptions.map(option => <option value={option.value} key={option.value}>{option.label}</option>)}</select><span>{getPeriodLabel(period)}</span></label>
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <section className="report-section">
      <div className="report-section-heading"><h2>Finances</h2><span>{getPeriodLabel(period)}</span></div>
      <div className="dashboard-financial-grid report-financial-grid">
        {financialMetrics.map(({ label, value, icon: Icon, balance }) => <article className={`dashboard-metric${balance ? ' dashboard-balance' : ''}`} key={label}>
          <div className="card-label"><Icon size={17} className="empty-icon" /> {label}</div>
          <strong>{loading ? '...' : error ? '—' : formatMoney(value, business?.currency)}</strong>
        </article>)}
      </div>
    </section>
    <section className="report-section">
      <div className="report-section-heading"><h2>Activité</h2><span>{getPeriodLabel(period)}</span></div>
      <div className="report-activity-grid">
        {activityMetrics.map(({ label, value, icon: Icon }) => <article className="report-activity-metric" key={label}><span><Icon size={16} />{label}</span><strong>{loading ? '...' : error ? '—' : value}</strong></article>)}
      </div>
    </section>
    <div className="report-detail-grid">
      <section className="report-section">
        <div className="report-section-heading"><h2>Factures</h2><span>{loading ? '...' : error ? '—' : `${issuedInvoices.length} émises`}</span></div>
        {loading ? <p className="report-state">Chargement des factures...</p> : error ? <p className="report-state">Données indisponibles.</p> : issuedInvoices.length === 0 ? <p className="report-state">Aucune facture émise sur cette période.</p> : <>
          <div className="report-inline-totals"><span>Facturé <strong>{formatMoney(billed, business?.currency)}</strong></span><span>Payé sur ces factures <strong>{formatMoney(issuedInvoices.reduce((sum, invoice) => sum + Number(invoice.paidAmount || 0), 0), business?.currency)}</strong></span><span>Reste <strong>{formatMoney(outstanding, business?.currency)}</strong></span></div>
          <div className="report-status-list">{Object.entries(statusCounts).map(([status, count]) => <span key={status}><span className={`status-badge ${status}`}>{invoiceStatuses[status] || status}</span><strong>{count}</strong></span>)}</div>
        </>}
      </section>
      <section className="report-section">
        <div className="report-section-heading"><h2>Dépenses par catégorie</h2><span>{loading ? '...' : error ? '—' : `${periodExpenses.length} dépenses`}</span></div>
        {loading ? <p className="report-state">Chargement des dépenses...</p> : error ? <p className="report-state">Données indisponibles.</p> : categoryTotals.length === 0 ? <p className="report-state">Aucune dépense sur cette période.</p> : <div className="report-rank-list">{categoryTotals.map(item => <div className="report-rank-row" key={item.key}><span>{item.label}<small>{item.count} {item.count === 1 ? 'dépense' : 'dépenses'}</small></span><strong>{formatMoney(item.amount, business?.currency)}</strong></div>)}</div>}
      </section>
    </div>
    <div className="report-detail-grid">
      <ReportRankSection title="Clients facturés" items={clientTotals} loading={loading} error={error} currency={business?.currency} emptyMessage="Aucun client facturé sur cette période." />
      <ReportRankSection title="Chantiers facturés" items={jobTotals} loading={loading} error={error} currency={business?.currency} emptyMessage="Aucun chantier facturé sur cette période." />
    </div>
  </section>
}

function ReportRankSection({ title, items, loading, error, currency, emptyMessage }) {
  return <section className="report-section"><div className="report-section-heading"><h2>{title}</h2><span>{loading ? '...' : error ? '—' : items.length}</span></div>{loading ? <p className="report-state">Chargement...</p> : error ? <p className="report-state">Données indisponibles.</p> : items.length === 0 ? <p className="report-state">{emptyMessage}</p> : <div className="report-rank-list">{items.map(item => <div className="report-rank-row" key={item.key}><span>{item.label}<small>{item.count} {item.count === 1 ? 'facture' : 'factures'}</small></span><strong>{formatMoney(item.amount, currency)}</strong></div>)}</div>}</section>
}

export default ReportsPage