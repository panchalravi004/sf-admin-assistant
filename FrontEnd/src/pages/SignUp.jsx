import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Zap, Eye, EyeOff, ArrowRight, AlertCircle } from 'lucide-react'
import clsx from 'clsx'
import { useAuth } from '../context/AuthContext'
import { AuthService } from '../services/apiServices'

export default function SignUp() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [form, setForm] = useState({
    name: '', email: '', password: '', organization: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const passwordStrength = () => {
    const p = form.password
    if (!p) return null
    if (p.length < 6) return { label: 'Too short', color: 'bg-red-500', width: 'w-1/4' }
    if (p.length < 10) return { label: 'Weak', color: 'bg-orange-500', width: 'w-2/4' }
    if (!/[^a-zA-Z0-9]/.test(p)) return { label: 'Fair', color: 'bg-yellow-500', width: 'w-3/4' }
    return { label: 'Strong', color: 'bg-emerald-500', width: 'w-full' }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name || !form.email || !form.password) {
      setError('Please fill in all required fields.')
      return
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    setError('')
    setLoading(true)
    try {
      const { user, token } = await AuthService.signup({
        name: form.name,
        email: form.email,
        password: form.password,
        orgName: form.organization || undefined,
      })
      login(token, user)
      navigate('/')
    } catch (err) {
      setError(err?.message || 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const strength = passwordStrength()

  return (
    <div className="min-h-screen bg-slate-950 flex">
      {/* Left panel branding */}
      <div className="hidden lg:flex flex-col justify-between w-[480px] flex-shrink-0
        bg-gradient-to-b from-slate-900 to-slate-950 border-r border-slate-800 p-12">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <span className="text-lg font-bold text-slate-100">SF Admin Assistant</span>
        </div>

        <div className="space-y-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-100 leading-snug">
              Start managing your<br />orgs smarter
            </h1>
            <p className="text-slate-400 mt-3 text-[15px] leading-relaxed">
              Join teams who use SF Admin Assistant to automate governance, clean up permissions, and gain AI-driven insights.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {[
              { value: '10k+', label: 'Orgs managed' },
              { value: '2M+', label: 'Actions executed' },
              { value: '99.9%', label: 'Uptime SLA' },
              { value: '< 50ms', label: 'Avg. response' },
            ].map(({ value, label }) => (
              <div key={label} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                <p className="text-xl font-bold text-brand-400">{value}</p>
                <p className="text-[12px] text-slate-500 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-[12px] text-slate-600">
          © 2026 SF Admin Assistant. All rights reserved.
        </p>
      </div>

      {/* Right panel form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-[420px]">
          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 mb-8 lg:hidden">
            <div className="w-8 h-8 rounded-xl bg-brand-600 flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="text-base font-bold text-slate-100">SF Admin Assistant</span>
          </div>

          <div className="mb-6">
            <h2 className="text-2xl font-bold text-slate-100">Create your account</h2>
            <p className="text-slate-500 mt-1 text-[14px]">Get started it only takes a minute</p>
          </div>

          {error && (
            <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-red-900/20
              border border-red-800/50 mb-5 animate-fade-in">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <p className="text-[13px] text-red-300">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[12px] font-medium text-slate-400 mb-1.5">Full name <span className="text-red-400">*</span></label>
              <input
                type="text"
                value={form.name}
                onChange={e => set('name', e.target.value)}
                placeholder="Alex Johnson"
                className="input text-[13px]"
                autoComplete="name"
              />
            </div>

            <div>
              <label className="block text-[12px] font-medium text-slate-400 mb-1.5">Work email <span className="text-red-400">*</span></label>
              <input
                type="email"
                value={form.email}
                onChange={e => set('email', e.target.value)}
                placeholder="you@company.com"
                className="input text-[13px]"
                autoComplete="email"
              />
            </div>

            <div>
              <label className="block text-[12px] font-medium text-slate-400 mb-1.5">Password <span className="text-red-400">*</span></label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={e => set('password', e.target.value)}
                  placeholder="Min. 6 characters"
                  className="input text-[13px] pr-10"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500
                    hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {strength && (
                <div className="mt-2 space-y-1">
                  <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div className={clsx('h-full rounded-full transition-all', strength.color, strength.width)} />
                  </div>
                  <p className="text-[11px] text-slate-500">{strength.label}</p>
                </div>
              )}
            </div>

            <div>
              <label className="block text-[12px] font-medium text-slate-400 mb-1.5">Organization name</label>
              <input
                type="text"
                value={form.organization}
                onChange={e => set('organization', e.target.value)}
                placeholder="Acme Corp (optional)"
                className="input text-[13px]"
                autoComplete="organization"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className={clsx(
                'btn-primary w-full justify-center py-2.5 text-[14px] mt-2',
                loading && 'opacity-70 cursor-not-allowed'
              )}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Create account <ArrowRight className="w-4 h-4" />
                </span>
              )}
            </button>
          </form>

          <p className="text-center text-[13px] text-slate-500 mt-8">
            Already have an account?{' '}
            <Link to="/login" className="text-brand-400 hover:text-brand-300 font-medium transition-colors">
              Sign in
            </Link>
          </p>

          <p className="text-center text-[11px] text-slate-600 mt-4 leading-relaxed">
            By creating an account you agree to our{' '}
            <button className="text-slate-500 hover:text-slate-400 underline underline-offset-2">Terms of Service</button>
            {' '}and{' '}
            <button className="text-slate-500 hover:text-slate-400 underline underline-offset-2">Privacy Policy</button>
          </p>
        </div>
      </div>
    </div>
  )
}
