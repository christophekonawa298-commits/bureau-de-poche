import { supabase } from '../lib/supabase'

export async function updateBusiness(businessId, data) {
	if (!businessId) throw new Error('Business non disponible pour cette opération.')
	const { data: business, error } = await supabase.from('businesses').update(data).eq('id', businessId).select('*').single()
	if (error) throw error
	return business
}