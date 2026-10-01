import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth, AuthProvider } from './hooks/useAuth'
import AppShell from './layouts/AppShell'
import Dashboard from './pages/Dashboard'
import BusinessSetupPage from './pages/BusinessSetupPage'
import ClientsPage from './pages/ClientsPage'
import CaissePage from './pages/CaissePage'
import DocumentsPage from './pages/DocumentsPage'
import ExpensesPage from './pages/ExpensesPage'
import AgendaPage from './pages/AgendaPage'
import JobsPage from './pages/JobsPage'
import InvoicesPage from './pages/InvoicesPage'
import LoginPage from './pages/LoginPage'
import PlaceholderPage from './pages/PlaceholderPage'
import RegisterPage from './pages/RegisterPage'
import QuotesPage from './pages/QuotesPage'
import ReportsPage from './pages/ReportsPage'
import SettingsPage from './pages/SettingsPage'
import { navigationItems } from './lib/navigation'
import './App.css'

function App() {
  return <AuthProvider><BrowserRouter><Routes><Route path="/login" element={<PublicOnly><LoginPage /></PublicOnly>} /><Route path="/register" element={<PublicOnly><RegisterPage /></PublicOnly>} /><Route element={<ProtectedRoute />}><Route path="/setup" element={<BusinessSetupPage />} /><Route element={<BusinessRequired />}><Route element={<AppShell />}><Route index element={<Dashboard />} /><Route path="clients" element={<ClientsPage />} /><Route path="chantiers" element={<JobsPage />} /><Route path="devis" element={<QuotesPage />} /><Route path="factures" element={<InvoicesPage />} /><Route path="depenses" element={<ExpensesPage />} /><Route path="caisse" element={<CaissePage />} /><Route path="documents" element={<DocumentsPage />} /><Route path="agenda" element={<AgendaPage />} /><Route path="rapports" element={<ReportsPage />} /><Route path="parametres" element={<SettingsPage />} /><Route path="finance" element={<Navigate to="/caisse" replace />} />{navigationItems.slice(11).map((item) => <Route key={item.path} path={item.path.slice(1)} element={<PlaceholderPage item={item} />} />)}</Route></Route></Route><Route path="*" element={<Navigate to="/" replace />} /></Routes></BrowserRouter></AuthProvider>
}

function LoadingScreen() {
  return <main className="auth-page"><p className="loading-message">Chargement de votre espace...</p></main>
}

function PublicOnly({ children }) {
  const { user, business, loading } = useAuth()
  if (loading) return <LoadingScreen />
  if (user) return <Navigate to={business ? '/' : '/setup'} replace />
  return children
}

function ProtectedRoute() {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <LoadingScreen />
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />
  return <Outlet />
}

function BusinessRequired() {
  const { business } = useAuth()
  const location = useLocation()
  if (!business) return <Navigate to="/setup" replace />
  if (location.pathname === '/setup') return <Navigate to="/" replace />
  return <Outlet />
}

export default App
