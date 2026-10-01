import { supabase } from '../lib/supabase'

function requireBusiness(businessId) {
	if (!businessId) throw new Error('Business non disponible pour cette opération.')
}

export async function getQuotes(businessId) {
	requireBusiness(businessId)
	const { data, error } = await supabase.from('quotes').select('*, clients(id, name, company_name), jobs(id, title)').eq('business_id', businessId).order('issue_date', { ascending: false })
	if (error) throw error
	return data ?? []
}

export async function getQuote(quoteId, businessId) {
	requireBusiness(businessId)
	const { data, error } = await supabase.from('quotes').select('*, clients(id, name, company_name), jobs(id, title), quote_items(*)').eq('id', quoteId).eq('business_id', businessId).maybeSingle()
	if (error) throw error
	return data
}

export async function createQuote(businessId, data, items) {
	requireBusiness(businessId)
	const quoteData = { ...data }
	delete quoteData.items
	await validateQuoteRelations(businessId, quoteData.client_id, quoteData.job_id)
	const { data: quote, error } = await supabase.from('quotes').insert({ ...quoteData, business_id: businessId }).select().single()
	if (error) throw error
	try {
		if (items.length) await replaceQuoteItems(quote.id, items)
		return await getQuote(quote.id, businessId)
	} catch (itemError) {
		await supabase.from('quotes').delete().eq('id', quote.id).eq('business_id', businessId)
		throw itemError
	}
}

export async function updateQuote(quoteId, businessId, data, items) {
	requireBusiness(businessId)
	const quoteData = { ...data }
	delete quoteData.items
	await validateQuoteRelations(businessId, quoteData.client_id, quoteData.job_id)
	const { error } = await supabase.from('quotes').update(quoteData).eq('id', quoteId).eq('business_id', businessId)
	if (error) throw error
	await replaceQuoteItems(quoteId, items)
	return getQuote(quoteId, businessId)
}

async function replaceQuoteItems(quoteId, items) {
	const { error: deleteError } = await supabase.from('quote_items').delete().eq('quote_id', quoteId)
	if (deleteError) throw deleteError
	if (!items.length) return
	const { error } = await supabase.from('quote_items').insert(items.map((item) => ({ ...item, quote_id: quoteId })))
	if (error) throw error
}

export async function deleteQuote(quoteId, businessId) {
	requireBusiness(businessId)
	const { error } = await supabase.from('quotes').delete().eq('id', quoteId).eq('business_id', businessId)
	if (error) throw error
}

export async function getQuoteClients(businessId) {
	requireBusiness(businessId)
	const { data, error } = await supabase.from('clients').select('id, name, company_name').eq('business_id', businessId).eq('status', 'active').order('name')
	if (error) throw error
	return data ?? []
}

export async function getQuoteJobs(businessId) {
	requireBusiness(businessId)
	const { data, error } = await supabase.from('jobs').select('id, title, client_id, status').eq('business_id', businessId).order('title')
	if (error) throw error
	return data ?? []
}

async function validateQuoteRelations(businessId, clientId, jobId) {
	if (!clientId) throw new Error('Un client est obligatoire pour un devis.')
	if (!jobId) return
	const { data, error } = await supabase.from('jobs').select('id').eq('id', jobId).eq('business_id', businessId).eq('client_id', clientId).maybeSingle()
	if (error) throw error
	if (!data) throw new Error('Le chantier sélectionné ne correspond pas au client choisi.')
}
