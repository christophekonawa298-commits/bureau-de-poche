import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'

function BusinessSetupPage() {
  const navigate = useNavigate()
  const { user, refreshBusiness } = useAuth()
  const [form, setForm] = useState({ name: '', phone: '', email: user?.email ?? '', address: '', currency: 'XAF' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { error: insertError } = await supabase.from('businesses').insert({ ...form, owner_id: user.id })
      if (insertError) throw insertError
      await refreshBusiness()
      navigate('/', { replace: true })
    } catch (setupError) {
      setError(setupError.message || 'Impossible de créer votre activité.')
    } finally {
      setLoading(false)
    }
  }

  return <main className="auth-page setup-page"><div className="auth-brand"><span className="brand-mark">B</span><span>Bureau de Poche</span></div><section className="auth-panel"><p className="eyebrow">Votre espace professionnel</p><h1>Configurez votre activité</h1><p className="auth-intro">Ces informations pourront être complétées et modifiées plus tard.</p><form className="auth-form" onSubmit={handleSubmit}><label>Nom de l'activité<input type="text" value={form.name} onChange={(event) => updateField('name', event.target.value)} required /></label><label>Téléphone<input type="tel" value={form.phone} onChange={(event) => updateField('phone', event.target.value)} /></label><label>Email professionnel<input type="email" value={form.email} onChange={(event) => updateField('email', event.target.value)} /></label><label>Adresse<textarea value={form.address} onChange={(event) => updateField('address', event.target.value)} rows="3" /></label><label>Devise<select value={form.currency} onChange={(event) => updateField('currency', event.target.value)}><option value="XAF">XAF</option><option value="EUR">EUR</option><option value="USD">USD</option></select></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="primary-button" type="submit" disabled={loading}>{loading ? 'Enregistrement...' : 'Continuer vers mon espace'}</button></form></section></main>
}

export default BusinessSetupPage
