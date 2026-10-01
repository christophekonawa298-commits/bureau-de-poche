import { Menu, X } from 'lucide-react'
import { useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { navigationItems } from '../lib/navigation'
import { useAuth } from '../hooks/useAuth'

function Navigation({ mobile = false }) {
  const items = mobile ? navigationItems.slice(0, 4) : navigationItems
  return <nav className={mobile ? 'bottom-nav' : 'nav'}>{items.map(({ label, path, icon: Icon }) => <NavLink key={path} to={path} className={({ isActive }) => `${mobile ? 'bottom-link' : 'nav-link'}${isActive ? ' active' : ''}`}><Icon size={mobile ? 18 : 17} strokeWidth={1.8} /><span>{mobile ? label.split(' ')[0] : label}</span></NavLink>)}</nav>
}

function AppShell() {
  const [menuOpen, setMenuOpen] = useState(false)
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const { pathname } = useLocation()
  const current = navigationItems.find((item) => item.path === pathname) ?? navigationItems[0]

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return <div className="app-shell"><aside className={`sidebar${menuOpen ? ' mobile-open' : ''}`}><NavLink className="brand" to="/" onClick={() => setMenuOpen(false)}><span className="brand-mark">B</span><span className="brand-name">Bureau de Poche</span></NavLink><Navigation /><p className="sidebar-footer">Votre bureau professionnel,<br />partout avec vous.</p></aside><main className="main-area"><header className="topbar"><div className="topbar-left"><button className="mobile-menu" type="button" aria-label={menuOpen ? 'Fermer le menu' : 'Ouvrir le menu'} onClick={() => setMenuOpen((open) => !open)}>{menuOpen ? <X size={22} /> : <Menu size={22} />}</button><div><p className="eyebrow">Espace professionnel</p><p className="topbar-title">{current.label}</p></div></div><div className="profile"><span>{user?.email}</span><button className="sign-out-button" type="button" onClick={handleSignOut}>Se déconnecter</button></div></header><Outlet /><Navigation mobile /></main></div>
}

export default AppShell