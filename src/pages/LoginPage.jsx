import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { getCurrentBusiness, signIn } from '../services/auth'
import AuthLayout from '../components/AuthLayout'

function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { user } = await signIn(email, password)
      const business = await getCurrentBusiness(user)
      navigate(business ? (location.state?.from ?? '/') : '/setup', { replace: true })
    } catch (signInError) {
      setError(signInError.message || 'Impossible de vous connecter.')
    } finally {
      setLoading(false)
    }
  }

  return <AuthLayout eyebrow="Bienvenue dans votre espace" title="Votre bureau, partout avec vous."><form className="auth-form" onSubmit={handleSubmit}><label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label><label>Mot de passe<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="primary-button" type="submit" disabled={loading}>{loading ? 'Connexion...' : 'Se connecter'}</button><p className="auth-switch">Pas encore de compte ? <Link to="/register">Créer un compte</Link></p></form></AuthLayout>
}

export default LoginPage
