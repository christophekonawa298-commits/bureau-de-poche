import { supabase } from '../lib/supabase'

export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser()
  if (error && error.name !== 'AuthSessionMissingError') throw error
  return data.user ?? null
}

export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) throw error
  return data
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function getCurrentBusiness(user = null) {
  const currentUser = user ?? await getCurrentUser()
  if (!currentUser) return null

  const { data, error } = await supabase
    .from('businesses')
    .select('*')
    .eq('owner_id', currentUser.id)
    .maybeSingle()

  if (error) throw error
  return data
}
