import { useState } from 'react'
import { User, Shield, Key, Save, Check } from 'lucide-react'
import clsx from 'clsx'
import { useAuth } from '../context/AuthContext'
import { AuthService } from '../services/apiServices'

const TABS = [
  { id: 'profile',  label: 'Profile',  icon: User }
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

        </div>
      </div>
    </div>
  )
}
