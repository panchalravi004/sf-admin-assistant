import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Building2, CheckCircle2, AlertCircle, ExternalLink,
  RefreshCw, Unplug, Users, Box, Shield, Hash
} from 'lucide-react'
import clsx from 'clsx'
import { formatDistanceToNow } from 'date-fns'
import { STATIC_ORGS } from '../data/staticData'

export default function OrgDetail() {
  const { orgId } = useParams()
  const navigate = useNavigate()
  const [refreshing, setRefreshing] = useState(false)
  const orgs = STATIC_ORGS
  const refreshOrg = async () => {}
  const disconnectOrg = () => {}

  const org = orgs.find(o => o.id === orgId)

  if (!org) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertCircle className="w-12 h-12 text-slate-500" />
        <p className="text-slate-400">Org not found</p>
        <button onClick={() => navigate('/orgs')} className="btn-secondary">Back to Orgs</button>
      </div>
    )
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await refreshOrg(org.id)
    setTimeout(() => setRefreshing(false), 800)
  }

  const handleDisconnect = () => {
    disconnectOrg(org.id)
    navigate('/orgs')
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
      {/* Back + Header */}
      <div>
        <button
          onClick={() => navigate('/orgs')}
          className="btn-ghost text-[13px] mb-3 -ml-2"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Orgs
        </button>
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className={clsx(
              'w-12 h-12 rounded-2xl flex items-center justify-center text-base font-bold',
              org.environment === 'Production' ? 'bg-brand-900 text-brand-400' : 'bg-slate-800 text-slate-400'
            )}>
              {org.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-100">{org.name}</h1>
              <p className="text-[13px] text-slate-500 mt-0.5">{org.instanceUrl}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              className={clsx('btn-secondary text-[13px]', refreshing && 'opacity-70')}
            >
              <RefreshCw className={clsx('w-3.5 h-3.5', refreshing && 'animate-spin')} />
              Refresh
            </button>
            <button
              onClick={() => window.open(org.instanceUrl, '_blank')}
              className="btn-secondary text-[13px]"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Open in SF
            </button>
            <button onClick={handleDisconnect} className="btn-danger text-[13px]">
              <Unplug className="w-3.5 h-3.5" /> Disconnect
            </button>
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div className="card flex items-center gap-6 flex-wrap">
        <div className="flex items-center gap-2">
          {org.status === 'connected'
            ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            : <AlertCircle className="w-4 h-4 text-red-400" />
          }
          <span className={clsx('text-sm font-medium', org.status === 'connected' ? 'text-emerald-400' : 'text-red-400')}>
            {org.status === 'connected' ? 'Connected' : 'Connection Error'}
          </span>
        </div>
        {[
          { label: 'Environment', value: org.environment },
          { label: 'Type', value: org.orgType },
          { label: 'API Version', value: `v${org.apiVersion}` },
          { label: 'Last Sync', value: org.lastSync ? formatDistanceToNow(new Date(org.lastSync), { addSuffix: true }) : 'Never' },
        ].map(({ label, value }) => (
          <div key={label} className="border-l border-slate-700 pl-6">
            <p className="text-[11px] text-slate-500">{label}</p>
            <p className="text-sm font-medium text-slate-200 mt-0.5">{value}</p>
          </div>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: Users, label: 'Users', value: org.usersCount?.toLocaleString(), color: 'bg-brand-900/40 text-brand-400' },
          { icon: Box, label: 'Objects', value: org.objectsCount?.toLocaleString(), color: 'bg-purple-900/40 text-purple-400' },
          { icon: Shield, label: 'Profiles', value: '12', color: 'bg-yellow-900/40 text-yellow-400' },
          { icon: Hash, label: 'Custom Fields', value: '284', color: 'bg-emerald-900/40 text-emerald-400' },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="card flex items-center gap-3">
            <div className={clsx('w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0', color)}>
              <Icon className="w-4.5 h-4.5" />
            </div>
            <div>
              <p className="text-xl font-bold text-slate-100">{value}</p>
              <p className="text-[12px] text-slate-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="card space-y-3">
              <h3 className="section-title">Org Details</h3>
              {[
                ['Org ID', org.id],
                ['Connected User', org.connectedUser],
                ['Instance URL', org.instanceUrl],
                ['API Version', org.apiVersion],
                ['Storage Used', org.storageUsed],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between text-[13px] py-1.5 border-b border-slate-800 last:border-0">
                  <span className="text-slate-500">{k}</span>
                  <span className="text-slate-200 font-medium truncate ml-4 text-right">{v}</span>
                </div>
              ))}
            </div>
            <div className="card space-y-3">
              <h3 className="section-title">Metadata Summary</h3>
              {[
                ['Standard Objects', '20'],
                ['Custom Objects', '32'],
                ['Apex Classes', '47'],
                ['Active Flows', '12'],
                ['Permission Sets', '8'],
                ['Installed Packages', '5'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between text-[13px] py-1.5 border-b border-slate-800 last:border-0">
                  <span className="text-slate-500">{k}</span>
                  <span className="text-slate-200 font-bold">{v}</span>
                </div>
              ))}
            </div>
        </div>
    </div>

  )
}
