import { useMemo, useState } from 'react'
import { Plus, LayoutGrid, List, Search, Building2, AlertCircle, CheckCircle2 } from 'lucide-react'
import clsx from 'clsx'
import OrgCard from '../components/org/OrgCard'
import OrgList from '../components/org/OrgList'
import { useOrg } from '../context/OrgContext'

const AUTH_FLOW_OPTIONS = [
  {
    value: 'clientCredentials',
    label: 'Client Credentials',
    description: 'Connected App machine-to-machine flow using client ID and client secret.',
  },
  {
    value: 'usernamePassword',
    label: 'Username + Password',
    description: 'SOAP login using Salesforce username and password (append security token if required).',
  },
  {
    value: 'sessionId',
    label: 'Session ID',
    description: 'Connect with an existing session ID and Salesforce instance URL.',
  },
]

const AUTH_FLOW_FIELDS = {
  clientCredentials: [
    { key: 'instanceUrl', label: 'Instance URL *', placeholder: 'https://yourorg.my.salesforce.com' },
    { key: 'clientId', label: 'Client ID *', placeholder: 'Connected App Consumer Key' },
    { key: 'clientSecret', label: 'Client Secret *', placeholder: 'Connected App Consumer Secret', secret: true },
  ],
  usernamePassword: [
    { key: 'username', label: 'Username *', placeholder: 'admin@example.com' },
    { key: 'password', label: 'Password *', placeholder: 'Password (+ security token if required)', secret: true },
  ],
  sessionId: [
    { key: 'instanceUrl', label: 'Instance URL *', placeholder: 'https://yourorg.my.salesforce.com' },
    { key: 'sessionId', label: 'Session ID *', placeholder: '00D...!AQo...', secret: true },
  ],
}

const REQUIRED_FIELDS_BY_FLOW = {
  clientCredentials: ['instanceUrl', 'clientId', 'clientSecret'],
  usernamePassword: ['username', 'password'],
  sessionId: ['sessionId', 'instanceUrl'],
}

const DEFAULT_FORM = {
  name: '',
  environment: 'Sandbox',
  authType: 'clientCredentials',
  instanceUrl: '',
  clientId: '',
  clientSecret: '',
  username: '',
  password: '',
  sessionId: '',
}

const hasValue = (value) => {
  if (typeof value === 'string') return value.trim().length > 0
  return value !== undefined && value !== null
}

const buildAuthConfig = (form) => {
  const keys = REQUIRED_FIELDS_BY_FLOW[form.authType] || []

  const config = {}
  for (const key of keys) {
    if (hasValue(form[key])) {
      config[key] = form[key]
    }
  }

  return config
}

function ConnectOrgModal({ onClose, onConnect }) {
  const [form, setForm] = useState(DEFAULT_FORM)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const activeFields = AUTH_FLOW_FIELDS[form.authType] || []
  const activeFlow = AUTH_FLOW_OPTIONS.find(option => option.value === form.authType)

  const fieldLabelMap = useMemo(() => {
    const map = { name: 'Org Name' }
    Object.values(AUTH_FLOW_FIELDS).flat().forEach(({ key, label }) => {
      if (!map[key]) map[key] = label.replace(' *', '')
    })
    return map
  }, [])

  const handleConnect = async () => {
    const missing = []

    if (!hasValue(form.name)) {
      missing.push('name')
    }

    for (const key of (REQUIRED_FIELDS_BY_FLOW[form.authType] || [])) {
      if (!hasValue(form[key])) missing.push(key)
    }

    if (missing.length) {
      const fields = missing.map(key => fieldLabelMap[key] || key)
      setError(`Please fill in required fields: ${fields.join(', ')}`)
      return
    }

    setError('')
    setLoading(true)

    const payload = {
      name: form.name.trim(),
      environment: form.environment,
      authType: form.authType,
      authConfig: buildAuthConfig(form),
    }

    try {
      await onConnect(payload)
      onClose()
    } catch (err) {
      setError(err?.message || 'Failed to connect org. Check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-xl shadow-panel max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-brand-900 flex items-center justify-center">
              <Building2 className="w-4 h-4 text-brand-400" />
            </div>
            <h2 className="text-base font-semibold text-slate-100">Connect Salesforce Org</h2>
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5">✕</button>
        </div>
        <div className="px-6 py-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-red-900/20 border border-red-800/50">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <p className="text-[12px] text-red-300">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-[12px] font-medium text-slate-400 mb-1.5">Org Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="e.g., Acme Production"
              className="input text-[13px]"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-medium text-slate-400 mb-1.5">Auth Flow *</label>
              <select
                value={form.authType}
                onChange={e => {
                  set('authType', e.target.value)
                  setError('')
                }}
                className="select text-[13px]"
              >
                {AUTH_FLOW_OPTIONS.map(flow => (
                  <option key={flow.value} value={flow.value}>{flow.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[12px] font-medium text-slate-400 mb-1.5">Environment</label>
              <select
                value={form.environment}
                onChange={e => set('environment', e.target.value)}
                className="select text-[13px]"
              >
                <option value="Sandbox">Sandbox</option>
                <option value="Production">Production</option>
              </select>
            </div>
          </div>

          <div className="p-3 bg-brand-900/20 border border-brand-900/40 rounded-xl">
            <p className="text-[12px] text-brand-300">
              {activeFlow?.description || 'Select an auth flow and provide required credentials.'}
            </p>
          </div>

          {activeFields.map(({ key, label, placeholder, secret, multiline }) => (
            <div key={key}>
              <label className="block text-[12px] font-medium text-slate-400 mb-1.5">{label}</label>
              {multiline ? (
                <textarea
                  value={form[key]}
                  onChange={e => set(key, e.target.value)}
                  placeholder={placeholder}
                  className="input text-[13px] min-h-[104px] resize-y"
                />
              ) : (
                <input
                  type={secret ? 'password' : 'text'}
                  value={form[key]}
                  onChange={e => set(key, e.target.value)}
                  placeholder={placeholder}
                  className="input text-[13px]"
                />
              )}
            </div>
          ))}

        </div>
        <div className="flex gap-3 px-6 py-4 border-t border-slate-800">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleConnect} disabled={loading} className="btn-primary flex-1">
            {loading ? 'Connecting...' : 'Connect Org'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Orgs() {
  const { orgs, loading, error, connectOrg, selectOrg } = useOrg()
  const [viewMode, setViewMode] = useState('grid')
  const [search, setSearch]     = useState('')
  const [showModal, setShowModal] = useState(false)

  const filtered = orgs.filter(o =>
    o.name.toLowerCase().includes(search.toLowerCase()) ||
    o.instance_url?.toLowerCase().includes(search.toLowerCase())
  )

  const connectedCount = orgs.filter(o => o.status === 'connected').length
  const errorCount     = orgs.filter(o => o.status === 'error').length

  return (
    <div className="max-w-4xl mx-auto w-full space-y-6 animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Org Management</h1>
          <p className="text-[13px] text-slate-500 mt-0.5">
            {loading ? 'Loading…'
              : `${connectedCount} connected · ${errorCount > 0 ? `${errorCount} with errors · ` : ''}${orgs.length} total orgs`}
          </p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary text-[13px]">
          <Plus className="w-3.5 h-3.5" /> Connect Org
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-red-900/20 border border-red-800/50">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <p className="text-[13px] text-red-300">{error}</p>
        </div>
      )}

      {/* Status summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Orgs',  value: orgs.length,    icon: Building2,    color: 'badge-blue' },
          { label: 'Connected',   value: connectedCount, icon: CheckCircle2, color: 'badge-green' },
          { label: 'Errors',      value: errorCount,     icon: AlertCircle,  color: errorCount > 0 ? 'badge-red' : 'badge-gray' },
        ].map(({ label, value, color }) => (
          <div key={label} className="card flex items-center gap-3">
            <span className="text-2xl font-bold text-slate-100">{value}</span>
            <div>
              <p className="text-[13px] text-slate-400">{label}</p>
              <span className={clsx('badge mt-0.5 text-[10px]', color)}>{label}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search orgs…"
            className="input pl-8 text-[13px] py-1.5"
          />
        </div>
        <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1 border border-slate-700">
          <button
            onClick={() => setViewMode('grid')}
            className={clsx('p-1.5 rounded-md transition-colors', viewMode === 'grid' ? 'bg-slate-700 text-slate-100' : 'text-slate-500 hover:text-slate-300')}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={clsx('p-1.5 rounded-md transition-colors', viewMode === 'list' ? 'bg-slate-700 text-slate-100' : 'text-slate-500 hover:text-slate-300')}
          >
            <List className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Orgs display */}
      {loading ? (
        <div className="card text-center py-16">
          <div className="w-8 h-8 border-2 border-brand-600/30 border-t-brand-400 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-400">Loading orgs…</p>
        </div>
      ) : viewMode === 'grid' ? (
        filtered.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map(org => (
              <div key={org.id} onClick={() => selectOrg(org)} className="cursor-pointer">
                <OrgCard org={org} />
              </div>
            ))}
          </div>
        ) : (
          <></>
        )
      ) : (
        <OrgList orgs={filtered} />
      )}

      {!loading && filtered.length === 0 && (
        <div className="card text-center py-16">
          <Building2 className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-400">No orgs found</p>
          <p className="text-[12px] text-slate-500 mt-1">
            {search ? 'Try a different search' : 'Connect your first org to get started'}
          </p>
        </div>
      )}

      {showModal && (
        <ConnectOrgModal
          onClose={() => setShowModal(false)}
          onConnect={connectOrg}
        />
      )}
    </div>
  )
}
