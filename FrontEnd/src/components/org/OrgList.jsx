import { useState } from 'react'
import {
  CheckCircle2, AlertCircle, Trash2,
  MoreVertical, Eye, Loader2
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { formatDistanceToNow } from 'date-fns'
import { useOrg } from '../../context/OrgContext'

export default function OrgList({ orgs }) {
  const navigate = useNavigate()
  const [openMenu, setOpenMenu]           = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const { deleteOrg } = useOrg()

  const handleDelete = async (org) => {
    if (!window.confirm(`Delete "${org.name}"? This will permanently remove it from your account.`)) return
    setOpenMenu(null)
    setDeletingId(org.id)
    try {
      await deleteOrg(org.id)
    } finally {
      setDeletingId(null)
    }
  }

  if(orgs && orgs.length > 0) {
    return (
      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-900/50">
              <th className="table-header">Org Name</th>
              <th className="table-header hidden sm:table-cell">Environment</th>
              <th className="table-header">Status</th>
              <th className="table-header hidden lg:table-cell">Connected</th>
              <th className="table-header text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {orgs.map(org => (
              <tr key={org.id} className="table-row">
                <td className="table-cell">
                  <div className="flex items-center gap-3">
                    <div className={clsx(
                      'w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0',
                      org.environment === 'Production' ? 'bg-brand-900 text-brand-400' : 'bg-slate-800 text-slate-400'
                    )}>
                      {org.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-200">{org.name}</p>
                      <p className="text-[11px] text-slate-500 hidden sm:block truncate max-w-[200px]">{org.instance_url}</p>
                    </div>
                  </div>
                </td>
                <td className="table-cell hidden sm:table-cell">
                  <span className={clsx('badge', org.environment === 'Production' ? 'badge-red' : 'badge-blue')}>
                    {org.environment}
                  </span>
                </td>
                <td className="table-cell">
                  <span className={clsx('badge', org.status === 'connected' ? 'badge-green' : 'badge-red')}>
                    {org.status === 'connected'
                      ? <><CheckCircle2 className="w-2.5 h-2.5" /> Connected</>
                      : <><AlertCircle className="w-2.5 h-2.5" /> Error</>
                    }
                  </span>
                </td>
                <td className="table-cell hidden lg:table-cell text-slate-400 text-[13px]">
                  {org.created_at ? formatDistanceToNow(new Date(org.created_at), { addSuffix: true }) : 'just now'}
                </td>
                <td className="table-cell text-right">
                  <div className="relative inline-block">
                    <button
                      onClick={() => setOpenMenu(openMenu === org.id ? null : org.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    {openMenu === org.id && (
                      <div className="absolute top-full right-0 mt-1 w-44 bg-slate-900 border border-slate-700
                        rounded-xl shadow-panel z-20 animate-fade-in overflow-hidden">
                        <button
                          onClick={() => { navigate(`/orgs/${org.id}`); setOpenMenu(null) }}
                          className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-slate-300
                            hover:bg-slate-800 hover:text-slate-100 transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5 text-slate-500" /> View Details
                        </button>
                        <div className="border-t border-slate-800">
                          <button
                            onClick={() => handleDelete(org)}
                            disabled={deletingId === org.id}
                            className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-red-400
                              hover:bg-red-900/20 transition-colors disabled:opacity-50"
                          >
                            {deletingId === org.id
                              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              : <Trash2 className="w-3.5 h-3.5" />
                            } Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

}
