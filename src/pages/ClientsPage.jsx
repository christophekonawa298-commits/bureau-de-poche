import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Building2, Mail, MapPin, MessageCircle, Pencil, Phone, Plus, Search, Trash2, UserRound, X } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { createClient, deleteClient, getClient, getClients, updateClient } from '../services/clients'

const emptyForm = { name: '', company_name: '', phone: '', whatsapp: '', email: '', address: '', notes: '', status: 'active' }

function cleanForm(form) {
  return Object.fromEntries(Object.entries(form).map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value]))
}

function ClientsPage() {
  const { business } = useAuth()
  const [clients, setClients] = useState([])
  const [selectedClient, setSelectedClient] = useState(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editingClient, setEditingClient] = useState(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [formError, setFormError] = useState('')

  async function loadClients() {
    setLoading(true)
    setError('')
    try {
      setClients(await getClients(business.id))
    } catch (loadError) {
      setError(loadError.message || 'Impossible de charger les clients.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (business?.id) loadClients()
  }, [business?.id])

  const filteredClients = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return clients
    return clients.filter((client) => [client.name, client.company_name, client.phone, client.email].some((value) => value?.toLowerCase().includes(term)))
  }, [clients, search])

  function openCreate() {
    setEditingClient(null)
    setFormError('')
    setFormOpen(true)
  }

  function openEdit(client) {
    setEditingClient(client)
    setFormError('')
    setFormOpen(true)
  }

  async function openDetails(client) {
    setError('')
    try {
      setSelectedClient(await getClient(client.id, business.id))
    } catch (detailError) {
      setError(detailError.message || 'Impossible de charger la fiche client.')
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const formData = Object.fromEntries(new FormData(event.currentTarget).entries())
    const cleanedData = cleanForm(formData)
    if (!cleanedData.name) {
      setFormError('Le nom du client est obligatoire.')
      return
    }
    setSaving(true)
    setFormError('')
    try {
      if (editingClient) await updateClient(editingClient.id, business.id, cleanedData)
      else await createClient(business.id, cleanedData)
      setFormOpen(false)
      await loadClients()
      if (selectedClient && editingClient?.id === selectedClient.id) setSelectedClient(await getClient(selectedClient.id, business.id))
    } catch (saveError) {
      setFormError(saveError.message || 'Impossible d’enregistrer le client.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(client) {
    if (!window.confirm(`Supprimer définitivement le client « ${client.name} » ?`)) return
    setError('')
    try {
      await deleteClient(client.id, business.id)
      setSelectedClient(null)
      await loadClients()
    } catch (deleteError) {
      setError(deleteError.message || 'Impossible de supprimer le client.')
    }
  }

  return <section className="content clients-content"><div className="clients-header"><div><p className="eyebrow">Votre carnet professionnel</p><h1>Clients</h1><p className="clients-subtitle">Retrouvez les personnes et entreprises avec lesquelles vous travaillez.</p></div><button className="primary-button clients-new-button" type="button" onClick={openCreate}><Plus size={17} /> Nouveau client</button></div><div className="clients-toolbar"><label className="search-field"><Search size={17} /><span className="sr-only">Rechercher un client</span><input type="search" placeholder="Rechercher par nom, entreprise, téléphone ou email" value={search} onChange={(event) => setSearch(event.target.value)} /></label><span className="clients-count">{filteredClients.length} client{filteredClients.length === 1 ? '' : 's'}</span></div>{error && <p className="form-error" role="alert">{error}</p>}{loading ? <p className="clients-state">Chargement des clients...</p> : filteredClients.length === 0 ? <div className="clients-empty"><UserRound size={30} /><h2>{search ? 'Aucun résultat' : 'Aucun client pour le moment'}</h2><p>{search ? 'Essayez un autre terme de recherche.' : 'Ajoutez votre premier client pour commencer votre carnet.'}</p>{!search && <button className="secondary-button" type="button" onClick={openCreate}>Ajouter un client</button>}</div> : <div className="clients-list">{filteredClients.map((client) => <article className="client-row" key={client.id} onClick={() => openDetails(client)}><div className="client-avatar">{client.name.slice(0, 1).toUpperCase()}</div><div className="client-main"><h2>{client.name}</h2>{client.company_name && <p><Building2 size={14} /> {client.company_name}</p>}{(client.phone || client.email) && <p className="client-contact">{client.phone && <><Phone size={13} /> {client.phone}</>}{client.email && <><Mail size={13} /> {client.email}</>}</p>}</div><span className={`status-badge ${client.status}`}>{client.status === 'active' ? 'Actif' : 'Inactif'}</span><button className="icon-button" type="button" aria-label={`Ouvrir la fiche de ${client.name}`} onClick={(event) => { event.stopPropagation(); openDetails(client) }}><ArrowLeft size={17} /></button></article>)}</div>}{formOpen && <ClientForm client={editingClient} saving={saving} error={formError} onClose={() => setFormOpen(false)} onSubmit={handleSubmit} />}{selectedClient && <ClientDetails client={selectedClient} onClose={() => setSelectedClient(null)} onEdit={() => { openEdit(selectedClient); setSelectedClient(null) }} onDelete={() => handleDelete(selectedClient)} />}</section>
}

function ClientForm({ client, saving, error, onClose, onSubmit }) {
  const values = client ?? emptyForm
  return <div className="modal-backdrop"><section className="client-modal" role="dialog" aria-modal="true" aria-labelledby="client-form-title"><div className="modal-header"><div><p className="eyebrow">{client ? 'Modifier la fiche' : 'Nouvelle fiche'}</p><h2 id="client-form-title">{client ? client.name : 'Nouveau client'}</h2></div><button className="icon-button" type="button" aria-label="Fermer" onClick={onClose}><X size={20} /></button></div><form className="client-form" onSubmit={onSubmit}><label>Nom du client *<input name="name" defaultValue={values.name} required /></label><label>Entreprise<input name="company_name" defaultValue={values.company_name ?? ''} /></label><div className="form-two-columns"><label>Téléphone<input name="phone" defaultValue={values.phone ?? ''} type="tel" /></label><label>WhatsApp<input name="whatsapp" defaultValue={values.whatsapp ?? ''} type="tel" /></label></div><label>Email<input name="email" defaultValue={values.email ?? ''} type="email" /></label><label>Adresse<textarea name="address" defaultValue={values.address ?? ''} rows="2" /></label><label>Notes<textarea name="notes" defaultValue={values.notes ?? ''} rows="3" /></label><label>Statut<select name="status" defaultValue={values.status ?? 'active'}><option value="active">Actif</option><option value="inactive">Inactif</option></select></label>{error && <p className="form-error" role="alert">{error}</p>}<div className="modal-actions"><button className="secondary-button" type="button" onClick={onClose}>Annuler</button><button className="primary-button" type="submit" disabled={saving}>{saving ? 'Enregistrement...' : 'Enregistrer'}</button></div></form></section></div>
}

function ClientDetails({ client, onClose, onEdit, onDelete }) {
  return <div className="modal-backdrop"><section className="client-modal details-modal" role="dialog" aria-modal="true" aria-labelledby="client-details-title"><div className="modal-header"><div><p className="eyebrow">Fiche client</p><h2 id="client-details-title">{client.name}</h2></div><button className="icon-button" type="button" aria-label="Fermer" onClick={onClose}><X size={20} /></button></div><div className="details-grid">{client.company_name && <Detail icon={Building2} label="Entreprise" value={client.company_name} />}{client.phone && <Detail icon={Phone} label="Téléphone" value={client.phone} />}{client.whatsapp && <Detail icon={MessageCircle} label="WhatsApp" value={client.whatsapp} />}{client.email && <Detail icon={Mail} label="Email" value={client.email} />}{client.address && <Detail icon={MapPin} label="Adresse" value={client.address} />}</div>{client.notes && <div className="notes-block"><strong>Notes</strong><p>{client.notes}</p></div>}<div className="details-meta"><span className={`status-badge ${client.status}`}>{client.status === 'active' ? 'Actif' : 'Inactif'}</span><span>Créé le {new Date(client.created_at).toLocaleDateString('fr-FR')}</span></div><div className="future-sections"><span>Chantiers</span><span>Devis</span><span>Factures</span><span>Paiements</span><span>Documents</span></div><div className="modal-actions"><button className="danger-button" type="button" onClick={onDelete}><Trash2 size={16} /> Supprimer</button><button className="primary-button" type="button" onClick={onEdit}><Pencil size={16} /> Modifier</button></div></section></div>
}

function Detail({ icon: Icon, label, value }) {
  return <div className="detail-item"><Icon size={16} /><div><span>{label}</span><strong>{value}</strong></div></div>
}

export default ClientsPage
