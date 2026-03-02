import {
  Building2, Zap, Bot, AlertCircle,
  TrendingUp, ArrowRight, Activity, Shield, Plus
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import OrgCard from '../components/org/OrgCard'
import { STATIC_ORGS, STATIC_LOGS, STATIC_USER } from '../data/staticData'

function StatCard({ icon: Icon, label, value, sub, color = 'brand' }) {
  const colorMap = {
    brand:   'bg-brand-900/40 text-brand-400',
    emerald: 'bg-emerald-900/40 text-emerald-400',
    yellow:  'bg-yellow-900/40 text-yellow-400',
    red:     'bg-red-900/40 text-red-400',
  }
  return (
    <div className="stat-card">
      <div className="flex items-center justify-between">
        <div className={clsx('w-9 h-9 rounded-xl flex items-center justify-center', colorMap[color])}>
          <Icon className="w-4.5 h-4.5" />
        </div>
        <TrendingUp className="w-3.5 h-3.5 text-slate-600" />
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-100">{value}</p>
        <p className="text-[13px] text-slate-400 mt-0.5">{label}</p>
        {sub && <p className="text-[11px] text-slate-600 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

const ACTIVITY_FEED = [
  { id: 1, type: 'permission', icon: Shield, color: 'text-brand-400 bg-brand-900/30', text: 'Revoked Modify All Data from Sales Rep profile', time: '5 min ago', org: 'Acme Production' },
  { id: 2, type: 'ai', icon: Bot, color: 'text-purple-400 bg-purple-900/30', text: 'AI analysis completed — 23 unused fields detected', time: '1 hr ago', org: 'Acme Production' },
  { id: 3, type: 'org', icon: AlertCircle, color: 'text-red-400 bg-red-900/30', text: 'Connection error detected', time: '2 hrs ago', org: 'GlobalTech Production' },
  { id: 4, type: 'permission', icon: Shield, color: 'text-emerald-400 bg-emerald-900/30', text: 'Created Data_Analyst permission set', time: '3 hrs ago', org: 'Acme Sandbox' },
  { id: 5, type: 'ai', icon: Zap, color: 'text-yellow-400 bg-yellow-900/30', text: 'Flow migration completed for Opportunity Update', time: 'Yesterday', org: 'Acme Production' },
]

export default function Dashboard() {
  const navigate = useNavigate()
  const orgs = STATIC_ORGS
  const logs = STATIC_LOGS
  const user = STATIC_USER

  const connectedOrgs = orgs.filter(o => o.status === 'connected').length
  const errorOrgs = orgs.filter(o => o.status === 'error').length
  const todayLogs = logs.filter(l => {
    const logDate = new Date(l.timestamp)
    const today = new Date()
    return logDate.toDateString() === today.toDateString()
  }).length

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Dashboard</h1>
          <p className="text-[13px] text-slate-500 mt-0.5">
            Welcome back, {user?.name?.split(' ')[0]}. Here's your org overview.
          </p>
        </div>
        <button onClick={() => navigate('/orgs')} className="btn-primary text-[13px]">
          <Plus className="w-3.5 h-3.5" /> Connect Org
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Building2} label="Connected Orgs" value={connectedOrgs} sub={errorOrgs > 0 ? `${errorOrgs} with errors` : 'All healthy'} color="brand" />
        <StatCard icon={Activity} label="Actions Today" value={todayLogs} sub="Metadata operations" color="emerald" />
        <StatCard icon={Bot} label="AI Sessions" value="3" sub="Active this week" color="yellow" />
        <StatCard icon={AlertCircle} label="Critical Issues" value={0} sub="Require attention" color="emerald" />
      </div>

      {/* Main content: Org cards + Activity feed */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Org cards */}
        <div className="xl:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title">Connected Orgs</h2>
            <button
              onClick={() => navigate('/orgs')}
              className="btn-ghost text-[13px]"
            >
              View all <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {orgs.slice(0, 4).map(org => (
              <OrgCard key={org.id} org={org} />
            ))}
          </div>
        </div>

        {/* Activity feed */}
        <div className="xl:col-span-1">
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title">Recent Activity</h2>
            <button
              onClick={() => navigate('/logs')}
              className="btn-ghost text-[13px]"
            >
              All logs <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="card p-0 overflow-hidden">
            <div className="divide-y divide-slate-800">
              {ACTIVITY_FEED.map((item, idx) => {
                const Icon = item.icon
                return (
                  <div key={item.id} className="flex items-start gap-3 px-4 py-3.5 hover:bg-slate-800/30 transition-colors">
                    <div className={clsx('w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5', item.color)}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-slate-300 leading-snug">{item.text}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[11px] text-slate-500">{item.org}</span>
                        <span className="text-[11px] text-slate-600">·</span>
                        <span className="text-[11px] text-slate-500">{item.time}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}
