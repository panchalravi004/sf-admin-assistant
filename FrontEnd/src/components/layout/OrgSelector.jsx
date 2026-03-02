import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Building2, CheckCircle2, AlertCircle, Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { useOrg } from '../../context/OrgContext'

export default function OrgSelector() {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const navigate = useNavigate()
  const { orgs, selectedOrg, selectOrg } = useOrg()

  // Close on outside click
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSelect = (org) => {
    selectOrg(org)
    setOpen(false)
  }

  const envColor = (env) => env === 'Production' ? 'badge-red' : 'badge-blue'
  const statusIcon = (status) => status === 'connected'
    ? <CheckCircle2 className="w-3 h-3 text-emerald-400" />
    : <AlertCircle className="w-3 h-3 text-red-400" />

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={clsx(
          'flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm',
          'transition-colors duration-150 min-w-[200px] max-w-[260px]',
          open
            ? 'bg-slate-800 border-slate-600 text-slate-100'
            : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-600 hover:text-slate-100'
        )}
      >
        <Building2 className="w-3.5 h-3.5 text-brand-400 flex-shrink-0" />
        <span className="flex-1 text-left truncate text-[13px] font-medium">
          {selectedOrg?.name || 'Select Org'}
        </span>
        {selectedOrg && (
          <span className={clsx('badge text-[10px]', envColor(selectedOrg.environment))}>
            {selectedOrg.environment === 'Production' ? 'Prod' : 'SB'}
          </span>
        )}
        <ChevronDown className={clsx('w-3.5 h-3.5 text-slate-500 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1.5 w-[310px] bg-slate-900 border border-slate-700 rounded-xl shadow-panel z-50 animate-fade-in overflow-hidden">
          <div className="px-3 py-2 border-b border-slate-800">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Connected Orgs</p>
          </div>

          <div className="max-h-[300px] overflow-y-auto py-1">
            {orgs.length === 0 ? (
              <div className="px-3 py-4 text-center">
                <p className="text-[12px] text-slate-500">No orgs connected yet</p>
              </div>
            ) : orgs.map(org => (
              <button
                key={org.id}
                onClick={() => handleSelect(org)}
                className={clsx(
                  'w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors',
                  selectedOrg?.id === org.id
                    ? 'bg-slate-800 text-slate-100'
                    : 'text-slate-300 hover:bg-slate-800/60 hover:text-slate-100'
                )}
              >
                <div className={clsx(
                  'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold',
                  org.environment === 'Production' ? 'bg-brand-900 text-brand-400' : 'bg-slate-800 text-slate-400'
                )}>
                  {org.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium truncate">{org.name}</span>
                    {statusIcon(org.status)}
                  </div>
                  <p className="text-[11px] text-slate-500 truncate">{org.instance_url}</p>
                </div>
                <span className={clsx('badge text-[10px]', envColor(org.environment))}>
                  {org.environment === 'Production' ? 'Prod' : 'SB'}
                </span>
                {selectedOrg?.id === org.id && (
                  <CheckCircle2 className="w-4 h-4 text-brand-400 flex-shrink-0" />
                )}
              </button>
            ))}
          </div>

          <div className="border-t border-slate-800 p-2">
            <button
              onClick={() => { navigate('/orgs'); setOpen(false) }}
              className="btn-ghost w-full justify-center text-[13px] text-slate-400 py-2"
            >
              <Plus className="w-3.5 h-3.5" />
              Connect New Org
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
