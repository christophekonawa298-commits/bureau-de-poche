import { useEffect, useMemo, useState } from 'react'
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { getExpenses } from '../services/expenses'
import { getCashPayments } from '../services/payments'

const paymentMethods = { cash: 'Espèces', transfer: 'Virement', mobile_money: 'Mobile Money', cheque: 'Chèque', other: 'Autre' }

function relatedRecord(value) {
  return Array.isArray(value) ? value[0] : value
}

function money(value) {
  return `${Number(value || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} XAF`
}

function formatDate(value) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('fr-FR')
}

function CaissePage() {
  const { business } = useAuth()
  const [payments, setPayments] = useState([])
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [period, setPeriod] = useState('all')
  const [type, setType] = useState('all')
  const [method, setMethod] = useState('all')
  const [jobId, setJobId] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  useEffect(() => {
    const businessId = business?.id
    if (!businessId) return

    let active = true
    Promise.all([getCashPayments(businessId), getExpenses(businessId)])
      .then(([nextPayments, nextExpenses]) => {
        if (active) {
          setPayments(nextPayments)
          setExpenses(nextExpenses)
          setError('')
        }
      })
      .catch((loadError) => {
        if (active) setError(loadError.message || 'Impossible de charger les mouvements de caisse.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => { active = false }
  }, [business?.id])

  const movements = useMemo(() => {
    const incoming = payments.map((payment) => {
      const invoice = relatedRecord(payment.invoices)
      const client = relatedRecord(payment.clients)
      const job = relatedRecord(payment.jobs)
      const clientName = client?.company_name || client?.name
      return {
        id: `payment-${payment.id}`,
        date: payment.payment_date,
        type: 'income',
        description: [invoice?.number ? `Facture ${invoice.number}` : 'Paiement reçu', clientName, job?.title].filter(Boolean).join(' · '),
        amount: Number(payment.amount || 0),
        method: payment.method,
        jobId: payment.job_id,
        jobTitle: job?.title,
      }
    })
    const outgoing = expenses.map((expense) => {
      const job = relatedRecord(expense.jobs)
      return {
        id: `expense-${expense.id}`,
        date: expense.expense_date,
        type: 'expense',
        description: [expense.description || expense.category || 'Dépense', expense.supplier, job?.title].filter(Boolean).join(' · '),
        amount: Number(expense.amount || 0),
        method: expense.payment_method,
        jobId: expense.job_id,
        jobTitle: job?.title,
      }
    })
    return [...incoming, ...outgoing].sort((left, right) => right.date.localeCompare(left.date))
  }, [payments, expenses])

  const jobs = useMemo(() => {
    const options = new Map()
    movements.forEach((movement) => {
      if (movement.jobId) options.set(movement.jobId, { id: movement.jobId, title: movement.jobTitle || 'Chantier' })
    })
    return [...options.values()].sort((left, right) => left.title.localeCompare(right.title, 'fr'))
  }, [movements])

  const filtered = useMemo(() => movements.filter((movement) => {
    const matchesType = type === 'all' || movement.type === type
    const matchesMethod = method === 'all' || movement.method === method
    const matchesJob = jobId === 'all' || movement.jobId === jobId
    const matchesDate = period === 'custom'
      ? (!dateFrom || movement.date >= dateFrom) && (!dateTo || movement.date <= dateTo)
      : period === 'all' || withinPeriod(movement.date, period)
    return matchesType && matchesMethod && matchesJob && matchesDate
  }), [movements, type, method, jobId, period, dateFrom, dateTo])

  const income = filtered.reduce((sum, movement) => sum + (movement.type === 'income' ? movement.amount : 0), 0)
  const outgoing = filtered.reduce((sum, movement) => sum + (movement.type === 'expense' ? movement.amount : 0), 0)
  const balance = income - outgoing

  return <section className="content module-content">
    <div className="module-header">
      <div><p className="eyebrow">Suivi des flux</p><h1>Caisse</h1><p className="module-subtitle">Les paiements et dépenses enregistrés dans votre activité.</p></div>
    </div>
    <div className="module-toolbar cash-filters">
      <select className="filter-select" aria-label="Période" value={period} onChange={(event) => setPeriod(event.target.value)}>
        <option value="all">Toute période</option><option value="today">Aujourd'hui</option><option value="month">Ce mois</option><option value="year">Cette année</option><option value="custom">Dates personnalisées</option>
      </select>
      {period === 'custom' && <>
        <input className="filter-select" aria-label="Date de début" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
        <input className="filter-select" aria-label="Date de fin" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
      </>}
      <select className="filter-select" aria-label="Type de mouvement" value={type} onChange={(event) => setType(event.target.value)}>
        <option value="all">Tous les types</option><option value="income">Entrées</option><option value="expense">Sorties</option>
      </select>
      <select className="filter-select" aria-label="Moyen de paiement" value={method} onChange={(event) => setMethod(event.target.value)}>
        <option value="all">Tous les moyens</option>{Object.entries(paymentMethods).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
      <select className="filter-select" aria-label="Chantier" value={jobId} onChange={(event) => setJobId(event.target.value)}>
        <option value="all">Tous les chantiers</option>{jobs.map((job) => <option key={job.id} value={job.id}>{job.title}</option>)}
      </select>
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="cash-metrics">
      <article className="cash-metric"><span>Total des entrées</span><strong>{money(income)}</strong></article>
      <article className="cash-metric"><span>Total des sorties</span><strong>{money(outgoing)}</strong></article>
      <article className={`cash-metric${balance < 0 ? ' negative' : ' balance'}`}><span>Solde</span><strong>{money(balance)}</strong></article>
      <article className="cash-metric"><span>Mouvements</span><strong>{filtered.length}</strong></article>
    </div>
    {loading ? <p className="module-state">Chargement de la caisse...</p> : filtered.length === 0 ? <div className="module-empty"><h2>Aucun mouvement pour cette sélection</h2><p>Les paiements et dépenses enregistrés apparaîtront ici.</p></div> : <div className="entity-list" aria-label="Mouvements de caisse">
      {filtered.map((movement) => {
        const isIncome = movement.type === 'income'
        const Icon = isIncome ? ArrowDownLeft : ArrowUpRight
        return <article className="entity-row cash-row" key={movement.id}>
          <span className={`entity-icon cash-icon${isIncome ? ' income' : ' expense'}`}><Icon size={19} /></span>
          <div className="entity-main"><h2>{movement.description}</h2><p>{formatDate(movement.date)} · {paymentMethods[movement.method] || movement.method || 'Moyen non renseigné'}</p></div>
          <div className="cash-amount"><span className={`cash-type ${isIncome ? 'income' : 'expense'}`}>{isIncome ? 'Entrée' : 'Sortie'}</span><strong>{isIncome ? '+' : '-'}{money(movement.amount)}</strong></div>
        </article>
      })}
    </div>}
  </section>
}

function withinPeriod(value, period) {
  const date = new Date(`${value}T00:00:00`)
  const now = new Date()
  if (period === 'today') return date.toDateString() === now.toDateString()
  if (period === 'month') return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
  return date.getFullYear() === now.getFullYear()
}

export default CaissePage