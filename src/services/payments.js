import { supabase } from '../lib/supabase'

function requireBusiness(businessId) {
	if (!businessId) throw new Error('Business non disponible pour cette opération.')
}

export async function getPayments(invoiceId, businessId) {
	requireBusiness(businessId)
	const { data, error } = await supabase.from('payments').select('*').eq('invoice_id', invoiceId).eq('business_id', businessId).order('payment_date', { ascending: false })
	if (error) throw error
	return data ?? []
}

export async function getCashPayments(businessId) {
	requireBusiness(businessId)
	const { data, error } = await supabase.from('payments').select('*, clients(id, name, company_name), invoices(id, number), jobs(id, title)').eq('business_id', businessId).order('payment_date', { ascending: false })
	if (error) throw error
	return data ?? []
}

export async function createPayment(businessId, invoiceId, data) {
	requireBusiness(businessId)
	const invoice = await getInvoiceTotal(invoiceId, businessId)
	await ensureWithinBalance(invoice, 0, Number(data.amount))
	const { data: payment, error } = await supabase.from('payments').insert({ ...data, business_id: businessId, invoice_id: invoiceId, client_id: invoice.client_id, job_id: invoice.job_id || null }).select().single()
	if (error) throw error
	return payment
}

export async function updatePayment(paymentId, businessId, invoiceId, data) {
	requireBusiness(businessId)
	const invoice = await getInvoiceTotal(invoiceId, businessId)
	await ensureWithinBalance(invoice, paymentId, Number(data.amount))
	const { data: payment, error } = await supabase.from('payments').update(data).eq('id', paymentId).eq('invoice_id', invoiceId).eq('business_id', businessId).select().single()
	if (error) throw error
	return payment
}

export async function deletePayment(paymentId, businessId, invoiceId) {
	requireBusiness(businessId)
	const { error } = await supabase.from('payments').delete().eq('id', paymentId).eq('invoice_id', invoiceId).eq('business_id', businessId)
	if (error) throw error
}

async function getInvoiceTotal(invoiceId, businessId) {
	const { data, error } = await supabase.from('invoices').select('id, total, client_id, job_id, payments(id, amount)').eq('id', invoiceId).eq('business_id', businessId).maybeSingle()
	if (error) throw error
	if (!data) throw new Error('Facture introuvable.')
	return data
}

async function ensureWithinBalance(invoice, paymentId, amount) {
	if (!Number.isFinite(amount) || amount <= 0) throw new Error('Le montant du paiement doit être supérieur à zéro.')
	const paid = (invoice.payments ?? []).reduce((sum, payment) => sum + (payment.id === paymentId ? 0 : Number(payment.amount || 0)), 0)
	const remaining = Math.max(Number(invoice.total || 0) - paid, 0)
	if (amount > remaining) throw new Error(`Le paiement dépasse le solde restant de ${remaining.toLocaleString('fr-FR')} XAF.`)
}
