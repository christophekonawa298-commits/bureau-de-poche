import { supabase } from '../lib/supabase'

function requireBusiness(businessId) {
	if (!businessId) throw new Error('Business non disponible pour cette opération.')
}

async function validateRelations(businessId, clientId, jobId) {
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
}

export async function getAppointments(businessId, options = {}) {
	requireBusiness(businessId)
	let query = supabase.from('appointments').select('*, clients(id, name, company_name), jobs(id, title, client_id)').eq('business_id', businessId).order('start_at', { ascending: true })
	if (options.upcomingOnly) {
		query = query.gte('start_at', options.from ?? new Date().toISOString()).neq('status', 'cancelled').limit(Math.max(1, Math.min(options.limit ?? 5, 10)))
	}
	const { data, error } = await query
	if (error) throw error
	return data ?? []
}

export async function createAppointment(businessId, data) {
	requireBusiness(businessId)
	await validateRelations(businessId, data.client_id, data.job_id)
	const { data: appointment, error } = await supabase.from('appointments').insert({ ...data, business_id: businessId }).select('*, clients(id, name, company_name), jobs(id, title, client_id)').single()
	if (error) throw error
	return appointment
}

export async function updateAppointment(appointmentId, businessId, data) {
	requireBusiness(businessId)
	await validateRelations(businessId, data.client_id, data.job_id)
	const { data: appointment, error } = await supabase.from('appointments').update(data).eq('id', appointmentId).eq('business_id', businessId).select('*, clients(id, name, company_name), jobs(id, title, client_id)').single()
	if (error) throw error
	return appointment
}

export async function deleteAppointment(appointmentId, businessId) {
	requireBusiness(businessId)
	const { error } = await supabase.from('appointments').delete().eq('id', appointmentId).eq('business_id', businessId)
	if (error) throw error
}
