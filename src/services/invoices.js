import { supabase } from '../lib/supabase'

function requireBusiness(businessId) {
	if (!businessId) throw new Error('Business non disponible pour cette opération.')
}

export async function getInvoices(businessId) {
	requireBusiness(businessId)
	const { data, error } = await supabase.from('invoices').select('*, clients(id, name, company_name), jobs(id, title), payments(amount)').eq('business_id', businessId).order('issue_date', { ascending: false })
	if (error) throw error
	return (data ?? []).map(withPaymentTotals)
}

export async function getInvoice(invoiceId, businessId) {
	requireBusiness(businessId)
	const { data, error } = await supabase.from('invoices').select('*, clients(id, name, company_name), jobs(id, title), quotes(id, number), invoice_items(*), payments(*)').eq('id', invoiceId).eq('business_id', businessId).maybeSingle()
	if (error) throw error
	return data ? withPaymentTotals(data) : null
}

export async function createInvoice(businessId, data, items) {
	requireBusiness(businessId)
	const invoiceData = { ...data }
	delete invoiceData.items
	await validateRelations(businessId, invoiceData.client_id, invoiceData.job_id, invoiceData.quote_id)
	const { data: invoice, error } = await supabase.from('invoices').insert({ ...invoiceData, business_id: businessId }).select().single()
	if (error) throw error
	try {
		await replaceInvoiceItems(invoice.id, items)
		return await getInvoice(invoice.id, businessId)
	} catch (itemError) {
		await supabase.from('invoices').delete().eq('id', invoice.id).eq('business_id', businessId)
		throw itemError
	}
}

export async function updateInvoice(invoiceId, businessId, data, items) {
	requireBusiness(businessId)
	const invoiceData = { ...data }
	delete invoiceData.items
	await validateRelations(businessId, invoiceData.client_id, invoiceData.job_id, invoiceData.quote_id)
	const { error } = await supabase.from('invoices').update(invoiceData).eq('id', invoiceId).eq('business_id', businessId)
	if (error) throw error
	await replaceInvoiceItems(invoiceId, items)
	return getInvoice(invoiceId, businessId)
}

async function replaceInvoiceItems(invoiceId, items) {
	const { error: deleteError } = await supabase.from('invoice_items').delete().eq('invoice_id', invoiceId)
	if (deleteError) throw deleteError
	if (!items.length) return
	const { error } = await supabase.from('invoice_items').insert(items.map((item) => ({ ...item, invoice_id: invoiceId })))
	if (error) throw error
}

export async function deleteInvoice(invoiceId, businessId) {
	requireBusiness(businessId)
	const { error } = await supabase.from('invoices').delete().eq('id', invoiceId).eq('business_id', businessId)
	if (error) throw error
}

export async function getInvoiceClients(businessId) {
	requireBusiness(businessId)
	const { data, error } = await supabase.from('clients').select('id, name, company_name').eq('business_id', businessId).eq('status', 'active').order('name')
	if (error) throw error
	return data ?? []
}

export async function getInvoiceJobs(businessId) {
	requireBusiness(businessId)
	const { data, error } = await supabase.from('jobs').select('id, title, client_id').eq('business_id', businessId).order('title')
	if (error) throw error
	return data ?? []
}

export async function getInvoiceQuotes(businessId) {
	requireBusiness(businessId)
	const { data, error } = await supabase.from('quotes').select('id, number, client_id, job_id, subtotal, discount, tax, total, notes, quote_items(*)').eq('business_id', businessId).order('issue_date', { ascending: false })
	if (error) throw error
	return data ?? []
}

export function withPaymentTotals(invoice) {
	const paidAmount = (invoice.payments ?? []).reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
	return { ...invoice, paidAmount, remainingAmount: Math.max(Number(invoice.total || 0) - paidAmount, 0) }
}

async function validateRelations(businessId, clientId, jobId, quoteId) {
	if (!clientId) throw new Error('Un client est obligatoire pour une facture.')
	if (jobId) {
		const { data, error } = await supabase.from('jobs').select('id').eq('id', jobId).eq('business_id', businessId).eq('client_id', clientId).maybeSingle()
		if (error) throw error
		if (!data) throw new Error('Le chantier sélectionné ne correspond pas au client choisi.')
	}
	if (quoteId) {
		const { data, error } = await supabase.from('quotes').select('id').eq('id', quoteId).eq('business_id', businessId).eq('client_id', clientId).maybeSingle()
		if (error) throw error
		if (!data) throw new Error('Le devis sélectionné ne correspond pas au client choisi.')
	}
}
