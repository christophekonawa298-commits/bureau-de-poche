function PlaceholderPage({ item }) {
  return <section className="content"><div className="placeholder"><p className="eyebrow">Module à venir</p><h1>{item.label}</h1><p>{item.description}</p><div className="placeholder-panel">Cet espace sera disponible dans une prochaine version.</div></div></section>
}

export default PlaceholderPage