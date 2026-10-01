import { supabase } from '../lib/supabase'

function requireBusiness(businessId) {
	if (!businessId) throw new Error('Business non disponible pour cette opération.')
}

export async function getExpenses(businessId) {
	requireBusiness(businessId)
	const { data, error } = await supabase.from('expenses').select('*, jobs(id, title)').eq('business_id', businessId).order('expense_date', { ascending: false })
	if (error) throw error
	return data ?? []
}

export async function getExpense(expenseId, businessId) {
	requireBusiness(businessId)
	const { data, error } = await supabase.from('expenses').select('*, jobs(id, title)').eq('id', expenseId).eq('business_id', businessId).maybeSingle()
	if (error) throw error
	return data
}

export async function createExpense(businessId, data) {
	requireBusiness(businessId)
	const { data: expense, error } = await supabase.from('expenses').insert({ ...data, business_id: businessId }).select('*, jobs(id, title)').single()
	if (error) throw error
	return expense
}

export async function updateExpense(expenseId, businessId, data) {
	requireBusiness(businessId)
	const { data: expense, error } = await supabase.from('expenses').update(data).eq('id', expenseId).eq('business_id', businessId).select('*, jobs(id, title)').single()
	if (error) throw error
	return expense
}

export async function deleteExpense(expenseId, businessId) {
	requireBusiness(businessId)
	const { error } = await supabase.from('expenses').delete().eq('id', expenseId).eq('business_id', businessId)
	if (error) throw error
}

export async function getExpenseJobs(businessId) {
	requireBusiness(businessId)
	const { data, error } = await supabase.from('jobs').select('id, title').eq('business_id', businessId).order('title')
	if (error) throw error
	return data ?? []
}
