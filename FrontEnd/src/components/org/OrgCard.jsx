import { useState } from 'react'
import {
  CheckCircle2, AlertCircle, ExternalLink, MoreVertical,
  Unplug, Eye, Loader2
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { formatDistanceToNow } from 'date-fns'
import { useOrg } from '../../context/OrgContext'

export default function OrgCard({ org }) {
  const [menuOpen, setMenuOpen]         = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const navigate = useNavigate()
  const { disconnectOrg } = useOrg()

  const isConnected = org.status === 'connected'

  const handleOpen = () => navigate(`/orgs/${org.id}`)

  const handleDisconnect = async (e) => {
    e.stopPropagation()
    if (!window.confirm(`Disconnect "${org.name}"? You can reconnect it later.`)) return
    setMenuOpen(false)
    setDisconnecting(true)
    try {
      await disconnectOrg(org.id)
    } finally {
      setDisconnecting(false)
    }
  }

  const connectedSince = org.created_at
    ? formatDistanceToNow(new Date(org.created_at), { addSuffix: true })
    : null

  return (
    <div
      className={clsx(
        'card-hover group relative flex flex-col gap-4',
        !isConnected && 'border-red-900/40 hover:border-red-800/60'
      )}
      onClick={handleOpen}
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={clsx(
            'w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0',
            org.environment === 'Production' ? 'bg-brand-900 text-brand-400' : 'bg-slate-800 text-slate-400'
          )}>
            {org.name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-100 leading-tight">{org.name}</h3>
            <p className="text-[11px] text-slate-500 mt-0.5 truncate max-w-[180px]">{org.instance_url}</p>
          </div>
        </div>

        {/* Actions menu */}
        <div className="relative" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => setMenuOpen(o => !o)}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800
              opacity-0 group-hover:opacity-100 transition-all"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
          {menuOpen && (
            <div className="absolute top-full right-0 mt-1 w-44 bg-slate-900 border border-slate-700
              rounded-xl shadow-panel z-20 animate-fade-in overflow-hidden">
              {[
                { icon: Eye,          label: 'View Details', action: handleOpen },
                { icon: ExternalLink, label: 'Open in SF',   action: () => window.open(org.instance_url, '_blank') },
              ].map(({ icon: Icon, label, action }) => (
                <button
                  key={label}
                  onClick={(e) => { e.stopPropagation(); action(e); setMenuOpen(false) }}
                  className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-slate-300
                    hover:bg-slate-800 hover:text-slate-100 transition-colors"
                >
                  <Icon className="w-3.5 h-3.5 text-slate-500" /> {label}
                </button>
              ))}
              <div className="border-t border-slate-800">
                <button
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-red-400
                    hover:bg-red-900/20 hover:text-red-300 transition-colors disabled:opacity-50"
                >
                  {disconnecting
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <Unplug className="w-3.5 h-3.5" />
                  } Disconnect
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Badges */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className={clsx('badge', org.environment === 'Production' ? 'badge-red' : 'badge-blue')}>
          {org.environment}
        </span>
        <span className={clsx('badge', isConnected ? 'badge-green' : 'badge-red')}>
          {isConnected
            ? <><CheckCircle2 className="w-2.5 h-2.5" /> Connected</>
            : <><AlertCircle className="w-2.5 h-2.5" /> Error</>
          }
        </span>
      </div>

      {/* Footer */}
      {connectedSince && (
        <div className="pt-1 border-t border-slate-800">
          <p className="text-[11px] text-slate-500">Connected {connectedSince}</p>
        </div>
      )}
    </div>
  )
}
