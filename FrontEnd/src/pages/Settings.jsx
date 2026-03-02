import { useState } from 'react'
import { User, Shield, Key, Save, Check } from 'lucide-react'
import clsx from 'clsx'
import { useAuth } from '../context/AuthContext'
import { AuthService } from '../services/apiServices'

const TABS = [
  { id: 'profile',  label: 'Profile',  icon: User },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'api',      label: 'API Keys', icon: Key },
]

function SettingRow({ label, description, children }) {
  return (
    <div className="flex items-start justify-between py-4 border-b border-slate-800 last:border-0 gap-4">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-200">{label}</p>
        {description && <p className="text-[12px] text-slate-500 mt-0.5 leading-relaxed">{description}</p>}
      </div>
      <div className="flex-shrink-0 flex justify-end">{children}</div>
    </div>
  )
}

export default function Settings() {
  const [activeTab, setActiveTab] = useState('profile')
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const { user, updateUser } = useAuth()
  const [form, setForm] = useState({
    name: user?.name || '',
    organization: user?.organization || '',
  })

  const handleSave = async () => {
    setSaving(true)
    setSaveError('')
    try {
      const updated = await AuthService.updateProfile({ name: form.name, organization: form.organization })
      updateUser(updated)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      setSaveError(err?.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="h-full px-6 py-6 animate-fade-in">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-100">Settings</h1>
        <p className="text-[13px] text-slate-500 mt-0.5">Manage your account and platform preferences</p>
      </div>

      <div className="flex gap-6 items-start">
        {/* Sidebar nav — fixed 200px */}
        <div className="w-[200px] flex-shrink-0 space-y-1">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={clsx(
                'sidebar-nav-item w-full',
                activeTab === id
                  ? 'bg-slate-800 text-slate-100'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              )}
            >
              <Icon className={clsx('w-4 h-4 flex-shrink-0', activeTab === id ? 'text-brand-400' : 'text-slate-500')} />
              {label}
            </button>
          ))}
        </div>

        {/* Content panel — fills remaining space, fixed so it never changes width between tabs */}
        <div className="flex-1 min-w-0 card">

          {activeTab === 'profile' && (
            <div className="space-y-5">
              <h2 className="section-title border-b border-slate-800 pb-3">Profile Information</h2>
              <div className="flex items-center gap-4 py-2">
                <div className="w-16 h-16 rounded-2xl bg-brand-700 flex items-center justify-center text-xl font-bold text-white flex-shrink-0">
                  {user?.name?.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-200">{user?.name}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{user?.email}</p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-[12px] font-medium text-slate-400 mb-1.5">Full Name</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className="input text-[13px] w-full"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-slate-400 mb-1.5">Email Address</label>
                  <input
                    type="email"
                    value={user?.email || ''}
                    readOnly
                    className="input text-[13px] w-full opacity-50 cursor-not-allowed"
                  />
                  <p className="text-[11px] text-slate-600 mt-1">Email address cannot be changed.</p>
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-slate-400 mb-1.5">Organization</label>
                  <input
                    type="text"
                    value={form.organization}
                    onChange={e => setForm(f => ({ ...f, organization: e.target.value }))}
                    className="input text-[13px] w-full"
                    placeholder="Your organization name"
                  />
                </div>
              </div>
              {saveError && (
                <p className="text-[12px] text-red-400">{saveError}</p>
              )}
              <div className="flex justify-end pt-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className={clsx('btn-primary', saved && 'bg-emerald-600 hover:bg-emerald-600', saving && 'opacity-70 cursor-not-allowed')}
                >
                  {saved
                    ? <><Check className="w-3.5 h-3.5" /> Saved!</>
                    : saving
                      ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving…</>
                      : <><Save className="w-3.5 h-3.5" /> Save Changes</>
                  }
                </button>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div>
              <h2 className="section-title border-b border-slate-800 pb-3 mb-0">Security Settings</h2>
              <SettingRow label="Two-Factor Authentication" description="Add an extra layer of security to your account using an authenticator app.">
                <button className="btn-secondary text-[13px]">Enable 2FA</button>
              </SettingRow>
              <SettingRow label="Change Password" description="Update your password regularly to keep your account secure.">
                <button className="btn-secondary text-[13px]">Change Password</button>
              </SettingRow>
            </div>
          )}

          {activeTab === 'api' && (
            <div className="space-y-5">
              <h2 className="section-title border-b border-slate-800 pb-3">API Keys</h2>
              <div className="p-4 bg-brand-900/20 border border-brand-900/40 rounded-xl">
                <p className="text-[13px] text-brand-300">
                  API keys allow external applications to interact with the SF Admin Assistant API
                  on your behalf. Keep them secure and never share them publicly.
                </p>
              </div>
              <div className="space-y-3">
                {[
                  { name: 'Production Key', key: 'sfaa_pk_••••••••••••••••5a2f', created: 'Jan 15, 2024', lastUsed: '2 hrs ago' },
                  { name: 'CI/CD Key',      key: 'sfaa_pk_••••••••••••••••8b4c', created: 'Dec 3, 2023',  lastUsed: '5 days ago' },
                ].map(item => (
                  <div key={item.name} className="flex items-center justify-between gap-4 p-4 bg-slate-800/50 rounded-xl border border-slate-700">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-200">{item.name}</p>
                      <p className="text-[11px] font-mono text-slate-500 mt-1 truncate">{item.key}</p>
                      <p className="text-[11px] text-slate-600 mt-0.5">Created {item.created} · Last used {item.lastUsed}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button className="btn-ghost text-[12px]">Rotate</button>
                      <button className="text-[12px] text-red-400 hover:text-red-300 px-2 py-1 rounded-lg hover:bg-red-900/20 transition-colors">Revoke</button>
                    </div>
                  </div>
                ))}
              </div>
              <button className="btn-primary text-[13px]">
                <Key className="w-3.5 h-3.5" /> Generate New Key
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
