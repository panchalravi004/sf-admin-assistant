import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Building2, CheckCircle2, AlertCircle,
  RefreshCw, Trash2, Clock3, Link2
} from 'lucide-react'
import clsx from 'clsx'
import { formatDistanceToNow } from 'date-fns'
import { useOrg } from '../context/OrgContext'

const toRelative = (dateValue) => {
  if (!dateValue) return 'Never'
  try {
    return formatDistanceToNow(new Date(dateValue), { addSuffix: true })
  } catch {
    return String(dateValue)
  }
}

export default function OrgDetail() {
  const { orgId } = useParams()
  const navigate = useNavigate()
  const { orgs, loading, refreshOrgs, deleteOrg } = useOrg()

  const [refreshing, setRefreshing] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const org = orgs.find(o => o.id === orgId)

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await refreshOrgs()
    } finally {
      setRefreshing(false)
    }
  }

  const handleDelete = async () => {
    if (!org) return
    if (!window.confirm(`Delete "${org.name}"? This will permanently remove it from your account.`)) return

    setDeleting(true)
    try {
      await deleteOrg(org.id)
      navigate('/orgs')
    } finally {
      setDeleting(false)
    }
  }

  if (!org) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertCircle className="w-12 h-12 text-slate-500" />
        <p className="text-slate-400">{loading ? 'Loading org details...' : 'Org not found'}</p>
        <button onClick={() => navigate('/orgs')} className="btn-secondary">Back to Orgs</button>
      </div>
    )
  }

  const statusLabel = org.status === 'connected' ? 'Connected' : org.status === 'disconnected' ? 'Disconnected' : 'Error'

  return (
    <div className="max-w-4xl mx-auto w-full space-y-6 animate-fade-in">
      <div>
        <button
          onClick={() => navigate('/orgs')}
          className="btn-ghost text-[13px] mb-3 -ml-2"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Orgs
        </button>

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className={clsx(
              'w-12 h-12 rounded-2xl flex items-center justify-center text-sm font-bold',
              org.environment === 'Production' ? 'bg-brand-900 text-brand-400' : 'bg-slate-800 text-slate-400'
            )}>
              {org.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-100">{org.name}</h1>
              <p className="text-[13px] text-slate-500 mt-0.5">{org.instance_url}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className={clsx('btn-secondary text-[13px]', refreshing && 'opacity-70')}
            >
              <RefreshCw className={clsx('w-3.5 h-3.5', refreshing && 'animate-spin')} />
              Refresh
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="btn-danger text-[13px]"
            >
              <Trash2 className="w-3.5 h-3.5" /> {deleting ? 'Deleting...' : 'Delete Org'}
            </button>
          </div>
        </div>
      </div>

      <div className="card flex items-center gap-6 flex-wrap">
        <div className="flex items-center gap-2">
          {org.status === 'connected'
            ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            : <AlertCircle className="w-4 h-4 text-red-400" />
          }
          <span className={clsx('text-sm font-medium', org.status === 'connected' ? 'text-emerald-400' : 'text-red-400')}>
            {statusLabel}
          </span>
        </div>

        <div className="border-l border-slate-700 pl-6">
          <p className="text-[11px] text-slate-500">Environment</p>
          <p className="text-sm font-medium text-slate-200 mt-0.5">{org.environment}</p>
        </div>

        <div className="border-l border-slate-700 pl-6">
          <p className="text-[11px] text-slate-500">Auth Flow</p>
          <p className="text-sm font-medium text-slate-200 mt-0.5">{org.auth_type || 'clientCredentials'}</p>
        </div>

        <div className="border-l border-slate-700 pl-6">
          <p className="text-[11px] text-slate-500">Connected</p>
          <p className="text-sm font-medium text-slate-200 mt-0.5">{toRelative(org.connected_at || org.created_at)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card space-y-3">
          <h3 className="section-title">Basic Details</h3>
          {[
            ['Org Name', org.name],
            ['Org Record ID', org.id],
            ['Salesforce Org ID', org.sf_org_id || 'Not available'],
            ['Status', statusLabel],
            ['Environment', org.environment],
            ['Auth Type', org.auth_type || 'clientCredentials'],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between text-[13px] py-1.5 border-b border-slate-800 last:border-0">
              <span className="text-slate-500">{label}</span>
              <span className="text-slate-200 font-medium truncate ml-4 text-right">{value}</span>
            </div>
          ))}
        </div>

        <div className="card space-y-3">
          <h3 className="section-title">Connection Info</h3>
          <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-800/70 border border-slate-700">
            <Link2 className="w-4 h-4 text-brand-400 mt-0.5" />
            <div>
              <p className="text-[12px] text-slate-500">Instance URL</p>
              <p className="text-[13px] text-slate-200 break-all">{org.instance_url}</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-800/70 border border-slate-700">
            <Clock3 className="w-4 h-4 text-brand-400 mt-0.5" />
            <div>
              <p className="text-[12px] text-slate-500">Created</p>
              <p className="text-[13px] text-slate-200">{toRelative(org.created_at)}</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-800/70 border border-slate-700">
            <Building2 className="w-4 h-4 text-brand-400 mt-0.5" />
            <div>
              <p className="text-[12px] text-slate-500">Connection State</p>
              <p className="text-[13px] text-slate-200">
                {org.isLive ? 'Live in server memory' : 'Stored only (not live)'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
