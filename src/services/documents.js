import { supabase } from '../lib/supabase'

const documentsBucket = 'documents'

function requireBusiness(businessId) {
	if (!businessId) throw new Error('Business non disponible pour cette opération.')
}

function ensureDocumentPath(document, businessId) {
	requireBusiness(businessId)
	if (!document?.storage_path?.startsWith(`${businessId}/`)) throw new Error('Le document ne correspond pas à cette entreprise.')
}

function safeFileName(fileName) {
	return fileName.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^[_.]+|[_.]+$/g, '') || 'document'
}

function fileExtension(fileName) {
	const dot = fileName.lastIndexOf('.')
	return dot > 0 && dot < fileName.length - 1 ? fileName.slice(dot + 1).toLowerCase() : null
}

export async function getDocuments(businessId) {
	requireBusiness(businessId)
	const { data, error } = await supabase.from('documents').select('*, clients(id, name, company_name), jobs(id, title)').eq('business_id', businessId).order('created_at', { ascending: false })
	if (error) throw error
	return data ?? []
}

export async function uploadDocument(businessId, file, { title, clientId, jobId }) {
	requireBusiness(businessId)
	if (!file) throw new Error('Sélectionnez un fichier à téléverser.')

	if (clientId) {
		const { data, error } = await supabase.from('clients').select('id').eq('id', clientId).eq('business_id', businessId).maybeSingle()
		if (error) throw error
		if (!data) throw new Error('Le client sélectionné est introuvable dans cette entreprise.')
	}
	if (jobId) {
		const { data, error } = await supabase.from('jobs').select('id, client_id').eq('id', jobId).eq('business_id', businessId).maybeSingle()
		if (error) throw error
		if (!data) throw new Error('Le chantier sélectionné est introuvable dans cette entreprise.')
		if (clientId && data.client_id !== clientId) throw new Error('Le chantier sélectionné ne correspond pas au client choisi.')
	}

	const storagePath = `${businessId}/${globalThis.crypto.randomUUID()}-${safeFileName(file.name)}`
	const { error: uploadError } = await supabase.storage.from(documentsBucket).upload(storagePath, file, {
		cacheControl: '3600',
		contentType: file.type || undefined,
		upsert: false,
	})
	if (uploadError) throw uploadError

	const { data: document, error: insertError } = await supabase.from('documents').insert({
		business_id: businessId,
		client_id: clientId || null,
		job_id: jobId || null,
		type: fileExtension(file.name),
		name: title?.trim() || file.name,
		storage_path: storagePath,
		mime_type: file.type || null,
		size: file.size,
	}).select('*, clients(id, name, company_name), jobs(id, title)').single()

	if (insertError) {
		const { error: cleanupError } = await supabase.storage.from(documentsBucket).remove([storagePath])
		if (cleanupError) throw new Error(`${insertError.message} Le fichier téléversé n'a pas pu être nettoyé : ${cleanupError.message}`)
		throw insertError
	}
	return document
}

export async function getDocumentSignedUrl(document, businessId) {
	ensureDocumentPath(document, businessId)
	const { data, error } = await supabase.storage.from(documentsBucket).createSignedUrl(document.storage_path, 300)
	if (error) throw error
	return data.signedUrl
}

export async function deleteDocument(document, businessId) {
	ensureDocumentPath(document, businessId)
	const { data: deleted, error: deleteError } = await supabase.from('documents').delete().eq('id', document.id).eq('business_id', businessId).select('id').maybeSingle()
	if (deleteError) throw deleteError
	if (!deleted) throw new Error('Ce document est introuvable ou n’appartient pas à cette entreprise.')

	const { error: storageError } = await supabase.storage.from(documentsBucket).remove([document.storage_path])
	if (!storageError) return

	const { error: restoreError } = await supabase.from('documents').insert({
		id: document.id,
		business_id: document.business_id,
		client_id: document.client_id,
		job_id: document.job_id,
		quote_id: document.quote_id,
		invoice_id: document.invoice_id,
		type: document.type,
		name: document.name,
		storage_path: document.storage_path,
		mime_type: document.mime_type,
		size: document.size,
		created_at: document.created_at,
	})
	if (restoreError) throw new Error(`${storageError.message} La fiche du document n'a pas pu être restaurée : ${restoreError.message}`)
	throw storageError
}
