import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { OrgService } from '../services/apiServices'
import { useAuth } from './AuthContext'

const OrgContext = createContext(null)

export function OrgProvider({ children }) {
  const { isAuthenticated } = useAuth()
  const [orgs, setOrgs]               = useState([])
  const [selectedOrg, setSelectedOrg] = useState(null)
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState(null)

  const refreshOrgs = useCallback(async () => {
    if (!isAuthenticated) return
    setLoading(true)
    setError(null)
    try {
      const raw  = await OrgService.getOrgs()
      const data = Array.isArray(raw) ? raw : []
      setOrgs(data)
      // Auto-select first connected org if none selected
      setSelectedOrg(prev => {
        if (prev) {
          // keep selection, but refresh the object in case status changed
          return data.find(o => o.id === prev.id) || prev
        }
        return data.find(o => o.status === 'connected') || data[0] || null
      })
    } catch (err) {
      setError(err?.message || 'Failed to load orgs')
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated])

  // Load orgs when authenticated
  useEffect(() => {
    if (isAuthenticated) refreshOrgs()
    else { setOrgs([]); setSelectedOrg(null) }
  }, [isAuthenticated, refreshOrgs])

  const connectOrg = useCallback(async (formData) => {
    const org = await OrgService.connectOrg(formData)
    await refreshOrgs()
    return org
  }, [refreshOrgs])

  const disconnectOrg = useCallback(async (orgId) => {
    await OrgService.disconnectOrg(orgId)
    await refreshOrgs()
    setSelectedOrg(prev => (prev?.id === orgId ? null : prev))
  }, [refreshOrgs])

  const selectOrg = useCallback((org) => {
    setSelectedOrg(org)
  }, [])

  return (
    <OrgContext.Provider value={{ orgs, selectedOrg, loading, error, selectOrg, connectOrg, disconnectOrg, refreshOrgs }}>
      {children}
    </OrgContext.Provider>
  )
}

export function useOrg() {
  const ctx = useContext(OrgContext)
  if (!ctx) throw new Error('useOrg must be used within OrgProvider')
  return ctx
}
