import { supabase } from '../lib/supabase'

function ensureBusinessId(businessId) {
	if (!businessId) throw new Error('Business non disponible pour cette opération.')
}

export async function getClients(businessId) {
	ensureBusinessId(businessId)
	const { data, error } = await supabase.from('clients').select('*').eq('business_id', businessId).order('name')
	if (error) throw error
	return data ?? []
}

export async function getClient(clientId, businessId) {
	ensureBusinessId(businessId)
	const { data, error } = await supabase.from('clients').select('*').eq('id', clientId).eq('business_id', businessId).maybeSingle()
	if (error) throw error
	return data
}

export async function createClient(businessId, data) {
	ensureBusinessId(businessId)
	const { data: client, error } = await supabase.from('clients').insert({ ...data, business_id: businessId }).select().single()
	if (error) throw error
	return client
}

export async function updateClient(clientId, businessId, data) {
	ensureBusinessId(businessId)
	const { data: client, error } = await supabase.from('clients').update(data).eq('id', clientId).eq('business_id', businessId).select().single()
	if (error) throw error
	return client
}

export async function deleteClient(clientId, businessId) {
	ensureBusinessId(businessId)
	const { error } = await supabase.from('clients').delete().eq('id', clientId).eq('business_id', businessId)
	if (error) throw error
}
