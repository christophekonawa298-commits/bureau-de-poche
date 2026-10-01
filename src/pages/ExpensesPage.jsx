import { useEffect, useMemo, useState } from 'react'
import { Building2, MapPin, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { createExpense, deleteExpense, getExpenseJobs, getExpenses, updateExpense } from '../services/expenses'

const categories = ['Matériel', 'Transport', 'Carburant', "Main-d'œuvre", 'Sous-traitance', 'Communication', 'Maintenance', 'Fournitures', 'Loyer', 'Électricité / eau', 'Autre']
const methods = { cash: 'Espèces', transfer: 'Virement', mobile_money: 'Mobile Money', cheque: 'Chèque', other: 'Autre' }
const today = new Date().toISOString().slice(0, 10)
const emptyExpense = { category: 'Matériel', amount: '', expense_date: today, supplier: '', payment_method: 'cash', job_id: '', description: '' }

function money(value) { return `${Number(value || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} XAF` }
function formatDate(value) { return new Date(`${value}T00:00:00`).toLocaleDateString('fr-FR') }

function ExpensesPage() {
  const { business } = useAuth()
  const [expenses, setExpenses] = useState([])
  const [jobs, setJobs] = useState([])
  const [editing, setEditing] = useState(null)
  const [formOpen, setFormOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [jobId, setJobId] = useState('all')
  const [period, setPeriod] = useState('all')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [formError, setFormError] = useState('')

  async function loadData() {
    setLoading(true); setError('')
    try { const [nextExpenses, nextJobs] = await Promise.all([getExpenses(business.id), getExpenseJobs(business.id)]); setExpenses(nextExpenses); setJobs(nextJobs) } catch (loadError) { setError(loadError.message || 'Impossible de charger les dépenses.') } finally { setLoading(false) }
  }
  useEffect(() => { if (business?.id) loadData() }, [business?.id])
  const filtered = useMemo(() => expenses.filter((expense) => { const term = search.trim().toLowerCase(); const matchesSearch = !term || [expense.category, expense.supplier, expense.description].some((value) => value?.toLowerCase().includes(term)); const matchesPeriod = period === 'all' || withinPeriod(expense.expense_date, period); return matchesSearch && (category === 'all' || expense.category === category) && (jobId === 'all' || expense.job_id === jobId) && matchesPeriod }), [expenses, search, category, jobId, period])
  const total = filtered.reduce((sum, expense) => sum + Number(expense.amount || 0), 0)
  function openCreate() { setEditing(null); setFormError(''); setFormOpen(true) }
  function openEdit(expense) { setEditing(expense); setFormError(''); setFormOpen(true) }
  async function submit(event) { event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget).entries()); const data = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value])); if (!data.amount || Number(data.amount) <= 0) { setFormError('Le montant doit être strictement positif.'); return } data.amount = Number(data.amount); data.job_id = data.job_id || null; data.supplier = data.supplier || null; data.description = data.description || null; setSaving(true); setFormError(''); try { if (editing) await updateExpense(editing.id, business.id, data); else await createExpense(business.id, data); setFormOpen(false); await loadData() } catch (saveError) { setFormError(saveError.message || 'Impossible d’enregistrer la dépense.') } finally { setSaving(false) } }
  async function remove(expense) { if (!window.confirm(`Supprimer définitivement cette dépense de ${money(expense.amount)} ?`)) return; try { await deleteExpense(expense.id, business.id); await loadData() } catch (deleteError) { setError(deleteError.message || 'Impossible de supprimer la dépense.') } }

  return <section className="content module-content"><div className="module-header"><div><p className="eyebrow">Sorties de votre activité</p><h1>Dépenses</h1><p className="module-subtitle">Suivez les dépenses liées à votre activité et à vos chantiers.</p></div><button className="primary-button module-new-button" type="button" onClick={openCreate}><Plus size={17} /> Nouvelle dépense</button></div><div className="module-toolbar expense-filters"><label className="search-field"><Search size={17} /><span className="sr-only">Rechercher</span><input type="search" placeholder="Rechercher catégorie, fournisseur ou description" value={search} onChange={(event) => setSearch(event.target.value)} /></label><select className="filter-select" value={period} onChange={(event) => setPeriod(event.target.value)}><option value="all">Toute période</option><option value="today">Aujourd'hui</option><option value="month">Ce mois</option><option value="quarter">Ce trimestre</option><option value="year">Cette année</option></select><select className="filter-select" value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">Toutes les catégories</option>{categories.map((item) => <option key={item} value={item}>{item}</option>)}</select><select className="filter-select" value={jobId} onChange={(event) => setJobId(event.target.value)}><option value="all">Tous les chantiers</option>{jobs.map((job) => <option key={job.id} value={job.id}>{job.title}</option>)}</select></div><div className="expense-total">Total affiché <strong>{money(total)}</strong></div>{error && <p className="form-error" role="alert">{error}</p>}{loading ? <p className="module-state">Chargement des dépenses...</p> : filtered.length === 0 ? <div className="module-empty"><MapPin size={30} /><h2>{search || category !== 'all' || jobId !== 'all' || period !== 'all' ? 'Aucun résultat' : 'Aucune dépense pour le moment'}</h2><p>Les dépenses enregistrées apparaîtront ici.</p>{!search && category === 'all' && jobId === 'all' && period === 'all' && <button className="secondary-button" type="button" onClick={openCreate}>Ajouter une dépense</button>}</div> : <div className="entity-list">{filtered.map((expense) => <article className="entity-row" key={expense.id}><div className="entity-icon expense-icon"><MapPin size={19} /></div><div className="entity-main"><h2>{expense.category}</h2><p>{expense.supplier || 'Fournisseur non renseigné'}{expense.jobs?.title && <> · {expense.jobs.title}</>}</p><p className="entity-meta">{formatDate(expense.expense_date)} · {methods[expense.payment_method] ?? expense.payment_method}{expense.description ? ` · ${expense.description}` : ''}</p></div><div className="entity-side"><strong className="expense-amount">- {money(expense.amount)}</strong><div><button className="icon-button" type="button" aria-label="Modifier la dépense" onClick={() => openEdit(expense)}><Pencil size={15} /></button><button className="icon-button" type="button" aria-label="Supprimer la dépense" onClick={() => remove(expense)}><Trash2 size={15} /></button></div></div></article>)}</div>}{formOpen && <ExpenseForm expense={editing} jobs={jobs} saving={saving} error={formError} onClose={() => setFormOpen(false)} onSubmit={submit} />}</section>
}

function ExpenseForm({ expense, jobs, saving, error, onClose, onSubmit }) {
  const values = expense ?? emptyExpense
  return <div className="modal-backdrop"><section className="client-modal" role="dialog" aria-modal="true" aria-labelledby="expense-form-title"><div className="modal-header"><div><p className="eyebrow">{expense ? 'Modifier la dépense' : 'Nouvelle dépense'}</p><h2 id="expense-form-title">{expense ? values.category : 'Ajouter une dépense'}</h2></div><button className="icon-button" type="button" aria-label="Fermer" onClick={onClose}><X size={20} /></button></div><form className="client-form" onSubmit={onSubmit}><label>Catégorie<select name="category" defaultValue={values.category}>{categories.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><label>Montant *<input name="amount" type="number" min="0.01" step="0.01" defaultValue={values.amount ?? ''} required /></label><label>Date<input name="expense_date" type="date" defaultValue={values.expense_date ?? today} required /></label><label>Fournisseur<input name="supplier" defaultValue={values.supplier ?? ''} /></label><label>Mode de paiement<select name="payment_method" defaultValue={values.payment_method ?? 'cash'}>{Object.entries(methods).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label>Chantier<select name="job_id" defaultValue={values.job_id ?? ''}><option value="">Aucun chantier</option>{jobs.map((job) => <option key={job.id} value={job.id}>{job.title}</option>)}</select></label><label>Description<textarea name="description" defaultValue={values.description ?? ''} rows="3" /></label>{error && <p className="form-error" role="alert">{error}</p>}<div className="modal-actions"><button className="secondary-button" type="button" onClick={onClose}>Annuler</button><button className="primary-button" type="submit" disabled={saving}>{saving ? 'Enregistrement...' : 'Enregistrer'}</button></div></form></section></div>
}

function withinPeriod(value, period) { const date = new Date(`${value}T00:00:00`); const now = new Date(); if (period === 'today') return date.toDateString() === now.toDateString(); if (period === 'month') return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear(); if (period === 'quarter') return Math.floor(date.getMonth() / 3) === Math.floor(now.getMonth() / 3) && date.getFullYear() === now.getFullYear(); return date.getFullYear() === now.getFullYear() }

export default ExpensesPage
