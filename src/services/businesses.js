import { supabase } from '../lib/supabase'

const documentsBucket = 'documents'

function sanitizeFileName(fileName) {
	return String(fileName || 'logo')
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^a-zA-Z0-9._-]+/g, '_')
		.replace(/^[_.]+|[_.]+$/g, '') || 'logo'
}

export async function updateBusiness(businessId, data) {
	if (!businessId) throw new Error('Business non disponible pour cette opération.')
	const { data: business, error } = await supabase.from('businesses').update(data).eq('id', businessId).select('*').single()
	if (error) throw error
	return business
}

export async function getBusinessLogoSignedUrl(businessId, logoPath) {
	if (!businessId || !logoPath) return null
	const { data, error } = await supabase.storage.from(documentsBucket).createSignedUrl(logoPath, 3600)
	if (error) {
		if (error.message && /not found|does not exist/i.test(error.message)) return null
		throw error
	}
	return data?.signedUrl ?? null
}

export async function uploadBusinessLogo(businessId, file, currentLogoPath = null) {
	if (!businessId) throw new Error('Business non disponible pour cette opération.')
	if (!file) throw new Error('Sélectionnez un logo à importer.')

	const allowedTypes = ['image/png', 'image/jpeg', 'image/webp']
	const extension = String(file.name || '').split('.').pop()?.toLowerCase()
	if (!allowedTypes.includes(file.type) && !['png', 'jpg', 'jpeg', 'webp'].includes(extension || '')) {
		throw new Error('Le logo doit être au format PNG, JPG/JPEG ou WebP.')
	}
	if (file.size > 2 * 1024 * 1024) {
		throw new Error('Le logo doit être inférieur à 2 Mo.')
	}

	const storagePath = `${businessId}/logo/${Date.now()}-${sanitizeFileName(file.name)}`
	const { error: uploadError } = await supabase.storage.from(documentsBucket).upload(storagePath, file, {
		cacheControl: '3600',
		contentType: file.type || undefined,
		upsert: true,
	})
	if (uploadError) throw uploadError

	const { data: business, error: updateError } = await supabase.from('businesses').update({ logo_url: storagePath }).eq('id', businessId).select('*').single()
	if (updateError) {
		await supabase.storage.from(documentsBucket).remove([storagePath])
		throw updateError
	}

	if (currentLogoPath && currentLogoPath !== storagePath) {
		try {
			await supabase.storage.from(documentsBucket).remove([currentLogoPath])
		} catch {
			// Le fichier précédent peut avoir déjà été nettoyé ou ne pas exister.
		}
	}

	return business
}

export async function removeBusinessLogo(businessId, currentLogoPath = null) {
	if (!businessId) throw new Error('Business non disponible pour cette opération.')
	if (currentLogoPath) {
		try {
			await supabase.storage.from(documentsBucket).remove([currentLogoPath])
		} catch {
			// L’ancien logo est ignoré si le fichier est déjà introuvable.
		}
	}
	const { data: business, error } = await supabase.from('businesses').update({ logo_url: null }).eq('id', businessId).select('*').single()
	if (error) throw error
	return business
}