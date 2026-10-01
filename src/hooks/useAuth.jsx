import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { getCurrentBusiness, getCurrentUser, signOut as signOutUser } from '../services/auth'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [business, setBusiness] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true

    async function loadSession() {
      try {
        const currentUser = await getCurrentUser()
        if (!active) return
        setUser(currentUser)
        setBusiness(currentUser ? await getCurrentBusiness(currentUser) : null)
      } catch (sessionError) {
        if (active) setError(sessionError)
      } finally {
        if (active) setLoading(false)
      }
    }

    loadSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      if (!active) return
      const nextUser = session?.user ?? null
      setUser(nextUser)
      setError(null)
      if (!nextUser) {
        setBusiness(null)
        setLoading(false)
        return
      }
      setLoading(true)
      getCurrentBusiness(nextUser)
        .then((currentBusiness) => {
          if (active) setBusiness(currentBusiness)
        })
        .catch((businessError) => {
          if (active) setError(businessError)
        })
        .finally(() => {
          if (active) setLoading(false)
        })
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  async function signOut() {
    await signOutUser()
    setUser(null)
    setBusiness(null)
  }

  async function refreshBusiness() {
    const currentBusiness = await getCurrentBusiness(user)
    setBusiness(currentBusiness)
    return currentBusiness
  }

  return <AuthContext.Provider value={{ user, business, loading, error, signOut, refreshBusiness }}>
    {children}
  </AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth doit être utilisé dans AuthProvider.')
  return context
}
