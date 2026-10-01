import { useEffect, useMemo, useState } from 'react'
import { Download, FileText, Plus, Search, Trash2, Upload, X } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { getClients } from '../services/clients'
import { deleteDocument, getDocuments, getDocumentSignedUrl, uploadDocument } from '../services/documents'
import { getJobs } from '../services/jobs'

function relatedRecord(value) {
  return Array.isArray(value) ? value[0] : value
}

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Date inconnue'
}

function formatSize(value) {
  const size = Number(value || 0)
  if (size < 1024) return `${size} o`
  if (size < 1024 ** 2) return `${(size / 1024).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Ko`
  if (size < 1024 ** 3) return `${(size / 1024 ** 2).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Mo`
  return `${(size / 1024 ** 3).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Go`
}

function downloadBlob(blob, fileName) {
  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = fileName || 'document.pdf'
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
}

function DocumentsPage() {
  const { business } = useAuth()
  const [documents, setDocuments] = useState([])
  const [clients, setClients] = useState([])
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [openingId, setOpeningId] = useState('')
  const [deletingId, setDeletingId] = useState('')
  const [downloadFallback, setDownloadFallback] = useState(null)
  const [search, setSearch] = useState('')
  const [clientId, setClientId] = useState('all')
  const [jobId, setJobId] = useState('all')
  const [type, setType] = useState('all')

  useEffect(() => {
    const businessId = business?.id
    if (!businessId) return
    let active = true
    Promise.all([getDocuments(businessId), getClients(businessId), getJobs(businessId)])
      .then(([nextDocuments, nextClients, nextJobs]) => {
        if (active) {
          setDocuments(nextDocuments)
          setClients(nextClients)
          setJobs(nextJobs)
        }
      })
      .catch((loadError) => {
        if (active) setError(loadError.message || 'Impossible de charger les documents.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [business?.id])

  const types = useMemo(() => [...new Set(documents.map((document) => document.type).filter(Boolean))].sort(), [documents])
  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('fr')
    return documents.filter((document) => {
      const matchesSearch = !term || document.name.toLocaleLowerCase('fr').includes(term)
      const matchesClient = clientId === 'all' || document.client_id === clientId
      const matchesJob = jobId === 'all' || document.job_id === jobId
      const matchesType = type === 'all' || (type === 'none' ? !document.type : document.type === type)
      return matchesSearch && matchesClient && matchesJob && matchesType
    })
  }, [documents, search, clientId, jobId, type])

  async function handleUpload({ file, title, clientId: selectedClientId, jobId: selectedJobId }) {
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const document = await uploadDocument(business.id, file, { title, clientId: selectedClientId, jobId: selectedJobId })
      setDocuments((current) => [document, ...current])
      setFormOpen(false)
      setNotice('Document ajouté.')
      return true
    } catch (uploadError) {
      setError(uploadError.message || 'Impossible de téléverser le document.')
      return false
    } finally {
      setSaving(false)
    }
  }

  async function openDocument(document) {
    const newTab = window.open('about:blank', '_blank')
    setOpeningId(document.id)
    setError('')
    setNotice('')
    setDownloadFallback(null)
    let objectUrl = ''
    try {
      const signedUrl = await getDocumentSignedUrl(document, business.id)
      const response = await fetch(signedUrl)
      if (!response.ok) throw new Error(`Le téléchargement du document a échoué (HTTP ${response.status}).`)

      const blob = await response.blob()
      const contentType = (blob.type || response.headers.get('content-type') || '').toLowerCase()
      if (!contentType.startsWith('application/pdf')) throw new Error('Le fichier reçu n’est pas reconnu comme un PDF.')

      setDownloadFallback({ blob, fileName: document.name })
      if (!newTab) {
        downloadBlob(blob, document.name)
        setNotice('La fenêtre d’ouverture a été bloquée; le PDF a été téléchargé.')
        return
      }

      objectUrl = URL.createObjectURL(blob)
      newTab.location.href = objectUrl
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 5 * 60 * 1000)
      setNotice('PDF ouvert. Si le lecteur reste vide, téléchargez-le.')
    } catch (openError) {
      if (newTab && !newTab.closed) newTab.close()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
      setError(openError.message || 'Impossible d’ouvrir ce document.')
    } finally {
      setOpeningId('')
    }
  }

  async function removeDocument(document) {
    if (!window.confirm(`Supprimer définitivement « ${document.name} » ?`)) return
    setDeletingId(document.id)
    setError('')
    setNotice('')
    try {
      await deleteDocument(document, business.id)
      setDocuments((current) => current.filter((item) => item.id !== document.id))
      setNotice('Document supprimé.')
    } catch (deleteError) {
      setError(deleteError.message || 'Impossible de supprimer le document.')
    } finally {
      setDeletingId('')
    }
  }

  return <section className="content module-content">
    <div className="module-header">
      <div><p className="eyebrow">Fichiers de votre activité</p><h1>Documents</h1><p className="module-subtitle">Retrouvez vos fichiers et pièces liés aux clients et chantiers.</p></div>
      <button className="primary-button module-new-button" type="button" onClick={() => { setError(''); setNotice(''); setFormOpen(true) }}><Plus size={17} /> Ajouter un document</button>
    </div>
    <div className="module-toolbar document-filters">
      <label className="search-field"><Search size={17} /><span className="sr-only">Rechercher un document</span><input type="search" placeholder="Rechercher par nom" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
      <select className="filter-select" aria-label="Filtrer par client" value={clientId} onChange={(event) => setClientId(event.target.value)}><option value="all">Tous les clients</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.company_name || client.name}</option>)}</select>
      <select className="filter-select" aria-label="Filtrer par chantier" value={jobId} onChange={(event) => setJobId(event.target.value)}><option value="all">Tous les chantiers</option>{jobs.map((job) => <option key={job.id} value={job.id}>{job.title}</option>)}</select>
      <select className="filter-select" aria-label="Filtrer par type de fichier" value={type} onChange={(event) => setType(event.target.value)}><option value="all">Tous les types</option><option value="none">Sans extension</option>{types.map((item) => <option key={item} value={item}>{item.toUpperCase()}</option>)}</select>
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}
    {notice && <p className="form-message" role="status">{notice}</p>}
    {downloadFallback && <button className="secondary-button document-fallback-download" type="button" onClick={() => downloadBlob(downloadFallback.blob, downloadFallback.fileName)}><Download size={15} /> Télécharger le PDF</button>}
    {loading ? <p className="module-state">Chargement des documents...</p> : filtered.length === 0 ? <div className="module-empty"><FileText size={30} /><h2>{documents.length ? 'Aucun résultat' : 'Aucun document pour le moment'}</h2><p>{documents.length ? 'Modifiez votre recherche ou vos filtres.' : 'Ajoutez un fichier pour le retrouver ici.'}</p>{documents.length === 0 && <button className="secondary-button" type="button" onClick={() => setFormOpen(true)}><Upload size={15} /> Ajouter un document</button>}</div> : <div className="entity-list documents-list">
      {filtered.map((document) => {
        const client = relatedRecord(document.clients)
        const job = relatedRecord(document.jobs)
        return <article className="entity-row document-row" key={document.id}>
          <div className="entity-icon"><FileText size={19} /></div>
          <div className="entity-main"><h2>{document.name}</h2><p>{(document.type || document.mime_type?.split('/').pop() || 'Fichier').toUpperCase()} · {formatSize(document.size)} · Ajouté le {formatDate(document.created_at)}</p><p className="entity-meta">{[client?.company_name || client?.name, job?.title].filter(Boolean).join(' · ') || 'Aucune association'}</p></div>
          <div className="document-actions"><button className="secondary-button document-open" type="button" onClick={() => openDocument(document)} disabled={openingId === document.id}><Download size={15} /> {openingId === document.id ? 'Ouverture...' : 'Ouvrir'}</button><button className="icon-button" type="button" aria-label={`Supprimer ${document.name}`} title="Supprimer le document" disabled={deletingId === document.id} onClick={() => removeDocument(document)}><Trash2 size={17} /></button></div>
        </article>
      })}
    </div>}
    {formOpen && <DocumentUploadForm clients={clients} jobs={jobs} saving={saving} onClose={() => setFormOpen(false)} onSubmit={handleUpload} />}
  </section>
}

function DocumentUploadForm({ clients, jobs, saving, onClose, onSubmit }) {
  const [file, setFile] = useState(null)
  const [title, setTitle] = useState('')
  const [clientId, setClientId] = useState('')
  const [jobId, setJobId] = useState('')
  const [error, setError] = useState('')

  async function submit(event) {
    event.preventDefault()
    setError('')
    if (!file) {
      setError('Sélectionnez un fichier à téléverser.')
      return
    }
    if (clientId && jobId && jobs.find((job) => job.id === jobId)?.client_id !== clientId) {
      setError('Le chantier sélectionné ne correspond pas au client choisi.')
      return
    }
    const succeeded = await onSubmit({ file, title, clientId, jobId })
    if (!succeeded) setError('Le téléversement a échoué. Vérifiez le message affiché dans la page.')
  }

  return <div className="modal-backdrop"><section className="client-modal" role="dialog" aria-modal="true" aria-labelledby="document-form-title"><div className="modal-header"><div><p className="eyebrow">Nouveau fichier</p><h2 id="document-form-title">Ajouter un document</h2></div><button className="icon-button" type="button" aria-label="Fermer" onClick={onClose}><X size={20} /></button></div><form className="client-form" onSubmit={submit}>
    <label>Fichier *<input type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} required /></label>
    {file && <p className="document-selected-file">{file.name} · {formatSize(file.size)}</p>}
    <label>Nom du document (facultatif)<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={file?.name || 'Ex. Contrat signé'} /></label>
    <label>Client (facultatif)<select value={clientId} onChange={(event) => setClientId(event.target.value)}><option value="">Aucun client</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.company_name || client.name}</option>)}</select></label>
    <label>Chantier (facultatif)<select value={jobId} onChange={(event) => setJobId(event.target.value)}><option value="">Aucun chantier</option>{jobs.map((job) => <option key={job.id} value={job.id}>{job.title}</option>)}</select></label>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="modal-actions"><button className="secondary-button" type="button" onClick={onClose}>Annuler</button><button className="primary-button" type="submit" disabled={saving}><Upload size={15} /> {saving ? 'Téléversement...' : 'Téléverser'}</button></div>
  </form></section></div>
}

export default DocumentsPage