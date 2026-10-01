import { supabase } from '../lib/supabase'

function requireBusiness(businessId) {
	if (!businessId) throw new Error('Business non disponible pour cette opération.')
}

export async function getJobs(businessId) {
	requireBusiness(businessId)
	const { data, error } = await supabase.from('jobs').select('*, clients(id, name, company_name)').eq('business_id', businessId).order('created_at', { ascending: false })
	if (error) throw error
	return data ?? []
}

export async function getJob(jobId, businessId) {
	requireBusiness(businessId)
	const { data, error } = await supabase.from('jobs').select('*, clients(id, name, company_name)').eq('id', jobId).eq('business_id', businessId).maybeSingle()
	if (error) throw error
	return data
}

export async function createJob(businessId, data) {
	requireBusiness(businessId)
	const { data: job, error } = await supabase.from('jobs').insert({ ...data, business_id: businessId }).select('*, clients(id, name, company_name)').single()
	if (error) throw error
	return job
}

export async function updateJob(jobId, businessId, data) {
	requireBusiness(businessId)
	const { data: job, error } = await supabase.from('jobs').update(data).eq('id', jobId).eq('business_id', businessId).select('*, clients(id, name, company_name)').single()
	if (error) throw error
	return job
}

export async function deleteJob(jobId, businessId) {
	requireBusiness(businessId)
	const { error } = await supabase.from('jobs').delete().eq('id', jobId).eq('business_id', businessId)
	if (error) throw error
}
