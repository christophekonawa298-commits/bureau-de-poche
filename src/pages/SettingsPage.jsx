import { useState } from 'react'
import { Check, Save } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { updateBusiness } from '../services/businesses'

const currencies = ['XAF', 'EUR', 'USD']

function businessForm(business) {
  return {
    name: business?.name ?? '',
    phone: business?.phone ?? '',
    email: business?.email ?? '',
    address: business?.address ?? '',
    currency: business?.currency ?? 'XAF',
    invoice_prefix: business?.invoice_prefix ?? 'FAC',
    quote_prefix: business?.quote_prefix ?? 'DEV',
  }
}

function SettingsPage() {
  const { business, refreshBusiness } = useAuth()
  const [form, setForm] = useState(() => businessForm(business))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  function updateField(field, value) {
    setForm(current => ({ ...current, [field]: value }))
    setSuccess('')
  }

  async function submit(event) {
    event.preventDefault()
    setError('')
    setSuccess('')
    const data = {
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      address: form.address.trim() || null,
      currency: form.currency,
      invoice_prefix: form.invoice_prefix.trim(),
      quote_prefix: form.quote_prefix.trim(),
    }
    if (!data.name || !data.invoice_prefix || !data.quote_prefix) {
      setError('Le nom de l’entreprise et les deux préfixes sont obligatoires.')
      return
    }

    setSaving(true)
    try {
      const updated = await updateBusiness(business.id, data)
      setForm(businessForm(updated))
      setSuccess('Les informations de l’entreprise ont été enregistrées.')
      try {
        await refreshBusiness()
      } catch {
        setError('Les informations sont enregistrées, mais le profil local n’a pas pu être actualisé.')
      }
    } catch (saveError) {
      setError(saveError.message || 'Impossible d’enregistrer les informations de l’entreprise.')
    } finally {
      setSaving(false)
    }
  }

  return <section className="content module-content settings-content">
    <div className="module-header"><div><p className="eyebrow">Votre espace professionnel</p><h1>Paramètres</h1><p className="module-subtitle">Gérez les coordonnées et les préférences de votre entreprise.</p></div></div>
    <form className="client-form settings-form" onSubmit={submit}>
      <label>Nom de l’entreprise *<input value={form.name} onChange={event => updateField('name', event.target.value)} maxLength={160} required /></label>
      <div className="form-two-columns">
        <label>Téléphone<input type="tel" value={form.phone} onChange={event => updateField('phone', event.target.value)} /></label>
        <label>Email professionnel<input type="email" value={form.email} onChange={event => updateField('email', event.target.value)} /></label>
      </div>
      <label>Adresse<textarea value={form.address} onChange={event => updateField('address', event.target.value)} rows="3" /></label>
      <label>Devise<select value={form.currency} onChange={event => updateField('currency', event.target.value)}>{currencies.map(currency => <option key={currency} value={currency}>{currency}</option>)}</select></label>
      <div className="form-two-columns">
        <label>Préfixe des factures *<input value={form.invoice_prefix} onChange={event => updateField('invoice_prefix', event.target.value)} maxLength={12} required /></label>
        <label>Préfixe des devis *<input value={form.quote_prefix} onChange={event => updateField('quote_prefix', event.target.value)} maxLength={12} required /></label>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {success && <p className="form-message" role="status"><Check size={15} /> {success}</p>}
      <div className="modal-actions"><button className="primary-button" type="submit" disabled={saving}><Save size={16} /> {saving ? 'Enregistrement...' : 'Enregistrer'}</button></div>
    </form>
  </section>
}

export default SettingsPage