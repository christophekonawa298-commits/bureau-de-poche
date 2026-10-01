function AuthLayout({ eyebrow, title, children }) {
  return <main className="auth-page"><div className="auth-brand"><span className="brand-mark">B</span><span>Bureau de Poche</span></div><section className="auth-panel"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1>{children}</section></main>
}

export default AuthLayout
