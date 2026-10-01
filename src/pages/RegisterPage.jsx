import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getCurrentBusiness, signUp } from '../services/auth'
import AuthLayout from '../components/AuthLayout'

function RegisterPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '', confirmation: '' })
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setMessage('')
    if (form.password !== form.confirmation) {
      setError('Les mots de passe ne correspondent pas.')
      return
    }
    setLoading(true)
    try {
      const { user, session } = await signUp(form.email, form.password)
      if (!session || !user) {
        setMessage('Votre compte est créé. Consultez votre boîte mail pour confirmer votre adresse avant de vous connecter.')
        return
      }
      const business = await getCurrentBusiness(user)
      navigate(business ? '/' : '/setup', { replace: true })
    } catch (signUpError) {
      setError(signUpError.message || 'Impossible de créer votre compte.')
    } finally {
      setLoading(false)
    }
  }

  return <AuthLayout eyebrow="Créer votre espace" title="Commencez simplement."><form className="auth-form" onSubmit={handleSubmit}><label>Email<input type="email" value={form.email} onChange={(event) => updateField('email', event.target.value)} autoComplete="email" required /></label><label>Mot de passe<input type="password" value={form.password} onChange={(event) => updateField('password', event.target.value)} autoComplete="new-password" minLength="6" required /></label><label>Confirmer le mot de passe<input type="password" value={form.confirmation} onChange={(event) => updateField('confirmation', event.target.value)} autoComplete="new-password" minLength="6" required /></label>{error && <p className="form-error" role="alert">{error}</p>}{message && <p className="form-message" role="status">{message}</p>}<button className="primary-button" type="submit" disabled={loading}>{loading ? 'Création...' : 'Créer mon compte'}</button><p className="auth-switch">Déjà un compte ? <Link to="/login">Se connecter</Link></p></form></AuthLayout>
}

export default RegisterPage
