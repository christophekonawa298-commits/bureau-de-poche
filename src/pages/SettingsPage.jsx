import { useEffect, useState } from 'react'
import { Check, Save, Trash2, Upload } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { getBusinessLogoSignedUrl, removeBusinessLogo, updateBusiness, uploadBusinessLogo } from '../services/businesses'

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
  const [logoUploading, setLogoUploading] = useState(false)
  const [logoPreview, setLogoPreview] = useState('')
  const [logoError, setLogoError] = useState('')
  const [logoSuccess, setLogoSuccess] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    let active = true
    if (!business?.logo_url) {
      setLogoPreview('')
      return () => { active = false }
    }

    async function loadLogo() {
      try {
        const signedUrl = await getBusinessLogoSignedUrl(business.id, business.logo_url)
        if (active) setLogoPreview(signedUrl || '')
      } catch {
        if (active) setLogoPreview('')
      }
    }

    loadLogo()
    return () => { active = false }
  }, [business?.id, business?.logo_url])

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

  async function handleLogoChange(event) {
    const file = event.target.files?.[0] ?? null
    event.target.value = ''
    if (!file) return

    const validType = ['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || ['png', 'jpg', 'jpeg', 'webp'].includes((file.name.split('.').pop() || '').toLowerCase())
    if (!validType) {
      setLogoError('Format de logo invalide. Utilisez PNG, JPG/JPEG ou WebP.')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setLogoError('Le logo ne doit pas dépasser 2 Mo.')
      return
    }

    setLogoError('')
    setLogoSuccess('')
    setLogoUploading(true)
    try {
      const updated = await uploadBusinessLogo(business.id, file, business?.logo_url ?? null)
      setLogoPreview(updated?.logo_url ? await getBusinessLogoSignedUrl(updated.id, updated.logo_url) : '')
      setLogoSuccess('Le logo a été mis à jour.')
      await refreshBusiness()
    } catch (uploadError) {
      setLogoError(uploadError.message || 'Impossible de téléverser le logo.')
    } finally {
      setLogoUploading(false)
    }
  }

  async function removeLogo() {
    if (!business?.logo_url) return
    setLogoError('')
    setLogoSuccess('')
    setLogoUploading(true)
    try {
      await removeBusinessLogo(business.id, business.logo_url)
      setLogoPreview('')
      setLogoSuccess('Le logo a été retiré.')
      await refreshBusiness()
    } catch (uploadError) {
      setLogoError(uploadError.message || 'Impossible de retirer le logo.')
    } finally {
      setLogoUploading(false)
    }
  }

  return <section className="content module-content settings-content">
    <div className="module-header"><div><p className="eyebrow">Votre espace professionnel</p><h1>Paramètres</h1><p className="module-subtitle">Gérez les coordonnées et les préférences de votre entreprise.</p></div></div>
    <div className="logo-upload-block">
      <label>Logo de l’entreprise</label>
      <div className="form-two-columns" style={{ alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 110, border: '1px dashed #c8d0d5', borderRadius: 12, background: '#f7fafb', overflow: 'hidden' }}>
          {logoPreview ? <img src={logoPreview} alt="Logo de l’entreprise" style={{ maxWidth: 180, maxHeight: 90, objectFit: 'contain' }} /> : <span style={{ color: '#5c6870', fontSize: 14 }}>Aucun logo</span>}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label className="secondary-button" style={{ display: 'inline-flex', width: 'fit-content', cursor: 'pointer' }}>
            <Upload size={15} /> {logoUploading ? 'Envoi...' : 'Importer un logo'}
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleLogoChange} style={{ display: 'none' }} />
          </label>
          {business?.logo_url && <button className="danger-button" type="button" onClick={removeLogo} disabled={logoUploading}><Trash2 size={15} /> Retirer le logo</button>}
        </div>
      </div>
      {logoError && <p className="form-error" role="alert">{logoError}</p>}
      {logoSuccess && <p className="form-message" role="status"><Check size={15} /> {logoSuccess}</p>}
    </div>
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